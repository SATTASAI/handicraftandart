# ศิลปหัตถกรรม

ระบบแข่งขันสำหรับ **ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง** โรงเรียนบ้านป่าเด็ง สพป.เพชรบุรี เขต 2

## ฟังก์ชัน

- หน้าแรกเป็นการ์ดภาพปก ค้นหาและกรองรายการได้ กดการ์ดเพื่อดูเกณฑ์ วันเวลา สถานที่ และสมัคร
- สมัครบัญชีครู: ชื่อ–นามสกุล **โรงเรียนที่สังกัด** อีเมล และรหัสผ่าน โรงเรียนถูกบันทึกในฐานข้อมูลและแนบกับรายการสมัครจากฝั่งเซิร์ฟเวอร์
- เข้าสู่ระบบ ออกจากระบบ และลืมรหัสผ่านผ่าน **Resend** (ลิงก์ครั้งเดียว อายุ 30 นาที)
- ลงทะเบียนนักเรียนและครูผู้ฝึกซ้อม บันทึกร่าง ตรวจสอบ และยืนยัน พร้อมลิงก์ผลงาน HTTPS
- กรรมการเห็นและให้คะแนนได้เฉพาะรายการที่มอบหมาย
- ผู้ดูแลกำหนดสิทธิ์ มอบหมายกรรมการ แก้เกณฑ์/เวลา/สถานที่ เปิด–ปิดรับสมัคร และประกาศผล
- คะแนนเฉลี่ยจากกรรมการทุกคน แสดงผลหลังประกาศ และล็อกการแก้คะแนน
- ประกาศนียบัตร PDF ภาษาไทย แยกหน้าสำหรับนักเรียนและครู ดาวน์โหลดได้เฉพาะเจ้าของรายการ/ผู้ดูแลหลังยืนยันผล

รายการแข่งขัน จำนวนคน เกณฑ์คะแนน และช่วงรางวัลเริ่มต้นเป็น **ข้อมูลตัวอย่าง** ต้องยืนยันตามระเบียบการแข่งขันจริงก่อนใช้งาน เกณฑ์ตัวอย่าง: คุณภาพ 40 / ความคิดสร้างสรรค์ 30 / กระบวนการ 20 / นำเสนอ 10; ทอง 80 ขึ้นไป เงิน 70–79.99 ทองแดง 60–69.99 ให้แก้ `src/App.jsx`, `server/index.js`, `server/security.js` และ tests ให้ตรงกันหากเปลี่ยนเกณฑ์ ปรับจำนวนคน/รายการเพิ่มเติมใน D1 ตามข้อกำหนดจริง

## เทคโนโลยีและการติดตั้ง

React + Vite, Cloudflare **Workers with Static Assets**, D1, Resend REST API ไม่ใช่การอัปโหลดเฉพาะไฟล์ static ไป Cloudflare Pages เพราะระบบบัญชีต้องใช้ Worker และ D1

ใช้ Node.js 22 หรือใหม่กว่า:

```sh
npm ci
npm test
npm run build
```

### ทดลองในเครื่อง

```sh
cp .dev.vars.example .dev.vars
```

เปลี่ยน `AUTH_SECRET` เป็นค่าสุ่มอย่างน้อย 32 ตัวอักษร (เช่นสร้างด้วย `openssl rand -hex 32`) แล้วเปิด:

```sh
npm run dev -- --host 0.0.0.0 --port 4173
```

Vite โหลด Worker และ D1 จำลองผ่าน Miniflare ในกระบวนการเดียวกัน อัปเดต schema ให้อัตโนมัติ ข้อมูลอยู่ใน `.wrangler/vite-api/` และไม่ส่งขึ้น Git ต้องเริ่ม dev server ใหม่เมื่อแก้ `server/` หรือ migrations

อีกวิธีคือ `npm run db:local` แล้ว `npm run dev:full` เพื่อใช้ Wrangler + build assets ที่พอร์ต 8787 วิธีนี้ใช้ฐานข้อมูล local คนละชุดกับ Vite

### ตั้งค่า Cloudflare จริง

1. เชื่อมบัญชี Cloudflare ด้วย `npx wrangler login` หรือใช้ API token จาก secret store ของระบบ build
2. ใช้ D1 ที่มีอยู่แล้วชื่อ `handicraftart` และตรวจสอบ UUID:

```sh
npx wrangler d1 info handicraftart
```

3. นำ UUID ของฐานข้อมูล `handicraftart` จากคำสั่งไปแทน UUID ตัวอย่างใน `wrangler.jsonc` โดยคง binding ชื่อ `DB`
4. กำหนด `SITE_URL` เป็น URL HTTPS จริงของเว็บ (เช่น Worker URL หรือ custom domain), `MAIL_FROM` เป็นชื่อ/อีเมลบนโดเมนที่ยืนยันใน Resend
5. ตั้งค่า secrets ผ่าน prompt ของ Wrangler ห้ามใส่ค่า secret ในโค้ดหรือ `VITE_*`:

```sh
npx wrangler secret put AUTH_SECRET
npx wrangler secret put RESEND_API_KEY
```

6. ใช้ฐานข้อมูล remote และ deploy:

```sh
npm run db:remote
npm run deploy
```

เมื่อเชื่อม GitHub ผ่าน Cloudflare Workers Builds: build command `npm ci && npm run build`, deploy command `npx wrangler deploy` และตั้ง D1/Secrets ให้ครบก่อน build แรก การ push รีโปเพียงอย่างเดียวไม่ได้สร้าง D1 หรือเผยแพร่เว็บอัตโนมัติหากยังไม่ได้เชื่อม Workers Builds

### ผู้ดูแลคนแรก

