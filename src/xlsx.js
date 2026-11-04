// Minimal XLSX read/write for the team-registration template (1 file = 1 team).
// No dependency: writes a stored (uncompressed) ZIP, reads stored/deflate ZIPs
// via DecompressionStream. ID-card images are never part of the file.

const enc = new TextEncoder(),
  dec = new TextDecoder();

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++)
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStored(files) {
  const parts = [],
    central = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = enc.encode(name),
      data = typeof content === "string" ? enc.encode(content) : content,
      crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const a of all) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(buffer) {
  const bytes = new Uint8Array(buffer),
    view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error("ไฟล์ไม่ใช่ .xlsx");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("ไฟล์เสียหาย");
    const method = view.getUint16(p + 10, true),
      size = view.getUint32(p + 20, true),
      nameLen = view.getUint16(p + 28, true),
      extraLen = view.getUint16(p + 30, true),
      commentLen = view.getUint16(p + 32, true),
      local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.(xml|rels)$/.test(name)) continue;
    const start =
      local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    if (method === 0) files.set(name, dec.decode(raw));
    else if (method === 8) files.set(name, dec.decode(await inflateRaw(raw)));
  }
  return files;
}

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const unesc = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
const textOf = (xml) =>
  [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)]
    .map((m) => unesc(m[1]))
    .join("");
const colIndex = (ref) => {
  const letters = /^[A-Z]+/.exec(ref)?.[0] || "";
  let n = 0;
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};
const colName = (i) => {
  let s = "";
  for (i++; i > 0; i = Math.floor((i - 1) / 26))
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};

