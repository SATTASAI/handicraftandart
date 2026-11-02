export const now = () => Math.floor(Date.now() / 1000);
export const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const hex = (a) =>
  Array.from(new Uint8Array(a), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
const enc = new TextEncoder();
export async function digest(s) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}
export async function passwordHash(password, secret, salt = random()) {
  const pepperKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const peppered = await crypto.subtle.sign(
    "HMAC",
    pepperKey,
    enc.encode(password),
  );
  const key = await crypto.subtle.importKey("raw", peppered, "PBKDF2", false, [
    "deriveBits",
  ]);
  const value = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(salt),
      iterations: 100000,
    },
    key,
    256,
  );
  return `pbkdf2-sha256$100000$${salt}$${hex(value)}`;
}
export function equal(a, b) {
  if (a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
export async function verifyPassword(p, hash, secret) {
  return equal(await passwordHash(p, secret, hash.split("$")[2]), hash);
}
export const publicUser = (u) =>
  u
    ? { id: u.id, email: u.email, name: u.name, school: u.school, role: u.role }
    : null;
export const medal = (s) =>
  s >= 80
    ? "เหรียญทอง"
    : s >= 70
      ? "เหรียญเงิน"
      : s >= 60
        ? "เหรียญทองแดง"
        : "เข้าร่วม";
export function safeText(v, max = 200) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
export function validPassword(p) {
  return typeof p === "string" && p.length >= 12 && p.length <= 128;
}
