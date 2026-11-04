// Draws certificates on canvas (browser Thai fonts) and packs JPEG pages into a PDF.
// ฟอนต์ฝังในระบบ (OFL): Charm สำหรับหัวเรื่อง/ชื่อ, Taviraj สำหรับเนื้อความ
const FONT = "CertTaviraj, Thonburi, 'Noto Serif Thai', Tahoma, serif";
const SCRIPT = "CertCharm, " + FONT;
const FONT_FILES = [
  ["CertTaviraj", "/fonts/Taviraj-Regular.woff", "400"],
  ["CertTaviraj", "/fonts/Taviraj-DemiBold.woff", "600"],
  ["CertTaviraj", "/fonts/Taviraj-Bold.woff", "700"],
  ["CertCharm", "/fonts/Charm-Bold.woff2", "700"],
];
let fontsReady;
function loadFonts() {
  if (!fontsReady && typeof FontFace !== "undefined")
    fontsReady = Promise.all(
      FONT_FILES.map(([family, url, weight]) =>
        new FontFace(family, `url(${url})`, { weight })
          .load()
          .then((f) => document.fonts.add(f))
          .catch(() => {}),
      ),
    );
  return fontsReady;
}
const W = 1754,
  H = 1240; // A4 landscape, 150 dpi
const NAVY = "#1b2d52",
  NAVY_SOFT = "#3d4f73",
  GOLD = "#b8933a",
  GOLD_SOFT = "#e6d6ad",
  PAPER = "#fdfbf6";
const medalColors = {
  เหรียญทอง: "#a8801f",
  เหรียญเงิน: "#6f7884",
  เหรียญทองแดง: "#9a5a34",
  เข้าร่วม: NAVY_SOFT,
};

const withSchool = (s) =>
  !s ? "" : /^(โรงเรียน|รร\.)/.test(s.trim()) ? s.trim() : "โรงเรียน" + s.trim();

function spacing(ctx, px) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px";
}

function line(ctx, text, y, size, weight = 400, color = NAVY_SOFT, maxW = W - 420, track = 0, family = FONT) {
  if (!text) return;
  let s = size;
  spacing(ctx, track);
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxW && s > 16);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, y);
  spacing(ctx, 0);
}

function diamond(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// เส้นคั่นทองตรงกลาง: เส้น — ข้าวหลามตัด — เส้น
function divider(ctx, y, half = 170) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(W / 2 - half, y);
  ctx.lineTo(W / 2 - 22, y);
  ctx.moveTo(W / 2 + 22, y);
  ctx.lineTo(W / 2 + half, y);
  ctx.stroke();
  ctx.lineWidth = 2;
  diamond(ctx, W / 2, y, 10, null, GOLD);
  diamond(ctx, W / 2, y, 4, GOLD);
  diamond(ctx, W / 2 - half - 10, y, 3.5, GOLD);
  diamond(ctx, W / 2 + half + 10, y, 3.5, GOLD);
}

// ลายมุมเรขาคณิต: ขั้นบันไดซ้อน + ข้าวหลามตัด
function corner(ctx, x, y, sx, sy) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(0, 150);
  ctx.lineTo(0, 0);
  ctx.lineTo(150, 0);
  ctx.moveTo(18, 96);
  ctx.lineTo(18, 18);
  ctx.lineTo(96, 18);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = NAVY;
  ctx.beginPath();
  ctx.moveTo(36, 60);
  ctx.lineTo(36, 36);
  ctx.lineTo(60, 36);
  ctx.stroke();
  diamond(ctx, 0, 0, 12, NAVY);
  diamond(ctx, 0, 0, 5, GOLD);
  diamond(ctx, 0, 150, 4, GOLD);
  diamond(ctx, 150, 0, 4, GOLD);
  ctx.restore();
}

function frame(ctx) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // ลายข้าวหลามตัดจาง ๆ ด้านหลัง
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.lineWidth = 2;
  for (let r = 90; r <= 450; r += 60) diamond(ctx, W / 2, H / 2 + 40, r, null, NAVY);
  ctx.restore();
  // แถบกรมท่าด้านนอก + เส้นทองด้านใน
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 10;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 58, W - 116, H - 116);
  const m = 82;
  corner(ctx, m, m, 1, 1);
  corner(ctx, W - m, m, -1, 1);
  corner(ctx, m, H - m, 1, -1);
  corner(ctx, W - m, H - m, -1, -1);
  // ขีดกลางขอบบน-ล่าง
  [58, H - 58].forEach((y) => {
    diamond(ctx, W / 2, y, 9, PAPER, GOLD);
    diamond(ctx, W / 2, y, 3.5, NAVY);
  });
}

function logo(ctx, img, y) {
  const r = 54;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.arc(W / 2, y, r + 10, 0, Math.PI * 2);
  ctx.stroke();
  if (img) {
    const k = Math.min((r * 2) / img.width, (r * 2) / img.height);
    const w = img.width * k,
      h = img.height * k;
    ctx.drawImage(img, W / 2 - w / 2, y - h / 2, w, h);
  } else {
    ctx.beginPath();
    ctx.arc(W / 2, y, r, 0, Math.PI * 2);
    ctx.fillStyle = NAVY;
    ctx.fill();
    diamond(ctx, W / 2, y, 34, null, GOLD);
    ctx.lineWidth = 2;
    diamond(ctx, W / 2, y, 18, GOLD);
  }
  ctx.restore();
}

