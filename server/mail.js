const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export const defaultFrom = "ศิลปหัตถกรรม <no-reply@mail.banpadengschool.ac.th>";

export function passwordResetEmail(name, link, minutes) {
  const safeName = escapeHtml(name),
    safeLink = escapeHtml(link);
  return {
    subject: "ตั้งรหัสผ่านใหม่ · ศิลปหัตถกรรม",
    text: `สวัสดี ${name}\n\nมีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ เปิดลิงก์นี้ภายใน ${minutes} นาที (ใช้ได้ครั้งเดียว):\n${link}\n\nหากคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ`,
    html: `<!doctype html><html lang="th"><body style="margin:0;background:#eef5ff;font-family:Tahoma,Arial,sans-serif;color:#0f2a4a"><div style="max-width:520px;margin:24px auto;background:#fff;border-radius:12px;padding:28px"><h2 style="margin:0 0 12px;color:#1d4ed8">ตั้งรหัสผ่านใหม่</h2><p>สวัสดี ${safeName}</p><p>มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีระบบศิลปหัตถกรรมของคุณ กดปุ่มด้านล่างภายใน ${minutes} นาที (ลิงก์ใช้ได้ครั้งเดียว)</p><p style="text-align:center;margin:28px 0"><a href="${safeLink}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block">ตั้งรหัสผ่านใหม่</a></p><p style="font-size:13px;color:#475569">หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้:<br><span style="word-break:break-all">${safeLink}</span></p><p style="font-size:13px;color:#475569">หากคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ</p></div></body></html>`,
  };
}

export async function sendEmail(env, to, message) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || defaultFrom,
      to: [to],
      ...message,
    }),
  });
  if (!response.ok)
    throw new Error(
      `Resend ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
}
