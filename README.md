# UstaTop: Zarafshon ustalar marketplace'i (to'liq bepul variant)

Hech narsa sotib olish shart emas: SMS o'rniga PIN-kod, bepul hosting va bepul baza.

## Kompyuteringizda sinash
    node server.js            # http://localhost:3000
    SEED=1 node server.js     # namuna ustalar bilan

## Internetga bepul chiqarish (bir marta, ~20 daqiqa)
Hisoblarni ochish va tugmalarni bosishni faqat siz qila olasiz. Ularning hech biri karta so'ramaydi (shartlar o'zgargan bo'lishi mumkin, saytda tekshiring).

1. **GitHub** (github.com, bepul): yangi "ustatop" repozitoriysi oching, 4 ta faylni yuklang: server.js, package.json, index.html, README.md (Add file → Upload files).
2. **Supabase** (supabase.com, bepul): yangi loyiha oching. SQL Editor'da shuni ishga tushiring:
       create table kv (k text primary key, v jsonb);
   Keyin Project Settings → API: **Project URL** va **service_role** kalitini nusxalab oling (kalitni hech kimga bermang).
3. **Render** (render.com, bepul): New → Web Service → GitHub repozitoriyingizni tanlang.
   - Build Command: bo'sh qoldiring yoki `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
   - Environment: `ADMIN_KEY` = kuchli parol, `SUPABASE_URL` = Project URL, `SUPABASE_KEY` = service_role kaliti, `NODE_ENV` = production
4. Render sizga `https://ustatop-xxxx.onrender.com` manzilini beradi. HTTPS tayyor. Shu havolani ustalar va mijozlarga tarqating.

Bilib qo'ying: bepul Render 15 daqiqa foydalanilmasa uxlaydi, birinchi ochilish 30–60 soniya olishi mumkin. Bepul Supabase uzoq vaqt ishlatilmasa pauzaga qo'yilishi mumkin, saytda "Restore" bosasiz. Ma'lumotlar Supabase'da saqlangani uchun serverni qayta ishga tushirsangiz yo'qolmaydi.

## Foydalanish
- **Usta:** ism, telefon, PIN va ish vaqtini kiritib ro'yxatdan o'tadi. Qayta kirish uchun xuddi shu telefon va PIN. Siz tasdiqlamaguncha ro'yxatda chiqmaydi.
- **Siz (admin):** ustani tasdiqlash va hisobni ko'rish (terminal yoki Postman o'rniga brauzerdan ham mumkin emas, curl kerak):
      curl https://SIZNING-MANZIL/api/admin/masters -H "x-admin-key: PAROL"
      curl -XPOST https://SIZNING-MANZIL/api/admin/approve -H "x-admin-key: PAROL" -H "Content-Type: application/json" -d '{"id":"USTA_ID"}'
      curl -XPOST https://SIZNING-MANZIL/api/admin/paid -H "x-admin-key: PAROL" -H "Content-Type: application/json" -d '{"id":"USTA_ID","amount":50000}'
- **Pul:** mijoz ustaga to'g'ridan-to'g'ri to'laydi. Usta "Bajarildi" bossa, 12% komissiya `owed` (sizga qarz) ga yoziladi. Usta o'tkazma qilganda `/api/admin/paid` bilan kamaytirasiz.
- **Suhbat:** har bir buyurtma ichida usta va mijoz yozishadi.

## Keyinroq (hozir shart emas)
Payme/Click orqali onlayn to'lov, SMS, o'z domeni: bularning hammasi pullik yoki rasmiy ro'yxatdan o'tishni talab qiladi.
