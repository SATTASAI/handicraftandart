export async function api(path, data) {
  const r = await fetch("/api" + path, {
    credentials: "same-origin",
    ...(data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
  });
  let result;
  try {
    result = await r.json();
  } catch {
    throw new Error("เชื่อมต่อระบบไม่ได้ โปรดลองใหม่");
  }
  if (!r.ok) throw new Error(result.error || "ทำรายการไม่สำเร็จ");
  return result;
}
