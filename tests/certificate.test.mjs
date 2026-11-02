import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { buildCertificate } from "../src/certificate-document.js";
test("Thai/Latin/digit font coverage and separate PDF pages for student and coach", async () => {
  const bytes = await readFile("public/fonts/noto-sans-thai-regular.ttf");
  const f = fontkit.create(bytes);
  for (const c of "เด็กหญิง กรรณิการ์ HC-12345 / 89.00")
    assert(f.hasGlyphForCodePoint(c.codePointAt(0)), c);
  const pdf = await buildCertificate(
    {
      students: [{ name: "เด็กหญิง ทดสอบ ระบบ" }],
      coaches: [{ name: "Teacher ทดสอบ" }],
      school: "โรงเรียนทดสอบ",
      title: "การวาดภาพระบายสี",
      grade: "ป.4–6",
      score: 89,
      medal: "เหรียญทอง",
      number: "HC-12345678",
      demo: true,
    },
    bytes,
  );
  const parsed = await PDFDocument.load(pdf);
  assert.equal(parsed.getPageCount(), 2);
  assert(pdf.length > 5000);
});
