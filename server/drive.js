// Google Drive storage for ID-card images and certificate PDFs.
// Auth: OAuth refresh token of a dedicated Google account (secrets
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN). Scope
// drive.file: the app only sees files/folders it created itself, so the root
// folder is created by the app and its id is kept in app_settings.
// Optional DRIVE_FOLDER_ID overrides the root (needs a token with full drive scope).
import { now } from "./security.js";

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const ROOT_NAME = "ศิลปหัตถกรรม (ไฟล์ระบบ)";
export const FOLDERS = {
  documents: "ภาพบัตรประชาชนนักเรียน",
  certificates: "ประกาศนียบัตร",
};
let token = { value: "", expires: 0, key: "" };

export const driveEnabled = (env) =>
  Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN,
  );

async function accessToken(env) {
  const key = env.GOOGLE_CLIENT_ID + env.GOOGLE_REFRESH_TOKEN;
  if (token.key === key && token.expires > Date.now() + 60000) return token.value;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.access_token)
    throw new Error("Google token " + r.status + ": " + (b.error || ""));
  token = {
    value: b.access_token,
    expires: Date.now() + Number(b.expires_in || 3600) * 1000,
    key,
  };
  return token.value;
}

async function call(env, url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: {
      Authorization: "Bearer " + (await accessToken(env)),
      ...(init.headers || {}),
    },
  });
  return r;
}

async function createFolder(env, name, parent) {
  const r = await call(env, API + "?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parent ? { parents: [parent] } : {}),
    }),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.id) throw new Error("Drive folder " + r.status);
  return b.id;
}

// Folder ids are created once and remembered in app_settings.
export async function folderId(env, db, kind) {
  const key = "drive_folder:" + kind;
  const row = await db
    .prepare("SELECT value FROM app_settings WHERE key=?")
    .bind(key)
    .first();
  if (row) return JSON.parse(row.value);
  let root = env.DRIVE_FOLDER_ID || "";
  if (!root) {
    const saved = await db
      .prepare("SELECT value FROM app_settings WHERE key='drive_folder:root'")
      .first();
    root = saved ? JSON.parse(saved.value) : await createFolder(env, ROOT_NAME);
    if (!saved)
      await db
        .prepare(
          "INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES('drive_folder:root',?,?)",
        )
        .bind(JSON.stringify(root), now())
        .run();
  }
  const id = await createFolder(env, FOLDERS[kind], root);
  await db
    .prepare("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES(?,?,?)")
    .bind(key, JSON.stringify(id), now())
    .run();
  // A concurrent request may have won; use whatever is stored.
  return JSON.parse(
    (
      await db
        .prepare("SELECT value FROM app_settings WHERE key=?")
        .bind(key)
        .first()
    ).value,
  );
}

// Resumable upload works for any size (multipart is limited to 5 MB).
export async function uploadFile(env, db, kind, name, type, bytes) {
  const parent = await folderId(env, db, kind);
  const start = await call(env, UPLOAD + "?uploadType=resumable&fields=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": type,
      "X-Upload-Content-Length": String(bytes.length),
    },
    body: JSON.stringify({ name, parents: [parent], mimeType: type }),
  });
  const location = start.headers.get("location");
  if (!start.ok || !location) throw new Error("Drive upload start " + start.status);
  const put = await fetch(location, {
    method: "PUT",
    headers: { "Content-Type": type },
    body: bytes,
  });
  const b = await put.json().catch(() => ({}));
  if (!put.ok || !b.id) throw new Error("Drive upload " + put.status);
  return b.id;
}

export async function downloadFile(env, id) {
  const r = await call(env, API + "/" + encodeURIComponent(id) + "?alt=media");
  if (!r.ok) throw new Error("Drive download " + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

// Best effort: a missing file is fine, other failures are only logged.
export async function deleteFiles(env, ids) {
  const failed = [];
  for (const id of ids.filter(Boolean))
    try {
      const r = await call(env, API + "/" + encodeURIComponent(id), {
        method: "DELETE",
      });
      if (!r.ok && r.status !== 404) {
        failed.push(id);
        console.error("drive delete failed", id, r.status);
      }
    } catch (error) {
      failed.push(id);
      console.error("drive delete failed", id, error);
    }
  return failed;
}
