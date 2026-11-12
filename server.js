const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 20000
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 10;
const rooms = new Map();

// index.html ni avval public/ papkasidan, topilmasa loyiha ildizidan qidiramiz
const PAGE_CANDIDATES = [
  path.join(__dirname, 'public', 'index.html'),
  path.join(__dirname, 'index.html')
];
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) app.use(express.static(publicDir));

app.get('/', (_req, res) => {
  const page = PAGE_CANDIDATES.find(p => fs.existsSync(p));
  if (!page) return res.status(404).send('index.html topilmadi.');
  res.sendFile(page);
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'Blok Poyga multiplayer v2', maxPlayers: MAX_PLAYERS, rooms: rooms.size });
});

// Ismdan boshqaruv belgilarini tozalash (XSS va uzilishlardan himoya)
function cleanName(v) {
  const n = String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18);
  return n || 'Poygachi';
}

function roomPlayers(code) {
  const room = rooms.get(code);
  if (!room) return [];
  return [...room.players].map(id => ({
    id,
    name: room.playerInfo.get(id)?.name || 'Poygachi',
    isHost: room.host === id
  }));
}

function emitRoom(code) {
  const room = rooms.get(code);
  if (room) io.to(code).emit('room:players', {
    code, players: roomPlayers(code), maxPlayers: MAX_PLAYERS, host: room.host
  });
}

function removeEmptyRoom(code) {
  const room = rooms.get(code);
  if (room && room.players.size === 0) rooms.delete(code);
}

io.on('connection', socket => {
  function leaveRoom() {
    const code = socket.data.room;
    if (!code) return;
    const room = rooms.get(code);
    socket.leave(code);
    socket.data.room = null;
    if (!room) return;
    room.players.delete(socket.id);
    room.playerInfo.delete(socket.id);
    if (room.host === socket.id) room.host = room.players.values().next().value || null;
    io.to(code).emit('player:left', { id: socket.id });
    emitRoom(code);
    removeEmptyRoom(code);
  }

  socket.on('room:create', (payload = {}) => {
    leaveRoom();
    let code;
    do { code = Math.random().toString(36).slice(2, 7).toUpperCase(); }
    while (rooms.has(code));

    rooms.set(code, {
      players: new Set([socket.id]),
      playerInfo: new Map([[socket.id, { name: cleanName(payload.name) }]]),
      host: socket.id,
      started: false
    });
    socket.join(code);
    socket.data.room = code;
    socket.emit('room:created', { code, maxPlayers: MAX_PLAYERS });
    emitRoom(code);
  });

  socket.on('room:join', (payload = {}) => {
    const code = String(payload.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = rooms.get(code);
    if (!room) return socket.emit('room:error', { message: 'Bunday xona topilmadi.' });
    if (room.started) return socket.emit('room:error', { message: 'Poyga allaqachon boshlangan.' });
    if (room.players.size >= MAX_PLAYERS) {
      return socket.emit('room:error', { message: 'Xona to‘la. Maksimum 10 kishi.' });
    }
    leaveRoom();
    room.players.add(socket.id);
    room.playerInfo.set(socket.id, { name: cleanName(payload.name) });
    socket.join(code);
    socket.data.room = code;
    socket.emit('room:joined', { code, maxPlayers: MAX_PLAYERS });
    emitRoom(code);
  });

  socket.on('player:update', data => {
    const code = socket.data.room;
    const room = code && rooms.get(code);
    if (!room || !room.players.has(socket.id) || !data || typeof data !== 'object') return;
    const clean = {
      id: socket.id,
      x: Number(data.x) || 0,
      z: Number(data.z) || 0,
      h: Number(data.h) || 0,
      speed: Math.max(0, Math.min(300, Number(data.speed) || 0)),
      maxSpeed: Math.max(0, Math.min(300, Number(data.maxSpeed) || 0)),
      color: Number(data.color) || 0x35d4e8,
      name: cleanName(data.name),
      lap: Math.max(0, Math.min(20, Number(data.lap) || 0)),
      prog: Math.max(-500, Math.min(30000, Number(data.prog) || 0)),
      finished: Boolean(data.finished)
    };
    room.playerInfo.set(socket.id, { name: clean.name });
    socket.to(code).volatile.emit('player:update', clean);
  });

  socket.on('race:start', () => {
    const code = socket.data.room;
    const room = code && rooms.get(code);
    if (!room || room.host !== socket.id || room.started) return;
    if (room.players.size < 2) {
      return socket.emit('room:error', { message: 'Poyga uchun kamida 2 haqiqiy o‘yinchi kerak.' });
    }
    room.started = true;
    io.to(code).emit('race:start', { code, players: roomPlayers(code) });
  });

  // Poyga tugadi / xona egasi qayta boshlashi uchun: started=false qiladi
  socket.on('race:end', () => {
    const code = socket.data.room;
    const room = code && rooms.get(code);
    if (!room || room.host !== socket.id) return;
    if (!room.started) return;
    room.started = false;
    io.to(code).emit('race:ended', { code });
  });

  // Kim marraga yetdi — xammasiga yetkazamiz (onlayn natijalar uchun)
  socket.on('player:finished', data => {
    const code = socket.data.room;
    const room = code && rooms.get(code);
    if (!room || !room.players.has(socket.id)) return;
    const t = Math.max(0, Math.min(36000, Number(data && data.t) || 0));
    socket.to(code).emit('player:finished', { id: socket.id, t });
  });

  socket.on('room:leave', leaveRoom);
  socket.on('disconnect', leaveRoom);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Blok Poyga v2 server listening on ${PORT}`);
});
