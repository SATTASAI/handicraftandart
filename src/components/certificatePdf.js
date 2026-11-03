// Draws certificates on canvas (browser Thai fonts) and packs JPEG pages into a PDF.
const FONT =
  "Sarabun, Thonburi, 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif";
const W = 1754,
  H = 1240; // A4 landscape, 150 dpi
const medalColors = {
  เหรียญทอง: "#b8860b",
  เหรียญเงิน: "#7d8590",
  เหรียญทองแดง: "#a0522d",
  เข้าร่วม: "#1e5aa8",
};

const withSchool = (s) =>
  !s ? "" : /^(โรงเรียน|รร\.)/.test(s.trim()) ? s.trim() : "โรงเรียน" + s.trim();

function line(ctx, text, y, size, weight = 400, color = "#1f2a44", maxW = W - 360) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${FONT}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxW && s > 16);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, y);
}

function drawCertificate(ctx, cert, student, settings) {
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#1e3a6e";
  ctx.lineWidth = 14;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 4;
  ctx.strokeRect(70, 70, W - 140, H - 140);
  ctx.strokeRect(84, 84, W - 168, H - 168);
  const accent = medalColors[cert.medal] || "#1e5aa8";
  // Seal
  ctx.beginPath();
  ctx.arc(W / 2, 205, 70, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#c9a227";
  ctx.stroke();
  line(ctx, "ศ", 232, 80, 700, "#ffffff");

  line(ctx, settings.organization, 330, 40, 600, "#1e3a6e");
  line(ctx, "ประกาศนียบัตร", 430, 92, 700, "#1e3a6e");
  line(ctx, "ขอมอบไว้เพื่อแสดงว่า", 500, 36);
  line(ctx, `${student.first_name} ${student.last_name}`, 600, 76, 700, "#111827");
  line(ctx, withSchool(student.school || cert.school), 665, 36);
  const award =
    cert.medal === "เข้าร่วม"
      ? "ได้เข้าร่วมการแข่งขัน"
      : `ได้รับรางวัล${cert.medal}${cert.rank_label ? " " + cert.rank_label : ""}`;
  line(ctx, award, 750, 52, 700, accent);
  line(
    ctx,
    `การแข่งขัน${cert.competition.title}${cert.competition.grade_label ? " ระดับชั้น " + cert.competition.grade_label : ""}`,
    815,
    36,
  );
  line(ctx, settings.event_line, 870, 32);
  if (settings.issued_text) line(ctx, settings.issued_text, 925, 30);

  const signers = (settings.signers || []).filter((s) => s.name || s.position);
  const slot = (W - 300) / Math.max(signers.length, 1);
  signers.forEach((s, i) => {
    const x = 150 + slot * i + slot / 2;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 190, 1045);
    ctx.lineTo(x + 190, 1045);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#1f2a44";
    ctx.font = `600 30px ${FONT}`;
    if (s.name) ctx.fillText(`(${s.name})`, x, 1090);
    ctx.font = `400 26px ${FONT}`;
    if (s.position) ctx.fillText(s.position, x, 1130);
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
  try {
    await document.fonts?.load(`700 40px ${FONT}`);
  } catch {}
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d"),
    pages = [];
  for (const cert of certs)
    for (const student of cert.students) {
      drawCertificate(ctx, cert, student, settings);
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
