BLOK POYGA v2 — ISHGA TUSHIRISH

1) Node.js 20 yoki undan yangisini o‘rnat.
2) Terminalda loyiha papkasiga kir: cd Blok_Poyga_v2
3) Paketlarni o‘rnat: npm install
4) Serverni ishga tushir: npm start
5) Brauzerda http://localhost:3000 manzilini och.

INTERNETDA DO‘STLAR BILAN:
- Loyihani Node.js qo‘llaydigan hostingga joylashtir (Render, Railway yoki VPS).
- Hosting PORT muhit o‘zgaruvchisini o‘zi beradi; server avtomatik ishlatadi.
- Hamma hosting bergan HTTPS manzilini ochadi. MENYUDA O‘Z ISMINGIZNI YOZING.
- Biri XONA YARATISH ni bosib kodni yuboradi, boshqalar KOD BILAN KIRISH ni bosadi.
- Xona egasi DO‘STLAR BILAN POYGANI BOSHLASH tugmasini bosadi.
- Poyga tugagach xona YOPILMAYDI: xona egasi YANA O‘YNASH yoki menyudan
  qayta boshlashi mumkin. Poyga davomida yangi odam kira olmaydi,
  poyga tugagach esa qayta kira oladi (v1 da bu imkonsiz edi).
- Xona egasi chiqib ketsa, host avtomatik boshqa o‘yinchiga o‘tadi.

BOSHQARUV:
- W A S D yoki strelkalar — haydash
- Space — nitro
- Shift — drift
- Z yoki X — QO‘L TORMOZI (yangi!): keskin tormoz + o‘tkir burilish,
  telefonda chapdagi Q.TORM tugmasi. Drift bilan birga nitro ham to‘playdi.
- C — kamera, P — pauza, R — trassaga qaytish, M — ovoz

V2 DA TUZATILGAN XATOLAR:
1. KRITIK: Multiplayerda raqib mashinalari umuman harakatlanmasdi —
   endi silliq interpolatsiya bilan harakatlanadi, minimapda ham ko‘rinadi.
2. KRITIK: Onlayn poygada doim "YOU WIN" chiqardi — endi haqiqiy o‘rinlar
   hisoblanadi (marraga yetish tartibi server orqali uzatiladi).
3. KRITIK: Poyga tugagach xona "qotib qolardi" — endi race:end bilan
   qayta boshlash va yangi o‘yinchilarni qabul qilish ishlaydi.
4. Onlaynda ko‘rinmas AI mashinalar to‘qnashuvga xalaqit berardi — tuzatildi.
5. Xona egasi chiqsa, yangi hostga start tugmasi ko‘rinmasdi — tuzatildi.
6. Ism yozishda klaviatura o‘yinni boshqarib yuborardi — input maydonlari himoyalandi.
7. Onlayn poygadan keyin menyuda bo‘sh demo sahnasi ko‘rinardi — tuzatildi.
8. Three.js uchun 3 xil CDN (cdnjs/jsdelivr/unpkg) — biri ishlamasa keyingisi.
9. Kichik: <title> noto‘g‘ri joyda edi, charset, "DARaja" xatosi,
   o‘lik kod (finishOrder, slots) tozalandi, ism maxsus belgilardan tozalanadi.

ESLATMA: multiplayer server doim ishlab turishi kerak. Xonalar xotirada
saqlanadi; server qayta ishga tushsa, eski xonalar yopiladi.
