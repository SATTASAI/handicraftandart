import { useState } from "react";
export async function uploadIdentity(file, purpose) {
  if (!file || !["image/jpeg", "image/png"].includes(file.type))
    throw new Error("เลือกภาพ JPEG หรือ PNG");
  if (file.size > 10485760)
    throw new Error("ภาพต้องมีขนาดไม่เกิน 10 MB ก่อนย่อ");
  if (file.size > 1048576) {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    file = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!file || file.size > 1048576)
      throw new Error("ภาพยังเกิน 1 MB กรุณาเลือกภาพที่เล็กลง");
  }
  const r = await fetch("/api/documents?purpose=" + purpose, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || "อัปโหลดไม่สำเร็จ");
  return result.id;
}
export default function IdentityUpload({
  value,
  onChange,
  purpose = "student",
  disabled = false,
  label = "ภาพถ่ายบัตรประชาชน",
  accountEvidence,
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(e) {
    const f = e.target.files[0];
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadIdentity(f, purpose));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="identity-upload">
      <label>
        {label}
        <input
          aria-label={label}
          type="file"
          accept="image/jpeg,image/png"
          disabled={disabled || busy}
          onChange={upload}
        />
      </label>
      <small>
        JPEG/PNG ไม่เกิน 10 MB ระบบย่อให้ไม่เกิน 1 MB
        เปิดดูได้เฉพาะเจ้าของข้อมูลและแอดมิน ใช้ตรวจยืนยันตัวตนในการแข่งขัน
      </small>
      {busy && <p role="status">กำลังอัปโหลด…</p>}
      {error && <p role="alert">{error}</p>}
      {value && (
        <a href={"/api/documents/" + value} target="_blank" rel="noreferrer">
          ดูหลักฐานที่แนบ (ส่วนตัว)
        </a>
      )}
      {accountEvidence && !disabled && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange(accountEvidence)}
        >
          ใช้ภาพบัตรของบัญชีนี้ (กรณีเป็นบุคคลเดียวกัน)
        </button>
      )}
    </div>
  );
}