สมัครบัญชีผ่านหน้าเว็บก่อน แล้วผู้ที่มีสิทธิ์ Cloudflare รันคำสั่งต่อไปนี้ โดยเปลี่ยนอีเมลตัวอย่างเป็นบัญชีผู้ดูแลจริง:

```sh
npx wrangler d1 execute handicraftart --remote --command "UPDATE users SET role='admin' WHERE email='admin@example.com';"
```

รีโหลดหน้าเว็บ สิทธิ์ตรวจจากฐานข้อมูลทุกคำขอ ผู้ใช้ใหม่ทุกคนเริ่มเป็นผู้เข้าร่วม ไม่มีการยกสิทธิ์ผู้สมัครคนแรกอัตโนมัติ หลังจากนั้นกำหนดกรรมการ/ผู้ดูแลผ่านเมนูจัดการสิทธิ์ได้

### Resend สำหรับลืมรหัสผ่าน

1. เพิ่มโดเมนหรือ subdomain สำหรับส่งอีเมลใน Resend แล้วเพิ่ม DNS DKIM/SPF ตามที่ Resend แสดง แนะนำ DMARC ตามนโยบายโดเมน ตรวจให้สถานะโดเมนเป็น Verified
2. สร้าง API key แบบ Sending access จำกัดโดเมนที่ใช้ และเก็บใน Cloudflare Secret `RESEND_API_KEY`
3. ตั้ง `MAIL_FROM` เช่น `ศิลปหัตถกรรม <support@mail.your-domain.example>` โดยต้องใช้โดเมนที่ยืนยันแล้ว ตั้ง `SITE_URL` เป็น URL HTTPS จริงของเว็บ
4. กดลืมรหัสผ่านด้วยบัญชีทดสอบที่คุณเป็นเจ้าของ ตรวจส่งถึง inbox/spam และทดสอบลิงก์ใช้แล้วเปิดซ้ำไม่ได้

หากยังไม่ตั้งอีเมล ระบบจะแจ้งว่าผู้ดูแลยังไม่ได้ตั้งค่า ไม่แสดงว่าส่งสำเร็จ API ไม่เปิดเผยว่ามีอีเมลอยู่ในระบบหรือไม่ หาก provider ส่งไม่สำเร็จจะลบ token ที่ส่งไม่ได้และบันทึกเฉพาะข้อความ error ทั่วไปโดยไม่บันทึกรหัสผ่าน/ลิงก์รีเซ็ต

ในการพัฒนานี้ทดสอบ Resend ด้วยตัวจำลอง HTTP ไม่ส่งอีเมลจริง และยังไม่ได้ตั้งโดเมน, API key, D1 หรือ deploy ในบัญชี Cloudflare จริง

### ก่อนเปิดรับสมัครจริง

ยืนยันรายการแข่งขันและเกณฑ์กับผู้จัด แก้วันเวลา/สถานที่/รายละเอียดผ่านผู้ดูแล ตรวจ PDF และข้อมูลผู้ออกประกาศนียบัตรให้ตรงข้อกำหนดจริง แล้วเปลี่ยน `DEMO_MODE` เป็น `"false"` ใน `wrangler.jsonc` และ deploy ใหม่ ประกาศนียบัตรตัวอย่างไม่มีลายเซ็นหรือตราราชการที่สมมติขึ้น

ข้อมูลโรงเรียนเป็นข้อมูลที่ครูระบุตอนสมัคร ยังไม่มีขั้นตอนตรวจสอบหลักฐานสังกัดหรือยืนยันอีเมล เก็บลิงก์ผลงานภายนอก ไม่มีระบบอัปโหลดไฟล์ลง R2 ในรุ่นนี้

## โครงสร้าง

- `src/` หน้าเว็บและ PDF renderer
- `server/index.js` API, sessions, สิทธิ์, Resend และผลการแข่งขัน
- `server/security.js` PBKDF2-SHA256 + server pepper, token hashing, validation
- `migrations/` schema D1 และข้อมูลแข่งขันตัวอย่าง
- `public/covers/` ภาพปก WebP ที่สร้างสำหรับงานนี้
- `public/fonts/` Noto Sans Thai รวมชุด Thai/Latin สำหรับ PDF พร้อม OFL license
- `tests/` ทดสอบ Worker/D1 จริงใน Miniflare, auth/reset/role/scoring/certificate และ PDF
- `qa/`, `design-qa.md` หลักฐานตรวจหน้าจอ
- `worker/` และ `scripts/prepare-sites-build.mjs` คงไว้สำหรับ runtime ของ Product Design; production Cloudflare ใช้ `server/index.js` ตาม `wrangler.jsonc`

## ความปลอดภัย

Session cookies เป็น HttpOnly, SameSite=Lax และ Secure บน HTTPS; บังคับ same-origin สำหรับทุก mutation; password ใช้ random salt และ pepper จาก AUTH_SECRET; session/reset tokens เก็บเฉพาะ SHA-256; rate limit ตาม IP และอีเมล; เปลี่ยนรหัสผ่านแล้วเพิกถอนทุก session; ตรวจ ownership และ role ฝั่งเซิร์ฟเวอร์ ไม่เชื่อโรงเรียนหรือคะแนนรวมจาก client

PBKDF2 ใช้ 100,000 รอบตามข้อจำกัดที่รองรับใน Workers ร่วมกับ server pepper และ rate limit เก็บ AUTH_SECRET ให้ปลอดภัยและคงเดิม ไม่เช่นนั้นรหัสผ่านเดิมจะใช้ไม่ได้ จัด retention/cleanup ตาราง sessions, resets และ throttle ตามนโยบายผู้จัดก่อนใช้งานระยะยาว

## เอกสารอ้างอิง

- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://resend.com/docs/api-reference/emails/send-email
