import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
export async function buildCertificate(c, fontBytes) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const latin = await pdf.embedFont(StandardFonts.Helvetica);
  const people = [
    ...c.students.map((s) => ({ ...s, kind: "student" })),
    ...c.coaches.map((s) => ({ ...s, kind: "coach" })),
  ];
  people.forEach((person, i) => {
    const page = pdf.addPage([842, 595]);
    const navy = rgb(0.06, 0.15, 0.32),
      blue = rgb(0.03, 0.35, 0.88);
    page.drawRectangle({
      x: 25,
      y: 25,
      width: 792,
      height: 545,
      borderWidth: 1,
      borderColor: rgb(0.73, 0.81, 0.92),
    });
    page.drawRectangle({
      x: 38,
      y: 38,
      width: 766,
      height: 519,
      borderWidth: 0.5,
      borderColor: rgb(0.86, 0.9, 0.96),
    });
    function centered(text, y, size = 19, color = navy, f = font) {
      let s = size;
      while (f.widthOfTextAtSize(text, s) > 730) s -= 0.5;
      page.drawText(text, {
        x: (842 - f.widthOfTextAtSize(text, s)) / 2,
        y,
        size: s,
        font: f,
        color,
      });
    }
    centered("ประกาศนียบัตร", 475, 42, blue);
    centered("งานศิลปหัตถกรรม ประจำปีการศึกษา 2569", 431, 23);
    centered("ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง", 398, 20);
    centered("มอบประกาศนียบัตรฉบับนี้เพื่อแสดงว่า", 345, 16);
    centered(person.name, 298, 29, blue);
    centered(c.school, 262, 19);
    centered(
      person.kind === "coach"
        ? "ครูผู้ฝึกซ้อมผู้เข้าแข่งขัน"
        : "ได้เข้าร่วมการแข่งขันและได้รับรางวัล",
      223,
      17,
    );
    centered(c.medal, 187, 24);
    centered(c.title + " " + c.grade, 151, 18);
    centered("คะแนน " + Number(c.score).toFixed(2) + " / 100", 116, 16);
    page.drawText(c.number + "-" + (i + 1), {
      x: 58,
      y: 59,
      size: 10,
      font: latin,
      color: navy,
    });
    centered(
      c.demo
        ? "ข้อมูลตัวอย่าง — ยังไม่ใช่ประกาศนียบัตรทางการ"
        : "ออกโดยระบบหลังผู้จัดยืนยันผลการแข่งขัน",
      61,
      11,
    );
  });
  return pdf.save();
}
