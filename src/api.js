export async function api(path, data) {
  const response = await fetch("/api" + path, {
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
    result = await response.json();
  } catch {
    throw new Error("ระบบตอบกลับไม่ถูกต้อง กรุณาลองใหม่");
  }
  if (!response.ok) {
    const error = new Error(result.error || "ไม่สามารถดำเนินการได้");
    error.status = response.status;
    if (response.status === 401)
      window.dispatchEvent(new Event("auth-expired"));
    throw error;
  }
  return result;
}
