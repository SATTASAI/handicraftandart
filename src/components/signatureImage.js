// แปลงรูปถ่ายลายเซ็นให้เหลือเฉพาะเส้นหมึก (พื้นหลังโปร่งใส) แล้วครอปให้พอดี
// ขั้นตอน: ย่อรูป → ปรับแสงไม่สม่ำเสมอ (หารด้วยพื้นหลังที่เบลอ) → หา threshold แบบ Otsu
// → เส้นหมึกเป็นสีกรมท่า ขอบนุ่ม → ครอปตามขอบเขตหมึก → PNG
const INK = [27, 45, 82];
const WORK_MAX = 1400;
const OUT_W = 640,
  OUT_H = 220;

function readImage(file) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      ok(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      bad(Error("อ่านไฟล์รูปไม่ได้"));
    };
    img.src = url;
  });
}

// ค่าเฉลี่ยในกล่องรัศมี r ด้วย integral image
function boxBlur(src, w, h, r) {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r),
      y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r),
        x1 = Math.min(w, x + r + 1);
      const sum =
        I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      out[y * w + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

function otsu(values) {
  const hist = new Array(256).fill(0);
  for (const v of values) hist[v]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0,
    wB = 0,
    best = 0,
    t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB,
      mF = (sum - sumB) / wF,
      between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      t = i;
    }
  }
  return t;
}

export async function processSignature(file) {
  if (!/^image\/(png|jpeg|webp|heic|heif)$/.test(file.type) && !/\.(png|jpe?g|webp|heic)$/i.test(file.name))
    throw Error("กรุณาเลือกไฟล์รูปภาพ");
  const img = await readImage(file);
  const k = Math.min(1, WORK_MAX / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)),
    h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data,
    n = w * h;

  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3] / 255;
    // พื้นที่โปร่งใสเดิมให้ถือเป็นพื้นขาว
    lum[i] =
      (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) * a + 255 * (1 - a);
  }
  // พื้นหลังโดยประมาณ (เบลอกว้าง) เพื่อชดเชยเงา/แสงไม่เท่ากัน
  const bg = boxBlur(lum, w, h, Math.max(8, Math.round(Math.max(w, h) / 25)));
  const norm = new Uint8Array(n);
  for (let i = 0; i < n; i++)
    norm[i] = Math.max(0, Math.min(255, Math.round((lum[i] / Math.max(bg[i], 1)) * 255)));

  const t = Math.min(otsu(norm), 225);
  const soft = 28; // ช่วงไล่ขอบให้นุ่ม
  const alpha = new Uint8Array(n);
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1,
    inkCount = 0;
  for (let i = 0; i < n; i++) {
    const v = norm[i];
    const a = v >= t ? 0 : v <= t - soft ? 255 : Math.round(((t - v) / soft) * 255);
    alpha[i] = a;
    if (a > 96) {
      const x = i % w,
        y = (i / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      inkCount++;
    }
  }
  if (maxX < 0 || inkCount < 30) throw Error("ไม่พบเส้นลายเซ็นในรูป ลองถ่ายบนกระดาษขาวให้ชัดขึ้น");
  if (inkCount > n * 0.35) throw Error("พื้นหลังไม่สะอาดพอ กรุณาถ่ายลายเซ็นบนกระดาษขาวเรียบ");

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04) + 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1,
    ch = maxY - minY + 1;

  const crop = ctx.createImageData(cw, ch);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const s = (y + minY) * w + x + minX,
        d = (y * cw + x) * 4;
      crop.data[d] = INK[0];
      crop.data[d + 1] = INK[1];
      crop.data[d + 2] = INK[2];
      crop.data[d + 3] = alpha[s];
    }
  const cc = document.createElement("canvas");
  cc.width = cw;
  cc.height = ch;
  cc.getContext("2d").putImageData(crop, 0, 0);

  const s = Math.min(1, OUT_W / cw, OUT_H / ch);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cw * s));
  out.height = Math.max(1, Math.round(ch * s));
  const octx = out.getContext("2d");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(cc, 0, 0, out.width, out.height);
  const url = out.toDataURL("image/png");
  if (url.length > 200000) throw Error("ลายเซ็นมีรายละเอียดมากเกินไป ลองครอปรูปให้เหลือเฉพาะลายเซ็น");
  return url;
}
