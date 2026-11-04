# เก็บภาพบัตรและประกาศนียบัตรใน Google Drive

ระบบเก็บไฟล์ 2 อย่างใน Google Drive ของบัญชี Google ที่ใช้เฉพาะงานนี้

- **ภาพบัตรประชาชนนักเรียน** อัปโหลดใหม่จะไปอยู่ที่ Drive ทันที แถวใน D1 เก็บแค่เจ้าของ ชนิด ขนาด และ id ไฟล์ Drive (คอลัมน์ `data` เป็นค่าว่าง) ภาพยังเปิดดูได้ผ่าน API ที่ตรวจสิทธิ์เหมือนเดิม Drive ไม่เปิดสาธารณะ
- **ประกาศนียบัตร PDF** เก็บไฟล์ละ 1 หน่วย คือหน้านักเรียนของ 1 ทีม หน้าครูผู้ฝึกซ้อมของ 1 ทีม หรือหน้ากรรมการ 1 คน ครั้งแรกที่มีคนกดโหลด เบราว์เซอร์สร้าง PDF แล้วอัปขึ้น Drive ครั้งต่อไปโหลดจาก Drive แทนการวาดใหม่ ถ้าข้อมูลที่พิมพ์บนใบเปลี่ยน (คะแนน เหรียญ ชื่อ การตั้งค่าประกาศนียบัตร หรือแบบใบ) ลายนิ้วมือ (fingerprint) ของหน่วยนั้นจะเปลี่ยน ระบบไม่ส่งไฟล์เก่า จะสร้างใหม่และลบไฟล์เก่าใน Drive ให้

ถ้ายังไม่ได้ตั้งค่า secret ระบบทำงานแบบเดิม ภาพบัตรเก็บใน D1 และประกาศนียบัตรสร้างในเครื่องทุกครั้ง

> แก้แบบใบใน `src/components/certificatePdf.js` เมื่อไหร่ ต้องเปลี่ยนค่า `CERTIFICATE_DESIGN` ใน `server/judging.js` ด้วย ไม่อย่างนั้นจะได้ไฟล์แบบเก่าจาก Drive

## ตั้งค่าครั้งเดียว

1. สร้างบัญชี Google ใหม่สำหรับเก็บไฟล์ระบบ (ไม่ใช้บัญชีส่วนตัว)
2. เข้า <https://console.cloud.google.com> ด้วยบัญชีนั้น → สร้าง Project ใหม่ → **APIs & Services → Library** → เปิด **Google Drive API**
3. **Google Auth Platform** (OAuth consent screen) → เลือก External → ใส่ชื่อแอปและอีเมล → หน้า **Audience** กด **Publish app** ให้เป็น *In production*
   - ถ้าค้างไว้ที่ *Testing* refresh token จะหมดอายุใน 7 วัน
   - ใช้แค่ scope `drive.file` ซึ่งไม่ต้องให้ Google ตรวจแอป
4. **Clients → Create client** → ชนิด *Web application* → Authorized redirect URIs ใส่ `https://developers.google.com/oauthplayground` → จด **Client ID** และ **Client secret**
5. เปิด <https://developers.google.com/oauthplayground> → ไอคอนเฟือง → ติ๊ก *Use your own OAuth credentials* → วาง Client ID/secret
   - ช่อง Step 1 พิมพ์ `https://www.googleapis.com/auth/drive.file` → **Authorize APIs** → ล็อกอินบัญชีใหม่ (ถ้าขึ้นว่าแอปยังไม่ยืนยัน ให้กด Advanced → ไปต่อ) → **Exchange authorization code for tokens** → คัดลอก **Refresh token**
6. ตั้ง secret ของ Worker `handicraftandart` (Cloudflare Dashboard → Workers → handicraftandart → Settings → Variables and Secrets หรือคำสั่งด้านล่าง)

   ```sh
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put GOOGLE_REFRESH_TOKEN
   ```

7. ใช้ migration `0016_drive_storage.sql` แล้ว deploy (`npm run deploy` ทำทั้งสองอย่าง)
8. superadmin เข้า **ผู้ใช้งานและสิทธิ์ → ที่เก็บไฟล์ (Google Drive)** ตรวจว่าขึ้น "เชื่อมต่อแล้ว" แล้วกด **ย้ายภาพบัตรจาก D1 ไป Drive** ระบบย้ายทีละ 10 ภาพจนหมด และล้างข้อมูลภาพออกจาก D1

ระบบสร้างโฟลเดอร์ `ศิลปหัตถกรรม (ไฟล์ระบบ)` ในบัญชีนั้นเอง มีโฟลเดอร์ย่อย `ภาพบัตรประชาชนนักเรียน` และ `ประกาศนียบัตร` id โฟลเดอร์จำไว้ใน `app_settings` (`drive_folder:*`)

## ข้อควรระวัง

- อย่าแชร์โฟลเดอร์แบบ "ทุกคนที่มีลิงก์" เพราะภาพบัตรเป็นข้อมูลส่วนบุคคล
- อย่าลบหรือย้ายไฟล์ในโฟลเดอร์ด้วยมือ ถ้าภาพบัตรถูกลบ ระบบจะเปิดภาพไม่ได้ ส่วนประกาศนียบัตรที่ถูกลบจะถูกสร้างใหม่อัตโนมัติ
- ถ้า token ถูกยกเลิก (เช่นกด Remove access ในบัญชี Google) ให้ทำข้อ 5–6 ใหม่ ระหว่างนั้นการอัปโหลดภาพบัตรใหม่จะแจ้งว่าไม่สำเร็จ
- ไม่ต้องตั้ง `DRIVE_FOLDER_ID` ปกติ ตั้งเฉพาะเมื่อใช้ token ที่มีสิทธิ์ Drive เต็มและต้องการเก็บในโฟลเดอร์ที่สร้างไว้แล้ว
