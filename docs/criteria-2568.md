# บัญชีเกณฑ์ปี 2568 สำหรับทดสอบงานปีการศึกษา 2569

อ้างอิงเอกสารการแข่งขันครั้งที่ 73 จาก [โฟลเดอร์ของผู้จัด](https://drive.google.com/drive/folders/1CuhENxsvWIYPoUEZZMCPKdiVQ-w8V6va) จำนวน 12 ฉบับ ชุดนี้ใช้ 11 ฉบับที่มีกิจกรรมประถมหรืออายุ 7–12 ปี ไม่นำกิจกรรมปฐมวัย/มัธยมมารับสมัคร

ข้อมูลหลักอยู่ใน `data/criteria-2568.json` และสร้าง migration ด้วย `node scripts/generate-criteria-migration.mjs` ห้ามแก้ migration ที่ใช้บนฐานข้อมูลจริงไปแล้ว ให้เพิ่ม migration ใหม่เมื่อเปลี่ยนชุดข้อมูล

197 รายการย่อยแยกช่วงชั้น เพศ ประเภทสถานศึกษา และประเภทความพิการ ไม่ใช่จำนวนกิจกรรมหลัก ตัวอย่างเก่าอีก 10 รายการยังอยู่ในฐานข้อมูลแต่ปิดรับสมัครเมื่อไม่มีข้อมูล และซ่อนจากหน้ารายการตามค่าเริ่มต้น ไม่ลบรายการหรือคะแนนที่มีอยู่

## วิธีตรวจและข้อจำกัดของชุดทดสอบ

- ต้นฉบับบางตารางจัดช่องไม่ชัด และบางเลขหัวข้อซ้ำกัน จึงอ้างอิงข้อความคุณสมบัติและหัวข้อคะแนนของกิจกรรมนั้นร่วมกัน เช่น เรียงความสำหรับความบกพร่องทางร่างกายและออทิสติกใช้หัวข้อย่อยเลข 4.2 ซ้ำในต้นฉบับ แต่แยกเกณฑ์ตามประเภทไว้ในระบบ
- หมวดศูนย์การศึกษาพิเศษใช้เกณฑ์ออนไซต์ ส่วนออนไลน์ในเอกสารมีคณะกรรมการต่างจำนวนกัน จึงไม่ปะปนสองรูปแบบ
- กิจกรรมที่ต้นฉบับไม่จำกัดระดับชั้น หรือวงดนตรีที่รวม ป.1–ม.3 ชุดนี้รับเฉพาะ ป.1–6 ตามขอบเขตที่ผู้จัดเลือก และแสดงหมายเหตุไว้ในรายการ
- จำนวนครูที่เอกสารไม่ระบุใช้ 1–2 คนเป็นค่าทดสอบ มีป้ายบอกชัดเจน ค่าที่ตรวจพบในเอกสารแสดงขั้นต่ำและสูงสุดตามข้อความนั้น
- ผู้ลงทะเบียนยืนยันคุณสมบัติ ผู้จัดตรวจหลักฐานและคุณวุฒิกรรมการก่อนอนุมัติ ไม่เก็บไฟล์หลักฐานความพิการหรือใบรับรองแพทย์ในระบบนี้
- การเทียบโรงเรียนใช้ชื่อที่ตัดช่องว่างและปรับ Unicode ไม่ใช่ทะเบียนรหัสโรงเรียน ผู้จัดต้องตรวจชื่อย่อ/ชื่อสะกดต่างกันเองก่อนมอบหมายกรรมการ
- ระบบเฉลี่ยคะแนนร้อยละของกรรมการที่ไม่มีส่วนได้เสียแต่ละทีม เกณฑ์ที่กำหนดหน้าที่กรรมการเฉพาะด้าน การประท้วง หรือการชี้ขาดคะแนนเสมอ ต้องดำเนินการตามเอกสารและลงข้อสรุปก่อนประกาศผล ขั้นตอนใหม่ใช้อันดับร่วมเมื่อคะแนนเสมอตามนโยบายการจัดอันดับของระบบ (ดู verified-workflow.md)
- คะแนนดิบเต็ม 20 แปลงเป็นร้อยละก่อนเฉลี่ย คะแนนหักมีเหตุผลกำกับ และกรณีตัดสิทธิ์มีผลตรวจของผู้จัดพร้อมเหตุผล ไม่ออก PDF ให้รายการที่ถูกตัดสิทธิ์
- เกณฑ์และคุณสมบัติถูกล็อกเมื่อมีทีมยืนยันสมัคร ใช้ “สร้างฉบับใหม่” เพื่อรับเกณฑ์ใหม่ โดยไม่เปลี่ยนรุ่นของข้อมูลเดิม วัน สถานที่ หัวข้อ/เพลงของปี 2569 และผู้ออกประกาศนียบัตรทางการยังต้องยืนยัน

## ทั่วไป — 50 รายการ

| รหัส | รายการ | ช่วงชั้น/อายุ | นักเรียน | ครู | คะแนนเต็มดิบ | กรรมการ | อ้างอิง |
|---|---|---|---|---|---|---|---|
| trial73-art-mixed1 | จิตรกรรมเทคนิคผสม (Mixed Media) | ป.1–3 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 2](https://drive.google.com/file/d/1MZYpe-dzfKFfCZ42Qmcc3FRRl5OHEsOl/view) |
| trial73-art-mixed4 | จิตรกรรมเทคนิคผสม (Mixed Media) | ป.4–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 2](https://drive.google.com/file/d/1MZYpe-dzfKFfCZ42Qmcc3FRRl5OHEsOl/view) |
| trial73-art-painting1 | วาดภาพระบายสี | ป.1–3 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 4](https://drive.google.com/file/d/1MZYpe-dzfKFfCZ42Qmcc3FRRl5OHEsOl/view) |
| trial73-art-painting4 | วาดภาพระบายสี | ป.4–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 4](https://drive.google.com/file/d/1MZYpe-dzfKFfCZ42Qmcc3FRRl5OHEsOl/view) |
| trial73-art-sketch4 | การออกแบบร่าง (SKETCH DESIGN) | ป.4–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 8](https://drive.google.com/file/d/1MZYpe-dzfKFfCZ42Qmcc3FRRl5OHEsOl/view) |
| trial73-art-sculpture1 | ประติมากรรม | ป.1–3 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 13](https://drive.google.com/file/d/1MZYpe-dzfKFfCZ42Qmcc3FRRl5OHEsOl/view) |
| trial73-art-sculpture4 | ประติมากรรม | ป.4–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 13](https://drive.google.com/file/d/1MZYpe-dzfKFfCZ42Qmcc3FRRl5OHEsOl/view) |
| trial73-career-natural | ประดิษฐ์ของใช้จากวัสดุธรรมชาติในท้องถิ่น | ป.4–6 | 3–3 | 2–2 | 100.0 | 5 | [หน้า 2](https://drive.google.com/file/d/1SMOBlR_V6EnZcSFMA0waQRVVtqF0rMsq/view) |
| trial73-career-bamboo | จักสานไม้ไผ่ | ป.4–6 | 3–3 | 2–2 | 100 | 5 | [หน้า 4](https://drive.google.com/file/d/1SMOBlR_V6EnZcSFMA0waQRVVtqF0rMsq/view) |
| trial73-career-flowers | ประดิษฐ์พานพุ่มสักการะ | ป.4–6 | 1–6 | 1–3 | 100.0 | 5 | [หน้า 6](https://drive.google.com/file/d/1SMOBlR_V6EnZcSFMA0waQRVVtqF0rMsq/view) |
| trial73-career-project | โครงงานอาชีพ | ป.4–6 | 3–3 | 2–2 | 100.0 | 5 | [หน้า 11](https://drive.google.com/file/d/1SMOBlR_V6EnZcSFMA0waQRVVtqF0rMsq/view) |
| trial73-career-garden | จัดสวนถาดแบบแห้ง | ป.4–6 | 3–3 | 2–2 | 100.0 | 5 | [หน้า 13](https://drive.google.com/file/d/1SMOBlR_V6EnZcSFMA0waQRVVtqF0rMsq/view) |
| trial73-career-food-processing | แปรรูปอาหาร | ป.4–6 | 3–3 | 2–2 | 100.0 | 5 | [หน้า 18](https://drive.google.com/file/d/1SMOBlR_V6EnZcSFMA0waQRVVtqF0rMsq/view) |
| trial73-career-cooking | ทำอาหาร น้ำพริก ผักสด เครื่องเคียง | ป.4–6 | 3–3 | 2–2 | 100.0 | 5 | [หน้า 21](https://drive.google.com/file/d/1SMOBlR_V6EnZcSFMA0waQRVVtqF0rMsq/view) |
| trial73-career-healthy-food | ทำอาหารคาวหวานเพื่อสุขภาพเชิงธุรกิจ | ป.4–6 | 3–3 | 2–2 | 100.0 | 5 | [หน้า 24](https://drive.google.com/file/d/1SMOBlR_V6EnZcSFMA0waQRVVtqF0rMsq/view) |
| trial73-career-carving | แกะสลักผักและผลไม้พร้อมรับประทาน | ป.4–6 | 3–3 | 1–2 | 100.0 | 5 | [หน้า 27](https://drive.google.com/file/d/1SMOBlR_V6EnZcSFMA0waQRVVtqF0rMsq/view) |
| trial73-music-solo1 | เดี่ยวระนาดเอก | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 3](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-solo2 | เดี่ยวระนาดทุ้ม | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 3](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-solo3 | เดี่ยวฆ้องวงใหญ่ | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 3](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-solo4 | เดี่ยวฆ้องวงเล็ก | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 3](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-solo5 | เดี่ยวซอด้วง | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 3](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-solo6 | เดี่ยวซออู้ | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 3](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-solo7 | เดี่ยวจะเข้ | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 3](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-solo8 | เดี่ยวขิม 7 หย่อง | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 3](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-solo9 | เดี่ยวขลุ่ยเพียงออ | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 3](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-thai-song | ขับร้องเพลงไทย | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 6](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-country-male | ขับร้องเพลงไทยลูกทุ่ง — ชาย | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 9](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-country-female | ขับร้องเพลงไทยลูกทุ่ง — หญิง | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 9](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-urban-male | ขับร้องเพลงไทยลูกกรุง — ชาย | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 9](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-urban-female | ขับร้องเพลงไทยลูกกรุง — หญิง | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 9](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-flute | ขลุ่ยเพียงออหมู่ | ป.1–6 | 10–10 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 11](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-strings-khim | วงเครื่องสายผสมขิม | ป.1–6 | 8–9 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 11](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-strings-piphat | วงเครื่องสายผสมปี่พาทย์ | ป.1–6 | 15–15 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 11](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-piphat | วงปี่พาทย์ไม้แข็ง | ป.1–6 | 12–12 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 11](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-winds | วงดุริยางค์เครื่องลม (Winds) | ป.1–6 | 17–100 | 1–2 (ค่าทดสอบ) | 100.0 | 5 | [หน้า 15](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-contemporary | วงดนตรีร่วมสมัย | ป.1–6 | 1–25 | 1–2 (ค่าทดสอบ) | 100.0 | 5 | [หน้า 18](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-ensemble | วงดนตรีสากลเครื่องผสม | ป.1–6 | 3–16 | 1–2 (ค่าทดสอบ) | 100.0 | 5 | [หน้า 21](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-music-chorus | ขับร้องประสานเสียง | ป.1–6 | 16–40 | 1–2 (ค่าทดสอบ) | 100.0 | 5 | [หน้า 24](https://drive.google.com/file/d/127mWEL8u16zotZTKgTCEWbiWfIAku71U/view) |
| trial73-computer-graphics | การสร้างการ์ตูนด้วยโปรแกรมคอมพิวเตอร์กราฟิก | ป.1–3 | 2–2 | 1–2 (ค่าทดสอบ) | 100.0 | 1/2/3/4/5 | [หน้า 2](https://drive.google.com/file/d/1TJNjVdUL8jYz_rVaNXsGUJ-jUBcMeI_6/view) |
| trial73-computer-comic | การสร้างการ์ตูนเรื่องสั้น (Comic Strip) | ป.4–6 | 2–2 | 1–2 (ค่าทดสอบ) | 100.0 | 1/2/3/4/5 | [หน้า 4](https://drive.google.com/file/d/1TJNjVdUL8jYz_rVaNXsGUJ-jUBcMeI_6/view) |
| trial73-dance-standard | รำหรือระบำมาตรฐาน | ป.1–6 | 6–10 | 1–2 (ค่าทดสอบ) | 100.0 | 3/4/5 | [หน้า 2](https://drive.google.com/file/d/181Qj3P40w441HYFvKqvAk5OKYpPr8PlW/view) |
| trial73-dance-conserve | นาฏศิลป์ไทยอนุรักษ์ (ชุดอื่น) | ป.1–6 | 8–10 | 1–2 (ค่าทดสอบ) | 100.0 | 3/4/5 | [หน้า 5](https://drive.google.com/file/d/181Qj3P40w441HYFvKqvAk5OKYpPr8PlW/view) |
| trial73-dance-sawasdi | นาฏศิลป์ไทยอนุรักษ์ ระบำสวัสดิรักษา | ป.1–6 | 7–7 | 1–2 (ค่าทดสอบ) | 100.0 | 3/4/5 | [หน้า 5](https://drive.google.com/file/d/181Qj3P40w441HYFvKqvAk5OKYpPr8PlW/view) |
| trial73-dance-creative | นาฏศิลป์ไทยสร้างสรรค์ | ป.1–6 | 8–12 | 1–2 (ค่าทดสอบ) | 100.0 | 3/4/5 | [หน้า 8](https://drive.google.com/file/d/181Qj3P40w441HYFvKqvAk5OKYpPr8PlW/view) |
| trial73-dance-circle | รำวงมาตรฐาน | ป.1–6 | 10–10 | 1–2 (ค่าทดสอบ) | 100.0 | 3/4/5 | [หน้า 12](https://drive.google.com/file/d/181Qj3P40w441HYFvKqvAk5OKYpPr8PlW/view) |
| trial73-book-small-book | การจัดทำหนังสือเล่มเล็ก | ป.4–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3/5 | [หน้า 2](https://drive.google.com/file/d/1pyYQY-3bRBDZfFn6KMVlX7NoihF9KX3e/view) |
| trial73-health-aerobic | การแข่งขันแอโรบิก | ป.1–6 | 10–10 | 1–3 | 100 | 5 | [หน้า 2](https://drive.google.com/file/d/1Nwu5V6qqjuZ8IdSkC1Ecz04a7OOCzBi8/view) |
| trial73-health-kita | การแข่งขันคีตะมวยไทย | ป.1–6 | 7–10 | 1–3 | 100.0 | 5 | [หน้า 5](https://drive.google.com/file/d/1Nwu5V6qqjuZ8IdSkC1Ecz04a7OOCzBi8/view) |
| trial73-health-kitasin | การประกวดคีตศิลป์มวยไทย | ป.1–6 | 10–15 | 1–2 (ค่าทดสอบ) | 100.0 | 5 | [หน้า 9](https://drive.google.com/file/d/1Nwu5V6qqjuZ8IdSkC1Ecz04a7OOCzBi8/view) |
| trial73-film-short-film | การประกวดภาพยนตร์สั้น | ป.1–6 | 5–5 | 2–2 | 100.0 | 5 | [หน้า 2](https://drive.google.com/file/d/1NptYM8lIpX1wdtmNcP6FtGsZgAATYbQ9/view) |

## โรงเรียนเรียนรวม — 27 รายการ

| รหัส | รายการ | ช่วงชั้น/อายุ | นักเรียน | ครู | คะแนนเต็มดิบ | กรรมการ | อ้างอิง |
|---|---|---|---|---|---|---|---|
| trial73-inclusive-1-VI | การประกวดการขับร้องเพลงไทยลูกทุ่ง (บกพร่องทางการเห็น) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 7](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-1-ID | การประกวดการขับร้องเพลงไทยลูกทุ่ง (บกพร่องทางสติปัญญา) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 7](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-1-PH | การประกวดการขับร้องเพลงไทยลูกทุ่ง (บกพร่องทางร่างกาย) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 7](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-1-LD | การประกวดการขับร้องเพลงไทยลูกทุ่ง (บกพร่องทางการเรียนรู้) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 7](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-1-AU | การประกวดการขับร้องเพลงไทยลูกทุ่ง (ออทิสติก) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 7](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-2-LD | การแข่งขันการเต้นหางเครื่องประกอบเพลง (บกพร่องทางการเรียนรู้) | ป.1–6 | 5–7 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 9](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-3-ID | การแข่งขันการประดิษฐ์งานใบตอง ประเภทบายศรีปากชาม (บกพร่องทางสติปัญญา) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 11](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-3-LD | การแข่งขันการประดิษฐ์งานใบตอง ประเภทบายศรีปากชาม (บกพร่องทางการเรียนรู้) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 11](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-4-ID | การแข่งขันการประดิษฐ์ของใช้ จากเศษวัสดุเหลือใช้ (บกพร่องทางสติปัญญา) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 13](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-4-LD | การแข่งขันการประดิษฐ์ของใช้ จากเศษวัสดุเหลือใช้ (บกพร่องทางการเรียนรู้) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 13](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-5-ID | การแข่งขันการประดิษฐ์ของเล่น จากเศษวัสดุเหลือใช้ (บกพร่องทางสติปัญญา) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 15](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-5-LD | การแข่งขันการประดิษฐ์ของเล่น จากเศษวัสดุเหลือใช้ (บกพร่องทางการเรียนรู้) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 15](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-6-ID | การแข่งขันการร้อยมาลัยดอกไม้สด (บกพร่องทางสติปัญญา) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 17](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-6-LD | การแข่งขันการร้อยมาลัยดอกไม้สด (บกพร่องทางการเรียนรู้) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 17](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-7-LD | การแข่งขันการจัดสวนถาดแบบชื้น (บกพร่องทางการเรียนรู้) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 19](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-8-LD | การแข่งขันการจัดสวนถาดแบบแห้ง (บกพร่องทางการเรียนรู้) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 21](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-9-HI | การแข่งขันการวาดภาพระบายสี (บกพร่องทางการได้ยิน) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 23](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-9-ID | การแข่งขันการวาดภาพระบายสี (บกพร่องทางสติปัญญา) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 23](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-9-PH | การแข่งขันการวาดภาพระบายสี (บกพร่องทางร่างกาย) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 23](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-9-LD | การแข่งขันการวาดภาพระบายสี (บกพร่องทางการเรียนรู้) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 23](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-9-AU | การแข่งขันการวาดภาพระบายสี (ออทิสติก) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 23](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-10-LD | การแข่งขันการจัดทาหนังสือเล่มเล็ก (บกพร่องทางการเรียนรู้) | ป.4–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 25](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-11-HI | การประกวดมารยาทงามอย่างไทย (บกพร่องทางการได้ยิน) | ป.1–6 | 2–2 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 27](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-11-ID | การประกวดมารยาทงามอย่างไทย (บกพร่องทางสติปัญญา) | ป.1–6 | 2–2 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 27](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-11-LD | การประกวดมารยาทงามอย่างไทย (บกพร่องทางการเรียนรู้) | ป.1–6 | 2–2 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 27](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-12-ID | การแข่งขันการทาอาหาร (บกพร่องทางสติปัญญา) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 29](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |
| trial73-inclusive-12-LD | การแข่งขันการทาอาหาร (บกพร่องทางการเรียนรู้) | ป.1–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 29](https://drive.google.com/file/d/1KcbQ4NpY7bBN_twRqaTulrP_IBVU2Q_J/view) |

## โรงเรียนเฉพาะความพิการ — 82 รายการ

| รหัส | รายการ | ช่วงชั้น/อายุ | นักเรียน | ครู | คะแนนเต็มดิบ | กรรมการ | อ้างอิง |
|---|---|---|---|---|---|---|---|
| trial73-disability-1-VI-1 | การแข่งขันเขียนตามคาบอก (บกพร่องทางการเห็น) | ป.1–6 | 1–1 | 1–1 | 100 | 3 | [หน้า 7](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-1-AU-1 | การแข่งขันเขียนตามคาบอก (ออทิสติก) | ป.1–6 | 1–1 | 1–1 | 100 | 3 | [หน้า 7](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-2-VI-1 | การแข่งขันเขียนเรียงความ (บกพร่องทางการเห็น) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 8](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-2-PH-1 | การแข่งขันเขียนเรียงความ (บกพร่องทางร่างกาย) | ป.1–6 | 1–1 | 1–1 | 100 | 3 | [หน้า 8](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-2-AU-1 | การแข่งขันเขียนเรียงความ (ออทิสติก) | ป.1–6 | 1–1 | 1–1 | 100 | 3 | [หน้า 8](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-3-HI-1 | การประกวดคัดลายมือ (บกพร่องทางการได้ยิน) | ป.1–6 | 1–1 | 1–1 | 100 | 3 | [หน้า 11](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-3-PH-1 | การประกวดคัดลายมือ (บกพร่องทางร่างกาย) | ป.1–6 | 1–1 | 1–1 | 100 | 3 | [หน้า 11](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-3-ID-1 | การประกวดคัดลายมือ (บกพร่องทางสติปัญญา) | ป.1–6 | 1–1 | 1–1 | 100 | 3 | [หน้า 11](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-3-AU-1 | การประกวดคัดลายมือ (ออทิสติก) | ป.1–6 | 1–1 | 1–1 | 100 | 3 | [หน้า 11](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-4-HI-1 | การแข่งขันเล่าเรื่องด้วยภาษามือ (บกพร่องทางการได้ยิน) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 13](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-5-PH-1 | การแข่งขันการเล่านิทาน/การเล่าเรื่อง (บกพร่องทางร่างกาย) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 14](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-5-AU-1 | การแข่งขันการเล่านิทาน/การเล่าเรื่อง (ออทิสติก) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 14](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-6-PH-1 | การแข่งขันอ่านทานองเสนาะ (บกพร่องทางร่างกาย) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 15](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-6-VI-1 | การแข่งขันอ่านทานองเสนาะ (บกพร่องทางการเห็น) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 15](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-7-VI-1 | การแข่งขันศาสตร์คณิตในชีวิตประจาวัน (บกพร่องทางการเห็น) | ป.1–3 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 18](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-7-VI-4 | การแข่งขันศาสตร์คณิตในชีวิตประจาวัน (บกพร่องทางการเห็น) | ป.4–6 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 18](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-7-AU-1 | การแข่งขันศาสตร์คณิตในชีวิตประจาวัน (ออทิสติก) | ป.1–3 | 3–3 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 18](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-8-HI-1 | การแข่งขันศาสตร์คณิตในชีวิตประจาวัน (คณิตคิดเร็ว) (บกพร่องทางการได้ยิน) | ป.1–3 | 1–1 | 1–2 (ค่าทดสอบ) | 20 | 3 | [หน้า 19](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-8-HI-4 | การแข่งขันศาสตร์คณิตในชีวิตประจาวัน (คณิตคิดเร็ว) (บกพร่องทางการได้ยิน) | ป.4–6 | 1–1 | 1–2 (ค่าทดสอบ) | 20 | 3 | [หน้า 19](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-9-HI-1 | การประกวดโครงงานวิทยาศาสตร์ (ประเภทโครงงานประดิษฐ์) (บกพร่องทางการได้ยิน) | ป.1–6 | 3–3 | 1–1 | 100.0 | 3/5 | [หน้า 21](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-13-HI-1 | การแข่งขันวาดภาพด้วยโปรแกรม Paint (บกพร่องทางการได้ยิน) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 27](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-13-PH-1 | การแข่งขันวาดภาพด้วยโปรแกรม Paint (บกพร่องทางร่างกาย) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 27](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-13-AU-1 | การแข่งขันวาดภาพด้วยโปรแกรม Paint (ออทิสติก) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 27](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-15-HI-1 | การประกวดมารยาทงามอย่างไทย (บกพร่องทางการได้ยิน) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3/5 | [หน้า 31](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-15-ID-1 | การประกวดมารยาทงามอย่างไทย (บกพร่องทางสติปัญญา) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3/5 | [หน้า 31](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-15-VI-1 | การประกวดมารยาทงามอย่างไทย (บกพร่องทางการเห็น) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3/5 | [หน้า 31](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-15-AU-1 | การประกวดมารยาทงามอย่างไทย (ออทิสติก) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3/5 | [หน้า 31](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-16-HI-1 | การแข่งขันการแสดงละครคุณธรรม (บกพร่องทางการได้ยิน) | ป.1–6 | 15–15 | 4–4 | 100.0 | 3/5 | [หน้า 32](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-16-ID-1 | การแข่งขันการแสดงละครคุณธรรม (บกพร่องทางสติปัญญา) | ป.1–6 | 15–15 | 4–4 | 100.0 | 3/5 | [หน้า 32](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-17-HI-1 | การแข่งขันเชียร์ลีดเดอร์ (บกพร่องทางการได้ยิน) | ป.1–6 | 12–12 | 4–4 | 100.0 | 3/5 | [หน้า 35](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-18-HI-1 | การแข่งขันการเต้นแอโรบิค (บกพร่องทางการได้ยิน) | ป.1–6 | 8–8 | 3–3 | 100.0 | 3/5 | [หน้า 36](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-18-ID-1 | การแข่งขันการเต้นแอโรบิค (บกพร่องทางสติปัญญา) | ป.1–6 | 8–8 | 3–3 | 100.0 | 3/5 | [หน้า 36](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-18-VI-1 | การแข่งขันการเต้นแอโรบิค (บกพร่องทางการเห็น) | ป.1–6 | 8–8 | 3–3 | 100.0 | 3/5 | [หน้า 36](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-18-AU-1 | การแข่งขันการเต้นแอโรบิค (ออทิสติก) | ป.1–6 | 5–8 | 3–3 | 100.0 | 3/5 | [หน้า 36](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-19-PH-1 | การแข่งขันการเต้นแอโรบิครถเข็น (บกพร่องทางร่างกาย) | ป.1–6 | 8–8 | 3–3 | 100.0 | 3 | [หน้า 38](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-20-HI-1 | การแข่งขันจินตลีลาเพลงภาษามือ (บกพร่องทางการได้ยิน) | ป.1–6 | 7–7 | 3–3 | 100.0 | 5 | [หน้า 40](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-21-HI-1 | การแข่งขันการเต้นหางเครื่องประกอบเพลง (บกพร่องทางการได้ยิน) | ป.1–6 | 8–8 | 1–1 | 100.0 | 3 | [หน้า 41](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-21-ID-1 | การแข่งขันการเต้นหางเครื่องประกอบเพลง (บกพร่องทางสติปัญญา) | ป.1–6 | 8–8 | 1–1 | 100.0 | 3 | [หน้า 41](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-21-VI-1 | การแข่งขันการเต้นหางเครื่องประกอบเพลง (บกพร่องทางการเห็น) | ป.1–6 | 8–8 | 1–1 | 100.0 | 3 | [หน้า 41](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-21-AU-1 | การแข่งขันการเต้นหางเครื่องประกอบเพลง (ออทิสติก) | ป.1–6 | 5–8 | 1–1 | 100.0 | 3 | [หน้า 41](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-22-VI-1 | การแข่งขันดนตรีโฟล์คซอง (บกพร่องทางการเห็น) | ป.1–6 | 3–3 | 1–1 | 100.0 | 3 | [หน้า 42](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-22-PH-1 | การแข่งขันดนตรีโฟล์คซอง (บกพร่องทางร่างกาย) | ป.1–6 | 3–3 | 1–1 | 100.0 | 3 | [หน้า 42](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-23-HI-1 | การแข่งขันรวมพลังศิลป์สร้างสรรค์ (บกพร่องทางการได้ยิน) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3/5 | [หน้า 44](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-24-HI-4 | การแข่งขันวาดภาพด้วยสีชอล์ค (บกพร่องทางการได้ยิน) | ป.4–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 46](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-24-PH-4 | การแข่งขันวาดภาพด้วยสีชอล์ค (บกพร่องทางร่างกาย) | ป.4–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 46](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-24-ID-1 | การแข่งขันวาดภาพด้วยสีชอล์ค (บกพร่องทางสติปัญญา) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 46](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-24-AU-1 | การแข่งขันวาดภาพด้วยสีชอล์ค (ออทิสติก) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 46](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-25-AU-1 | การแข่งขันวาดภาพระบายสี (สีไม้/สีชอล์ค) (ออทิสติก) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 47](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-26-PH-4 | การแข่งขันวาดภาพระบายสี (สีโปสเตอร์) (บกพร่องทางร่างกาย) | ป.4–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 49](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-26-ID-1 | การแข่งขันวาดภาพระบายสี (สีโปสเตอร์) (บกพร่องทางสติปัญญา) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 49](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-26-HI-1 | การแข่งขันวาดภาพระบายสี (สีโปสเตอร์) (บกพร่องทางการได้ยิน) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 49](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-26-AU-1 | การแข่งขันวาดภาพระบายสี (สีโปสเตอร์) (ออทิสติก) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 49](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-28-HI-1 | การแข่งขันราวงมาตรฐาน (บกพร่องทางการได้ยิน) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3/5 | [หน้า 52](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-28-ID-1 | การแข่งขันราวงมาตรฐาน (บกพร่องทางสติปัญญา) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3/5 | [หน้า 52](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-28-VI-1 | การแข่งขันราวงมาตรฐาน (บกพร่องทางการเห็น) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3/5 | [หน้า 52](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-28-AU-1 | การแข่งขันราวงมาตรฐาน (ออทิสติก) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3/5 | [หน้า 52](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-29-HI-1 | การแข่งขันประติมากรรมลอยตัว (บกพร่องทางการได้ยิน) | ป.1–6 | 3–3 | 2–2 | 100.0 | 3/5 | [หน้า 53](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-30-HI-1 | การแข่งขันการแสดงอังกะลุง (บกพร่องทางการได้ยิน) | ป.1–6 | 8–8 | 3–3 | 100.0 | 3/5 | [หน้า 55](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-31-ID-1 | การประกวดร้องเพลงไทยลูกทุ่ง (บกพร่องทางสติปัญญา) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 56](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-31-PH-1 | การประกวดร้องเพลงไทยลูกทุ่ง (บกพร่องทางร่างกาย) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 56](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-31-VI-1 | การประกวดร้องเพลงไทยลูกทุ่ง (บกพร่องทางการเห็น) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 56](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-31-AU-1 | การประกวดร้องเพลงไทยลูกทุ่ง (ออทิสติก) | ป.1–6 | 1–1 | 1–2 (ค่าทดสอบ) | 100.0 | 3 | [หน้า 56](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-32-PH-1 | การแข่งขันราไทยประจาภาค (บกพร่องทางร่างกาย) | ป.1–6 | 5–5 | 2–2 | 100.0 | 3 | [หน้า 58](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-32-AU-1 | การแข่งขันราไทยประจาภาค (ออทิสติก) | ป.1–6 | 5–5 | 2–2 | 100.0 | 3 | [หน้า 58](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-33-PH-1 | การแข่งขันการประดิษฐ์ของใช้จากเศษวัสดุเหลือใช้ (บกพร่องทางร่างกาย) | ป.1–6 | 3–3 | 2–2 | 100.0 | 3 | [หน้า 60](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-33-ID-1 | การแข่งขันการประดิษฐ์ของใช้จากเศษวัสดุเหลือใช้ (บกพร่องทางสติปัญญา) | ป.1–6 | 3–3 | 2–2 | 100.0 | 3 | [หน้า 60](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-33-VI-1 | การแข่งขันการประดิษฐ์ของใช้จากเศษวัสดุเหลือใช้ (บกพร่องทางการเห็น) | ป.1–6 | 3–3 | 2–2 | 100.0 | 3 | [หน้า 60](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-33-HI-1 | การแข่งขันการประดิษฐ์ของใช้จากเศษวัสดุเหลือใช้ (บกพร่องทางการได้ยิน) | ป.1–6 | 3–3 | 2–2 | 100.0 | 3 | [หน้า 60](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-33-AU-1 | การแข่งขันการประดิษฐ์ของใช้จากเศษวัสดุเหลือใช้ (ออทิสติก) | ป.1–6 | 3–3 | 2–2 | 100.0 | 3 | [หน้า 60](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-35-AU-1 | การแข่งขันทาอาหาร (ออทิสติก) | ป.1–6 | 3–3 | 2–2 | 100.0 | 3/5 | [หน้า 63](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-36-AU-1 | การแข่งขันการแกะสลักผัก/ผลไม้ (ออทิสติก) | ป.1–6 | 3–3 | 2–2 | 100.0 | 3 | [หน้า 65](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-37-AU-1 | การแข่งขันการร้อยมาลัยสองชาย (ออทิสติก) | ป.1–6 | 3–3 | 2–2 | 100.0 | 3 | [หน้า 67](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-38-HI-1 | การแข่งขันการจัดดอกไม้สด (บกพร่องทางการได้ยิน) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3 | [หน้า 68](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-38-PH-1 | การแข่งขันการจัดดอกไม้สด (บกพร่องทางร่างกาย) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3 | [หน้า 68](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-38-AU-1 | การแข่งขันการจัดดอกไม้สด (ออทิสติก) | ป.1–6 | 2–2 | 2–2 | 100.0 | 3 | [หน้า 68](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-39-HI-1 | การแข่งขันการจัดสวนถาดแบบแห้ง (บกพร่องทางการได้ยิน) | ป.1–6 | 3–3 | 2–2 | 100.0 | 5/7 | [หน้า 70](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-39-ID-1 | การแข่งขันการจัดสวนถาดแบบแห้ง (บกพร่องทางสติปัญญา) | ป.1–6 | 3–3 | 2–2 | 100.0 | 5/7 | [หน้า 70](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-39-PH-1 | การแข่งขันการจัดสวนถาดแบบแห้ง (บกพร่องทางร่างกาย) | ป.1–6 | 3–3 | 2–2 | 100.0 | 5/7 | [หน้า 70](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-39-AU-1 | การแข่งขันการจัดสวนถาดแบบแห้ง (ออทิสติก) | ป.1–6 | 3–3 | 2–2 | 100.0 | 5/7 | [หน้า 70](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-40-PH-1 | การแข่งขันพูดภาษาอังกฤษ (Impromptu Speech) (บกพร่องทางร่างกาย) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 73](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-40-VI-1 | การแข่งขันพูดภาษาอังกฤษ (Impromptu Speech) (บกพร่องทางการเห็น) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 73](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |
| trial73-disability-40-AU-1 | การแข่งขันพูดภาษาอังกฤษ (Impromptu Speech) (ออทิสติก) | ป.1–6 | 1–1 | 1–1 | 100.0 | 3 | [หน้า 73](https://drive.google.com/file/d/19w7AWQjQMlTtBMVVRokD03EMTcygFw-D/view) |

## ศูนย์การศึกษาพิเศษ อายุ 7–12 ปี — 38 รายการ

| รหัส | รายการ | ช่วงชั้น/อายุ | นักเรียน | ครู | คะแนนเต็มดิบ | กรรมการ | อ้างอิง |
|---|---|---|---|---|---|---|---|
| trial73-special-2-HI | การแข่งขันวาดภาพระบายสี (บกพร่องทางการได้ยิน) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 6](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-2-ID | การแข่งขันวาดภาพระบายสี (บกพร่องทางสติปัญญา) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 6](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-2-PH | การแข่งขันวาดภาพระบายสี (บกพร่องทางร่างกาย) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 6](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-2-SL | การแข่งขันวาดภาพระบายสี (บกพร่องทางการพูดและภาษา) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 6](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-2-BE | การแข่งขันวาดภาพระบายสี (บกพร่องทางพฤติกรรมหรืออารมณ์) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 6](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-2-AU | การแข่งขันวาดภาพระบายสี (ออทิสติก) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 6](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-2-MU | การแข่งขันวาดภาพระบายสี (พิการซ้อน) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 6](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-3-VI | การแข่งขันปั้นดินน้ามันตามที่กาหนด (บกพร่องทางการเห็น) | อายุ 7–12 ปี | 3–3 | 1–2 | 100.0 | 5 | [หน้า 7](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-3-HI | การแข่งขันปั้นดินน้ามันตามที่กาหนด (บกพร่องทางการได้ยิน) | อายุ 7–12 ปี | 3–3 | 1–2 | 100.0 | 5 | [หน้า 7](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-3-ID | การแข่งขันปั้นดินน้ามันตามที่กาหนด (บกพร่องทางสติปัญญา) | อายุ 7–12 ปี | 3–3 | 1–2 | 100.0 | 5 | [หน้า 7](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-3-PH | การแข่งขันปั้นดินน้ามันตามที่กาหนด (บกพร่องทางร่างกาย) | อายุ 7–12 ปี | 3–3 | 1–2 | 100.0 | 5 | [หน้า 7](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-3-SL | การแข่งขันปั้นดินน้ามันตามที่กาหนด (บกพร่องทางการพูดและภาษา) | อายุ 7–12 ปี | 3–3 | 1–2 | 100.0 | 5 | [หน้า 7](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-3-BE | การแข่งขันปั้นดินน้ามันตามที่กาหนด (บกพร่องทางพฤติกรรมหรืออารมณ์) | อายุ 7–12 ปี | 3–3 | 1–2 | 100.0 | 5 | [หน้า 7](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-3-AU | การแข่งขันปั้นดินน้ามันตามที่กาหนด (ออทิสติก) | อายุ 7–12 ปี | 3–3 | 1–2 | 100.0 | 5 | [หน้า 7](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-3-MU | การแข่งขันปั้นดินน้ามันตามที่กาหนด (พิการซ้อน) | อายุ 7–12 ปี | 3–3 | 1–2 | 100.0 | 5 | [หน้า 7](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-4-HI | การแข่งขันวาดภาพด้วยโปรแกรม Paint ตามจินตนาการ (บกพร่องทางการได้ยิน) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 8](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-4-ID | การแข่งขันวาดภาพด้วยโปรแกรม Paint ตามจินตนาการ (บกพร่องทางสติปัญญา) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 8](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-4-PH | การแข่งขันวาดภาพด้วยโปรแกรม Paint ตามจินตนาการ (บกพร่องทางร่างกาย) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 8](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-4-SL | การแข่งขันวาดภาพด้วยโปรแกรม Paint ตามจินตนาการ (บกพร่องทางการพูดและภาษา) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 8](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-4-BE | การแข่งขันวาดภาพด้วยโปรแกรม Paint ตามจินตนาการ (บกพร่องทางพฤติกรรมหรืออารมณ์) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 8](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-4-AU | การแข่งขันวาดภาพด้วยโปรแกรม Paint ตามจินตนาการ (ออทิสติก) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 8](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-4-MU | การแข่งขันวาดภาพด้วยโปรแกรม Paint ตามจินตนาการ (พิการซ้อน) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 8](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-5-VI | การประกวดร้องเพลง (บกพร่องทางการเห็น) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 9](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-5-ID | การประกวดร้องเพลง (บกพร่องทางสติปัญญา) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 9](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-5-PH | การประกวดร้องเพลง (บกพร่องทางร่างกาย) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 9](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-5-SL | การประกวดร้องเพลง (บกพร่องทางการพูดและภาษา) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 9](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-5-BE | การประกวดร้องเพลง (บกพร่องทางพฤติกรรมหรืออารมณ์) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 9](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-5-AU | การประกวดร้องเพลง (ออทิสติก) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 9](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-5-MU | การประกวดร้องเพลง (พิการซ้อน) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 9](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-6-all | การแข่งขันการเต้นหางเครื่องประกอบเพลง | อายุ 7–12 ปี | 3–5 | 1–2 | 100.0 | 5 | [หน้า 11](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-7-all | การประกวดมารยาทงามอย่างไทย (การไหว้) | อายุ 7–12 ปี | 2–2 | 1–2 | 100.0 | 5 | [หน้า 12](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-9-HI | การแข่งขัน การตอบคาตอบหมวดประเพณีวัฒนธรรมและวันสาคัญของไทย (บกพร่องทางการได้ยิน) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 15](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-9-ID | การแข่งขัน การตอบคาตอบหมวดประเพณีวัฒนธรรมและวันสาคัญของไทย (บกพร่องทางสติปัญญา) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 15](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-9-PH | การแข่งขัน การตอบคาตอบหมวดประเพณีวัฒนธรรมและวันสาคัญของไทย (บกพร่องทางร่างกาย) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 15](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-9-SL | การแข่งขัน การตอบคาตอบหมวดประเพณีวัฒนธรรมและวันสาคัญของไทย (บกพร่องทางการพูดและภาษา) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 15](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-9-BE | การแข่งขัน การตอบคาตอบหมวดประเพณีวัฒนธรรมและวันสาคัญของไทย (บกพร่องทางพฤติกรรมหรืออารมณ์) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 15](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-9-AU | การแข่งขัน การตอบคาตอบหมวดประเพณีวัฒนธรรมและวันสาคัญของไทย (ออทิสติก) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 15](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
| trial73-special-9-MU | การแข่งขัน การตอบคาตอบหมวดประเพณีวัฒนธรรมและวันสาคัญของไทย (พิการซ้อน) | อายุ 7–12 ปี | 1–1 | 1–1 | 100.0 | 5 | [หน้า 15](https://drive.google.com/file/d/1SqMnyKKvEKTwV70fED_-XzvPdfL2WD0X/view) |
