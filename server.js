const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 20000
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 10;
const DATA_DIR = path.join(__dirname, 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const SESSION_SECRET = String(process.env.SESSION_SECRET || '');
const sessions = new Map();
let stats = { total: { races: 0, wins: 0, coins: 0 }, users: {}, days: {} };
try { if (fs.existsSync(STATS_FILE)) stats = { ...stats, ...JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) }; } catch (e) { console.error('Stats faylini o‘qib bo‘lmadi:', e.message); }
function saveStats() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); }
  catch (e) { console.error('Stats saqlanmadi:', e.message); }
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function signSession(id) { return crypto.createHmac('sha256', SESSION_SECRET).update(id).digest('hex'); }
function adminAuth(req, res, next) {
  const raw = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('bp_admin='));
  if (!raw || !SESSION_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const token = decodeURIComponent(raw.slice('bp_admin='.length)), parts = token.split('.');
  if (parts.length !== 2 || !safeEqual(parts[1], signSession(parts[0]))) return res.status(401).json({ error: 'Unauthorized' });
  const session = sessions.get(parts[0]);
  if (!session || session.expires < Date.now()) { sessions.delete(parts[0]); return res.status(401).json({ error: 'Unauthorized' }); }
  next();
}
app.use(express.json({ limit: '20kb' }));
app.get('/panel', (_req, res) => res.type('html').send("<!doctype html>\n<html lang=\"uz\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Blok Poyga — Admin</title><style>\n*{box-sizing:border-box}body{margin:0;background:#11151d;color:#edf2f7;font:15px system-ui,Arial}\nmain{max-width:1100px;margin:35px auto;padding:18px}.card{background:#202938;border:1px solid #344154;border-radius:14px;padding:20px;margin:14px 0}\nh1,h2{margin:0 0 14px}input,button{font:inherit;padding:12px;border-radius:8px;border:1px solid #506078}\ninput{display:block;width:100%;margin:9px 0;background:#101722;color:white}button{background:#55c878;color:#08130b;font-weight:700;cursor:pointer}\n#login{max-width:420px;margin:8vh auto}.muted{color:#aab8ca}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}\n.stat{font-size:28px;font-weight:800;color:#77e59b}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #3b4658}\ncanvas{width:100%;height:260px;background:#151e2b;border-radius:8px}.error{color:#ff9b9b}\n</style></head><body><main>\n<section id=\"login\" class=\"card\"><h1>🏁 Blok Poyga Admin</h1><p class=\"muted\">Admin hisobiga kiring</p>\n<form id=\"loginForm\"><input name=\"email\" type=\"email\" placeholder=\"Admin email\" required autocomplete=\"username\">\n<input name=\"password\" type=\"password\" placeholder=\"Parol\" required autocomplete=\"current-password\"><button>Kirish</button></form><p id=\"msg\" class=\"error\"></p></section>\n<section id=\"dash\" hidden><h1>Blok Poyga — boshqaruv paneli</h1><p class=\"muted\">O‘yin statistikasi serverda saqlanadi.</p>\n<div class=\"grid\"><div class=\"card\">Jami poygalar<div id=\"races\" class=\"stat\">0</div></div><div class=\"card\">G‘alabalar<div id=\"wins\" class=\"stat\">0</div></div><div class=\"card\">O‘yinchilar<div id=\"players\" class=\"stat\">0</div></div><div class=\"card\">Yig‘ilgan tangalar<div id=\"coins\" class=\"stat\">0</div></div></div>\n<div class=\"card\"><h2>Kunlar bo‘yicha poygalar</h2><canvas id=\"chart\" width=\"1000\" height=\"260\"></canvas></div>\n<div class=\"card\"><h2>O‘yinchilar ro‘yxati</h2><div style=\"overflow:auto\"><table><thead><tr><th>Ism</th><th>Poygalar</th><th>G‘alaba</th><th>Tanga</th><th>Eng yaxshi vaqt</th></tr></thead><tbody id=\"users\"></tbody></table></div></div>\n<button id=\"refresh\">Yangilash</button> <button id=\"logout\" style=\"background:#e77b70\">Chiqish</button></section>\n</main><script>\nconst $=id=>document.getElementById(id);\nasync function api(url,opts={}){const r=await fetch(url,{credentials:'same-origin',...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Xatolik');return d;}\n$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('msg').textContent='';const f=new FormData(e.target);try{await api('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.get('email'),password:f.get('password')})});await load();}catch(x){$('msg').textContent=x.message;}});\nfunction draw(days){const c=$('chart'),g=c.getContext('2d'),w=c.width,h=c.height;g.clearRect(0,0,w,h);const max=Math.max(1,...days.map(x=>x.count));g.strokeStyle='#718096';g.fillStyle='#8ce6a9';g.lineWidth=2;g.beginPath();g.moveTo(35,15);g.lineTo(35,h-35);g.lineTo(w-10,h-35);g.stroke();const step=(w-70)/Math.max(1,days.length);days.forEach((d,i)=>{const bh=(h-65)*d.count/max,x=40+i*step;g.fillRect(x,h-36-bh,Math.max(3,step-5),bh);g.fillStyle='#dce6f1';g.font='12px sans-serif';if(i%Math.max(1,Math.ceil(days.length/8))===0)g.fillText(d.day.slice(5),x,h-12);g.fillStyle='#8ce6a9';});}\nasync function load(){try{const d=await api('/api/admin/stats');$('login').hidden=true;$('dash').hidden=false;$('races').textContent=d.total.races;$('wins').textContent=d.total.wins;$('players').textContent=d.total.players;$('coins').textContent=d.total.coins;draw(d.days);$('users').textContent='';d.users.forEach(u=>{const tr=document.createElement('tr');[u.name,u.races,u.wins,u.coins,u.bestLap?u.bestLap.toFixed(1)+' s':'—'].forEach(v=>{const td=document.createElement('td');td.textContent=String(v);tr.appendChild(td);});$('users').appendChild(tr);});}catch(e){if(e.message==='Unauthorized'){$('dash').hidden=true;$('login').hidden=false;}else $('msg').textContent=e.message;}}\n$('refresh').onclick=load;$('logout').onclick=async()=>{await api('/api/admin/logout',{method:'POST'});$('dash').hidden=true;$('login').hidden=false;};\nload();\n</script></body></html>"));
app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SESSION_SECRET) return res.status(503).json({ error: 'Admin sozlamalari hostingda kiritilmagan.' });
  const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '');
  if (!safeEqual(email, ADMIN_EMAIL) || !safeEqual(password, ADMIN_PASSWORD)) return res.status(401).json({ error: 'Email yoki parol noto‘g‘ri.' });
  const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { expires: Date.now() + 8 * 60 * 60 * 1000 });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', 'bp_admin=' + encodeURIComponent(id + '.' + signSession(id)) + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800' + secure);
  res.json({ ok: true });
});
app.post('/api/admin/logout', adminAuth, (req, res) => {
  const raw = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('bp_admin='));
  if (raw) sessions.delete(decodeURIComponent(raw.slice('bp_admin='.length)).split('.')[0]);
  res.setHeader('Set-Cookie', 'bp_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); res.json({ ok: true });
});
app.get('/api/admin/stats', adminAuth, (_req, res) => {
  const users = Object.values(stats.users || {}).sort((a,b) => b.races-a.races);
  const days = Object.entries(stats.days || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-30).map(([day,v]) => ({ day, count: v.races || 0 }));
  res.json({ total: { ...stats.total, players: users.length }, users, days });
});
app.post('/api/race/complete', (req, res) => {
  const name = String(req.body.name || 'Poygachi').replace(/[\\u0000-\\u001f<>]/g, '').trim().slice(0,18) || 'Poygachi';
  const won = req.body.won === true, rank = Math.max(1, Math.min(20, Number(req.body.rank) || 1));
  const duration = Math.max(0, Math.min(36000, Number(req.body.duration) || 0));
  const coins = Math.max(0, Math.min(100000, Number(req.body.coins) || 0));
  const bestLap = Math.max(0, Math.min(3600, Number(req.body.bestLap) || 0));
  const day = new Date().toISOString().slice(0,10);
  const key = name.toLowerCase();
  const u = stats.users[key] || (stats.users[key] = { name, races: 0, wins: 0, coins: 0, bestLap: 0 });
  u.name = name; u.races++; if (won) u.wins++; u.coins += coins;
  if (bestLap && (!u.bestLap || bestLap < u.bestLap)) u.bestLap = bestLap;
  stats.total.races++; if (won) stats.total.wins++; stats.total.coins += coins;
  const d = stats.days[day] || (stats.days[day] = { races: 0, wins: 0 }); d.races++; if (won) d.wins++;
  saveStats(); res.json({ ok: true, rank, duration });
});

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
