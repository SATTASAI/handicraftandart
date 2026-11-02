import { buildCertificate } from "./certificate-document";
export async function createCertificate(c) {
  const response = await fetch("/fonts/noto-sans-thai-regular.ttf");
  if (!response.ok) throw new Error("โหลดแบบอักษรไม่ได้ กรุณาลองอีกครั้ง");
  const bytes = await buildCertificate(c, await response.arrayBuffer());
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = c.number + ".pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