/** Returns rows (array of arrays of strings) of the first worksheet. */
export async function readFirstSheet(buffer) {
  const files = await unzip(buffer);
  const shared = [];
  const sst = files.get("xl/sharedStrings.xml");
  if (sst)
    for (const m of sst.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g))
      shared.push(textOf(m[1].replace(/<(?:\w+:)?rPh[\s\S]*?<\/(?:\w+:)?rPh>/g, "")));
  let path = null;
  const wb = files.get("xl/workbook.xml"),
    rels = files.get("xl/_rels/workbook.xml.rels");
  const rid = wb && /<(?:\w+:)?sheet\b[^>]*\br:id="([^"]+)"/.exec(wb)?.[1];
  if (rid && rels) {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)]
      .map((m) => m[0])
      .find((r) => r.includes('Id="' + rid + '"'));
    const target = rel && /Target="([^"]+)"/.exec(rel)?.[1];
    if (target)
      path = target.startsWith("/")
        ? target.slice(1)
        : "xl/" + target.replace(/^\.\//, "");
  }
  if (!path || !files.has(path))
    path = [...files.keys()].filter((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort()[0];
  const sheet = path && files.get(path);
  if (!sheet) throw new Error("ไม่พบแผ่นงานในไฟล์");
  const rows = [];
  let rowNo = 0;
  for (const rm of sheet.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const r = /\br="(\d+)"/.exec(rm[1]);
    rowNo = r ? Number(r[1]) : rowNo + 1;
    const row = [];
    let col = -1;
    for (const cm of (rm[2] || "").matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const ref = /\br="([A-Z]+)\d*"/.exec(cm[1]);
      col = ref ? colIndex(ref[1]) : col + 1;
      const type = /\bt="(\w+)"/.exec(cm[1])?.[1],
        body = cm[2] || "";
      const v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (v != null) value = unesc(v);
      row[col] = value.trim();
    }
    rows[rowNo - 1] = Array.from(row, (x) => x ?? "");
  }
  return Array.from(rows, (x) => x ?? []);
}

// ---- Template ----
const STUDENT_ROWS = 20;
const HEADERS = ["ลำดับ", "ชื่อ", "นามสกุล", "ชั้น", "เพศ", "โรงเรียน"];
const LABELS = {
  coach1: "ครูผู้ฝึกซ้อมคนที่ 1",
  coach2: "ครูผู้ฝึกซ้อมคนที่ 2",
  coach3: "ครูผู้ฝึกซ้อมคนที่ 3",
  work: "ลิงก์ผลงาน HTTPS (ถ้ารายการกำหนด)",
  variant: "ชุดการแสดง (ถ้ารายการกำหนด)",
};

export function buildTemplate() {
  const rows = [
    [{ v: "แบบฟอร์มลงทะเบียนแข่งขัน งานศิลปหัตถกรรม (1 ไฟล์ = 1 ทีม)", s: 1 }],
    [
      "กรอกข้อมูลแล้วกด “นำเข้า xlsx” บนรายการแข่งขันที่ต้องการ จากนั้นแนบภาพบัตรประชาชนรายคนในหน้าเว็บก่อนส่ง",
    ],
    ["ชั้น เช่น ป.4 · เพศ ชาย/หญิง (กรอกเฉพาะรายการที่กำหนดประเภท) · เว้นโรงเรียนว่างได้ ระบบใช้โรงเรียนของผู้ฝึกซ้อม"],
    [],
    [{ v: LABELS.coach1, s: 1 }],
    [{ v: LABELS.coach2, s: 1 }],
    [{ v: LABELS.coach3, s: 1 }],
    [{ v: LABELS.work, s: 1 }],
    [{ v: LABELS.variant, s: 1 }],
    [],
    HEADERS.map((v) => ({ v, s: 2 })),
    ...Array.from({ length: STUDENT_ROWS }, (_, i) => [{ v: i + 1, n: true }]),
  ];
  const first = 12,
    last = first + STUDENT_ROWS - 1;
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          const cellObj = typeof cell === "object" ? cell : { v: cell };
          const ref = colName(c) + (r + 1),
            s = cellObj.s ? ` s="${cellObj.s}"` : "";
          return cellObj.n
            ? `<c r="${ref}"${s}><v>${cellObj.v}</v></c>`
            : `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(cellObj.v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="3" width="22" customWidth="1"/><col min="4" max="5" width="10" customWidth="1"/><col min="6" max="6" width="34" customWidth="1"/></cols>' +
    `<sheetData>${sheetRows}</sheetData>` +
    '<mergeCells count="3"><mergeCell ref="A1:F1"/><mergeCell ref="A2:F2"/><mergeCell ref="A3:F3"/></mergeCells>' +
    `<dataValidations count="1"><dataValidation type="list" allowBlank="1" sqref="E${first}:E${last}"><formula1>"ชาย,หญิง"</formula1></dataValidation></dataValidations>` +
    "</worksheet>";
  return zipStored([
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ],
    [
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ],
    [
      "xl/workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="ลงทะเบียน" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ],
    [
      "xl/_rels/workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ],
    [
      "xl/styles.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="12"/><name val="Tahoma"/></font><font><b/><sz val="12"/><name val="Tahoma"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEBFF"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" applyFont="1"/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    ],
    ["xl/worksheets/sheet1.xml", sheet],
  ]);
}

const norm = (s) => String(s || "").replace(/\s+/g, "");

/** Parse rows from the template into one team. */
export function parseTeam(rows) {
  const team = { coaches: [], work_url: "", variant: "", students: [] };
  let header = -1;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [],
      label = norm(row[0]);
    const cells = row.map(norm);
    if (cells.includes("ชื่อ") && cells.includes("นามสกุล")) {
      header = r;
      break;
    }
    const value = (row.slice(1).find((x) => x) || "").trim();
    if (!value) continue;
    if (label.startsWith("ครูผู้ฝึกซ้อม")) team.coaches.push({ name: value });
    else if (label.startsWith("ลิงก์ผลงาน")) team.work_url = value;
    else if (label.startsWith("ชุดการแสดง")) team.variant = value;
  }
  if (header < 0)
    throw new Error("ไม่พบหัวตาราง ชื่อ/นามสกุล ใช้ template จากระบบ");
  const cols = {};
  (rows[header] || []).forEach((h, i) => {
    const k = norm(h);
    if (k === "ชื่อ") cols.first_name = i;
    else if (k === "นามสกุล") cols.last_name = i;
    else if (k.startsWith("ชั้น")) cols.grade = i;
    else if (k.startsWith("เพศ") || k.startsWith("ประเภท")) cols.gender = i;
    else if (k.startsWith("โรงเรียน")) cols.school = i;
  });
  for (const row of rows.slice(header + 1)) {
    if (!row) continue;
    const get = (k) => (cols[k] == null ? "" : String(row[cols[k]] || "").trim());
    const s = {
      first_name: get("first_name"),
      last_name: get("last_name"),
      grade: get("grade"),
      gender: get("gender"),
      school: get("school"),
    };
    if (s.first_name || s.last_name) team.students.push(s);
  }
  if (!team.students.length) throw new Error("ไม่พบรายชื่อนักเรียนในไฟล์");
  return team;
}

export const normalizeGrade = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 3664))
    .replace(/\s+/g, "")
    .replace(/^ประถมศึกษาปีที่/, "ป.")
    .replace(/^ป(?=[1-6]$)/, "ป.")
    .replace(/^([1-6])$/, "ป.$1");

export const normalizeGender = (value) => {
  const v = norm(value);
  if (/^(ชาย|ช|ด\.ช\.?|เด็กชาย|male|m)$/i.test(v)) return "ชาย";
  if (/^(หญิง|ญ|ด\.ญ\.?|เด็กหญิง|female|f)$/i.test(v)) return "หญิง";
  return v;
};