function awardBadge(ctx, text, y, color) {
  ctx.font = `700 46px ${FONT}`;
  const w = Math.min(ctx.measureText(text).width + 120, W - 420),
    h = 78;
  const x = W / 2 - w / 2;
  ctx.beginPath();
  ctx.roundRect(x, y - h / 2, w, h, h / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = GOLD_SOFT;
  ctx.beginPath();
  ctx.roundRect(x + 7, y - h / 2 + 7, w - 14, h - 14, (h - 14) / 2);
  ctx.stroke();
  ctx.textBaseline = "middle";
  line(ctx, text, y + 2, 46, 700, "#ffffff", w - 80);
  ctx.textBaseline = "alphabetic";
}

function drawCertificate(ctx, cert, student, settings, img) {
  frame(ctx);
  logo(ctx, img, 146);
  line(ctx, settings.organization, 248, 30, 600, NAVY, W - 420, 1);
  line(ctx, "ประกาศนียบัตร", 404, 88, 700, NAVY, W - 420, 0, SCRIPT);
  divider(ctx, 448);
  line(ctx, "ขอมอบไว้เพื่อแสดงว่า", 496, 30, 400, NAVY_SOFT);
  line(ctx, `${student.first_name} ${student.last_name}`, 606, 72, 700, "#121c33", W - 420, 0, SCRIPT);
  line(ctx, withSchool(student.school || cert.school), 664, 32, 400, NAVY_SOFT);
  const accent = medalColors[cert.medal] || NAVY_SOFT;
  const award =
    cert.medal === "เข้าร่วม"
      ? "ได้เข้าร่วมการแข่งขัน"
      : `ได้รับรางวัล${cert.medal}${cert.rank_label ? " " + cert.rank_label : ""}`;
  awardBadge(ctx, award, 746, accent);
  line(
    ctx,
    `การแข่งขัน${cert.competition.title}${cert.competition.grade_label ? " ระดับชั้น " + cert.competition.grade_label : ""}`,
    834,
    34,
    600,
    NAVY,
  );
  line(ctx, settings.event_line, 884, 30, 400, NAVY_SOFT);
  if (settings.issued_text) line(ctx, settings.issued_text, 930, 28, 400, NAVY_SOFT);

  const signers = (settings.signers || []).filter((s) => s.name || s.position);
  const slot = (W - 420) / Math.max(signers.length, 1);
  signers.forEach((s, i) => {
    const x = 210 + slot * i + slot / 2;
    ctx.strokeStyle = NAVY_SOFT;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(x - 170, 1040);
    ctx.lineTo(x + 170, 1040);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "center";
    ctx.fillStyle = NAVY;
    ctx.font = `600 28px ${FONT}`;
    if (s.name) ctx.fillText(`(${s.name})`, x, 1084);
    ctx.fillStyle = NAVY_SOFT;
    ctx.font = `400 24px ${FONT}`;
    if (s.position) ctx.fillText(s.position, x, 1120);
  });
}

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

async function jpeg(canvas) {
  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.92));
  return new Uint8Array(await blob.arrayBuffer());
}

function buildPdf(images) {
  const enc = new TextEncoder(),
    parts = [],
    offsets = [];
  let size = 0;
  const push = (x) => {
    const b = typeof x === "string" ? enc.encode(x) : x;
    parts.push(b);
    size += b.length;
  };
  const obj = (n, head, stream) => {
    offsets[n] = size;
    push(`${n} 0 obj\n${head}\n`);
    if (stream) {
      push("stream\n");
      push(stream);
      push("\nendstream\n");
    }
    push("endobj\n");
  };
  const pw = 842,
    ph = 595,
    count = images.length;
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const kids = images.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${count} >>`);
  images.forEach((img, i) => {
    const p = 3 + i * 3,
      content = enc.encode(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`);
    obj(
      p,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${p + 1} 0 R >> >> /Contents ${p + 2} 0 R >>`,
    );
    obj(
      p + 1,
      `<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>`,
      img,
    );
    obj(p + 2, `<< /Length ${content.length} >>`, content);
  });
  const total = 3 + count * 3,
    xref = size;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++)
    push(String(offsets[n]).padStart(10, "0") + " 00000 n \n");
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}

export async function downloadCertificates(certs, settings, filename) {
  await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d"),
    pages = [],
    img = await loadImage(settings.logo);
  for (const cert of certs)
    for (const student of cert.students) {
      drawCertificate(ctx, cert, student, settings, img);
      pages.push(await jpeg(canvas));
    }
  if (!pages.length) throw Error("ไม่มีรายชื่อนักเรียนสำหรับสร้างประกาศนียบัตร");
  const url = URL.createObjectURL(buildPdf(pages));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
