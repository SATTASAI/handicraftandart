export const now = () => Math.floor(Date.now() / 1000);
const encoder = new TextEncoder();
const hex = (bytes) =>
  [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async (value) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
export async function hashPassword(password, salt = random()) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations: 100000,
    },
    key,
    256,
  );
  return `pbkdf2-sha256$100000$${salt}$${hex(bits)}`;
}
export async function verifyPassword(password, stored) {
  const hash = await hashPassword(password, stored.split("$")[2]);
  if (hash.length !== stored.length) return false;
  let difference = 0;
  for (let i = 0; i < hash.length; i++)
    difference |= hash.charCodeAt(i) ^ stored.charCodeAt(i);
  return difference === 0;
}
export function publicUser(user) {
  return user
    ? {
        id: user.id,
        name: user.name,
        school: user.school,
        email: user.email,
        roles: [
          ...(user.is_coach ? ["coach"] : []),
          ...(user.is_judge ? ["judge"] : []),
        ],
        is_superadmin: Boolean(user.is_superadmin),
        permissions: user.is_superadmin ? ["*"] : ["account:self"],
        created_at: user.created_at,
      }
    : null;
}
