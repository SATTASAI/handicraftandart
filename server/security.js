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
          ...(user.is_organizer ? ["organizer"] : []),
        ],
        is_superadmin: Boolean(user.is_superadmin),
        is_organizer: Boolean(user.is_organizer),
        permissions: user.is_superadmin
          ? ["*"]
          : [
              "account:self",
              ...(user.is_coach ? ["registration:create"] : []),
              ...(user.is_organizer ? ["registration:review"] : []),
            ],
        created_at: user.created_at,
      }
    : null;
}

// --- Passkeys (WebAuthn): Face ID / Touch ID / device PIN sign-in ---
export const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export function fromBase64Url(value) {
  if (typeof value !== "string" || value.length > 8192 || !/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}
const keyAlgorithms = {
  "-7": [{ name: "ECDSA", namedCurve: "P-256" }, { name: "ECDSA", hash: "SHA-256" }],
  "-257": [{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, { name: "RSASSA-PKCS1-v1_5" }],
};
export async function passkeyKey(spki, alg) {
  const bytes = fromBase64Url(spki);
  if (!bytes || !keyAlgorithms[alg]) return null;
  try {
    return await crypto.subtle.importKey("spki", bytes, keyAlgorithms[alg][0], false, ["verify"]);
  } catch {
    return null;
  }
}
// Checks the browser-signed client data and the authenticator flags. Returns the
// challenge so the caller can claim it exactly once, or null when anything is off.
export async function passkeyResponse(type, origin, clientData, authenticatorData) {
  const client = fromBase64Url(clientData),
    auth = fromBase64Url(authenticatorData);
  if (!client || !auth || auth.length < 37) return null;
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(client));
  } catch {
    return null;
  }
  const rpHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(new URL(origin).hostname)));
  // 0x01 = user present, 0x04 = user verified (face, fingerprint or device PIN).
  if (
    data?.type !== type ||
    data.origin !== origin ||
    typeof data.challenge !== "string" ||
    rpHash.some((byte, i) => byte !== auth[i]) ||
    (auth[32] & 5) !== 5
  )
    return null;
  let credentialId = null;
  if (auth[32] & 64 && auth.length >= 55) {
    const length = (auth[53] << 8) | auth[54];
    if (auth.length >= 55 + length) credentialId = toBase64Url(auth.slice(55, 55 + length));
  }
  return { challenge: data.challenge, client, auth, credentialId };
}
// WebAuthn sends ECDSA signatures as ASN.1 DER; WebCrypto wants raw r||s.
function rawSignature(der) {
  if (der[0] !== 48) return null;
  let offset = der[1] & 128 ? 2 + (der[1] & 127) : 2;
  const out = new Uint8Array(64);
  for (let part = 0; part < 2; part++) {
    if (der[offset] !== 2) return null;
    const length = der[offset + 1];
    let value = der.slice(offset + 2, offset + 2 + length);
    while (value.length > 32 && value[0] === 0) value = value.slice(1);
    if (value.length > 32) return null;
    out.set(value, 32 * part + 32 - value.length);
    offset += 2 + length;
  }
  return out;
}
export async function passkeySignatureValid(key, alg, response, signature) {
  let bytes = fromBase64Url(signature);
  if (bytes && String(alg) === "-7") bytes = rawSignature(bytes);
  if (!bytes) return false;
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", response.client));
  const signed = new Uint8Array(response.auth.length + 32);
  signed.set(response.auth);
  signed.set(hash, response.auth.length);
  try {
    return await crypto.subtle.verify(keyAlgorithms[alg][1], key, bytes, signed);
  } catch {
    return false;
  }
}
