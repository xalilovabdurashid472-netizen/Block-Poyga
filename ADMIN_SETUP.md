# Admin panel sozlash

Admin panel: `/panel`

Hosting (masalan Render) Environment Variables bo‘limiga quyidagilarni kiriting:

- `ADMIN_EMAIL` — admin email manzili
- `ADMIN_PASSWORD` — kuchli, boshqa joyda ishlatilmaydigan admin paroli
- `SESSION_SECRET` — kamida 32 ta tasodifiy belgidan iborat maxfiy kalit

So‘ng xizmatni qayta deploy/restart qiling. Bu qiymatlarni GitHub kodiga yozmang.

Statistika `data/stats.json` faylida saqlanadi. Hosting doimiy disk (persistent disk) bermasa, deploy yoki restart paytida lokal fayl yo‘qolishi mumkin; bunday holatda persistent disk ulang yoki tashqi ma’lumotlar bazasidan foydalaning.

Admin panel: `https://SIZNING-DOMENINGIZ/panel`
