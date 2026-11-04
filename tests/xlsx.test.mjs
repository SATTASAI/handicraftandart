import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import {
  buildTemplate,
  normalizeGender,
  normalizeGrade,
  parseTeam,
  readFirstSheet,
  unzip,
} from "../src/xlsx.js";

test("template is a readable xlsx with header and team labels", async () => {
  const bytes = buildTemplate();
  const files = await unzip(bytes);
  assert.ok(files.has("[Content_Types].xml"));
  assert.ok(files.has("xl/worksheets/sheet1.xml"));
  const rows = await readFirstSheet(bytes);
  assert.deepEqual(rows[10], ["ลำดับ", "ชื่อ", "นามสกุล", "ชั้น", "เพศ", "โรงเรียน"]);
  assert.throws(() => parseTeam(rows), /ไม่พบรายชื่อนักเรียน/);
});

// Build an Excel-like file: deflate, sharedStrings, workbook rels to sheet2.
function zipDeflate(entries) {
  const enc = new TextEncoder();
  const parts = [],
    central = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const n = enc.encode(name),
      data = deflateRawSync(enc.encode(text));
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(8, 8);
    l.writeUInt32LE(data.length, 18);
    l.writeUInt16LE(n.length, 26);
    parts.push(l, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central),
    e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(entries.length, 10);
  e.writeUInt32LE(cd.length, 12);
  e.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, e]);
}

test("reads deflated Excel output with shared strings", async () => {
  const strings = [
    "ครูผู้ฝึกซ้อมคนที่ 1",
    "ครูสมชาย ใจดี",
    "ลิงก์ผลงาน HTTPS",
    "https://example.com/a?x=1&y=2",
    "ชุดการแสดง",
    "ชุดที่ 2",
    "ลำดับ",
    "ชื่อ",
    "นามสกุล",
    "ชั้น",
    "เพศ",
    "โรงเรียน",
    "เด็กหญิง ก",
    "ทดสอบ",
    "ญ",
  ];
  const sst =
    '<sst xmlns="x">' +
    strings
      .map((s) => `<si><r><t>${s.replace(/&/g, "&amp;")}</t></r></si>`)
      .join("") +
    "</sst>";
  const c = (ref, i) => `<c r="${ref}" t="s"><v>${i}</v></c>`;
  const sheet =
    '<worksheet><sheetData>' +
    `<row r="2">${c("A2", 0)}${c("B2", 1)}</row>` +
    `<row r="3">${c("A3", 2)}${c("C3", 3)}</row>` +
    `<row r="4">${c("A4", 4)}${c("B4", 5)}</row>` +
    `<row r="6">${[6, 7, 8, 9, 10, 11].map((i, k) => c("ABCDEF"[k] + 6, i)).join("")}</row>` +
    `<row r="7"><c r="A7"><v>1</v></c>${c("B7", 12)}${c("C7", 13)}<c r="D7"><v>4</v></c>${c("E7", 14)}</row>` +
    '<row r="8"><c r="A8"><v>2</v></c></row>' +
    "</sheetData></worksheet>";
  const file = zipDeflate([
    [
      "xl/workbook.xml",
      '<workbook xmlns:r="r"><sheets><sheet name="A" sheetId="1" r:id="rId9"/></sheets></workbook>',
    ],
    [
      "xl/_rels/workbook.xml.rels",
      '<Relationships><Relationship Id="rId9" Type="ws" Target="worksheets/sheet2.xml"/></Relationships>',
    ],
    ["xl/sharedStrings.xml", sst],
    ["xl/worksheets/sheet2.xml", sheet],
  ]);
  const team = parseTeam(await readFirstSheet(file));
  assert.deepEqual(team.coaches, [{ name: "ครูสมชาย ใจดี" }]);
  assert.equal(team.work_url, "https://example.com/a?x=1&y=2");
  assert.equal(team.variant, "ชุดที่ 2");
  assert.deepEqual(team.students, [
    { first_name: "เด็กหญิง ก", last_name: "ทดสอบ", grade: "4", gender: "ญ", school: "" },
  ]);
  assert.equal(normalizeGrade("4"), "ป.4");
  assert.equal(normalizeGrade("ประถมศึกษาปีที่ ๖"), "ป.6");
  assert.equal(normalizeGender("ญ"), "หญิง");
  assert.equal(normalizeGender("ด.ช."), "ชาย");
});

test("rejects non-zip input", async () => {
  await assert.rejects(readFirstSheet(new TextEncoder().encode("hello")), /xlsx/);
});
