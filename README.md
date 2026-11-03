# ศิลปหัตถกรรม — ระบบบัญชีใหม่

สมัครด้วยชื่อ–นามสกุล โรงเรียน อีเมล รหัสผ่าน และเลือกผู้ฝึกซ้อม/กรรมการอย่างใดอย่างหนึ่งหรือทั้งสองอย่าง บัญชีแรกที่สมัครสำเร็จเป็น **superadmin** มีสิทธิ์ทุกอย่างในระบบ บัญชีถัดไปเป็นผู้ใช้งานปกติตามบทบาทที่เลือก

ส่วนที่ทำงานแล้ว: สมัครบัญชี, เข้าสู่ระบบ, ออกจากระบบ, ข้อมูลบัญชี และรายชื่อผู้ใช้สำหรับ superadmin ส่วนการแข่งขันจะเพิ่มในขั้นถัดไป

## พัฒนาในเครื่อง

Node.js 22 ขึ้นไป:

```sh
npm ci
npm run dev
```

Vite และ Miniflare รัน frontend กับ API ในกระบวนการเดียว ใช้ D1 จำลองและเก็บข้อมูลใน `.wrangler/accounts-v1` ไม่ต้องตั้ง secret สำหรับรันในเครื่อง ข้อมูลและ session อยู่ต่อเมื่อเริ่ม dev ใหม่ บัญชี local แยกจาก production

```sh
npm test
npm run build
npx wrangler deploy --dry-run --outdir .wrangler/deploy-check
```

## ฐานข้อมูลและ deployment

Worker `handicraftandart` ใช้ binding `DB` เชื่อม D1 เดิม UUID `ef879189-20c8-43ad-9a60-ea2d12c29544` migration `0011_restart_accounts.sql` สร้างตาราง `account_users`, `account_bootstrap`, `account_sessions`, `account_limits` สำหรับระบบบัญชีใหม่ บัญชีรุ่นเก่าไม่ถูกนำมาใช้ล็อกอิน และ migration นี้ไม่ล้างตารางการแข่งขันเดิม การ reset ฐานข้อมูลจริงจากคำขอก่อนหน้ายังไม่ได้ดำเนินการ

ขั้น deploy ต้องได้รับอนุญาตแยกจากการพัฒนาในเครื่อง สำรอง D1 ก่อนใช้ migration แล้วจึงเผยแพร่ Worker ด้วยสิทธิ์ Cloudflare ของบัญชีเดิม `npm run deploy` ประกอบด้วย build, remote migration และ deploy โดยไม่มี prebuild hook ที่แก้ production อัตโนมัติ การ build และ GitHub checks ไม่แก้ฐานข้อมูลจริง

**บัญชีแรกบน production จะได้สิทธิ์ superadmin ตามที่เจ้าของระบบกำหนด** เจ้าของควรสมัครเป็นคนแรกเมื่อเผยแพร่ อย่าลบ account_bootstrap ในการอัปเดตปกติ การสมัครพร้อมกันใช้ transaction และ unique index เพื่อให้มี superadmin คนเดียว

## การจัดการบัญชี

- รหัสผ่าน 12–128 ตัวอักษร เก็บ PBKDF2-SHA256 พร้อม random salt เฉพาะบัญชี
- Session token สุ่ม 256 บิต เก็บเฉพาะค่า SHA-256 ใน D1 ใช้ HttpOnly / SameSite=Lax / Secure cookie บน HTTPS อายุ 7 วัน
- ตรวจ Origin สำหรับคำขอเขียนข้อมูล มี rate limit และจำกัดขนาด request
- ตรวจ superadmin ฝั่ง API ผู้สมัครส่ง is_superadmin หรือ permissions มาเองไม่ได้
- ไม่มีการยืนยันเอกสารหรือรออนุมัติบัญชี ไม่มีบัญชีตัวอย่างใน migration
