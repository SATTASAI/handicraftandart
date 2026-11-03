import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { digest, now } from "../server/security.js";
const origin = "https://accounts.example.test";
async function runtime(t) {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        { type: "ESModule", path: "server/index.js" },
        { type: "ESModule", path: "server/security.js" },
        { type: "ESModule", path: "server/registrations.js" },
        { type: "ESModule", path: "server/catalog.js" },
        { type: "ESModule", path: "server/judging.js" },
      ],
      compatibilityDate: "2026-11-02",
      d1Databases: ["DB"],
    }),
  );
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  for (const f of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("migrations/" + f, "utf8"));
  async function request(path, data, cookie = "", extra = {}) {
    const r = await mf.dispatchFetch(origin + "/api" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(data === undefined
          ? {}
          : { Origin: origin, "Content-Type": "application/json" }),
        Cookie: cookie,
        ...extra,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
      rawCookie: r.headers.get("set-cookie"),
    };
  }
  return { mf, db, request };
}
const account = (
  email = "teacher@example.test",
  roles = ["coach", "judge"],
) => ({
  name: "ครู ทดสอบ",
  school: "โรงเรียนทดสอบ",
  email,
  password: "test-only-passphrase-2026",
  roles,
});

test("signup both roles, first-account superadmin, secure sessions, login/logout and authorization", async (t) => {
  const { db, request } = await runtime(t);
  assert.equal((await request("/health")).body.release, "judging-v1");
  assert.equal((await request("/setup")).body.firstAccountAvailable, true);
  const first = await request("/signup", account());
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.user.is_superadmin, true);
  assert.deepEqual(first.body.user.roles, ["coach", "judge"]);
  assert.deepEqual(first.body.user.permissions, ["*"]);
  assert.match(first.rawCookie, /HttpOnly/);
  assert.match(first.rawCookie, /Secure/);
  assert.match(first.rawCookie, /SameSite=Lax/);
  assert.match(first.rawCookie, /^__Host-ha_session=/);
  assert(!JSON.stringify(first.body).includes("password"));
  assert.equal((await request("/setup")).body.firstAccountAvailable, false);
  const second = await request("/signup", {
    ...account("second@example.test", ["judge"]),
    is_superadmin: true,
    permissions: ["*"],
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.user.is_superadmin, false);
  assert.deepEqual(second.body.user.roles, ["judge"]);
  assert.equal((await request("/admin/users")).status, 401);
  assert.equal(
    (await request("/admin/users", undefined, second.cookie)).status,
    403,
  );
  const users = await request("/admin/users", undefined, first.cookie);
  assert.equal(users.status, 200);
  assert.equal(users.body.users.length, 2);
  assert(!JSON.stringify(users.body).includes("password_hash"));
  assert.equal(
    (await request("/me", undefined, first.cookie)).body.user.id,
    first.body.user.id,
  );
  const stored = await db
    .prepare("SELECT password_hash FROM account_users WHERE id=?")
    .bind(first.body.user.id)
    .first();
  assert.match(stored.password_hash, /^pbkdf2-sha256\$100000\$/);
  assert(!stored.password_hash.includes(account().password));
  const rawToken = first.cookie.split("=")[1];
  assert(
    await db
      .prepare("SELECT token_hash FROM account_sessions WHERE token_hash=?")
      .bind(await digest(rawToken))
      .first(),
  );
  assert.equal(
    (
      await request("/login", {
        email: account().email,
        password: "wrong-password",
      })
    ).status,
    401,
  );
  const unknown = await request("/login", {
    email: "missing@example.test",
    password: "wrong-password",
  });
  assert.equal(unknown.status, 401);
  assert.equal(
    unknown.body.error,
    (
      await request("/login", {
        email: account().email,
        password: "wrong-password",
      })
    ).body.error,
  );
  assert.equal(
    (await request("/signup", account(" TEACHER@EXAMPLE.TEST "))).status,
    409,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM account_bootstrap").first()).n,
    1,
  );
  const logged = await request("/login", {
    email: " TEACHER@EXAMPLE.TEST ",
    password: account().password,
  });
  assert.equal(logged.status, 200);
  assert.equal(logged.body.user.is_superadmin, true);
  assert.deepEqual(logged.body.user.roles, ["coach", "judge"]);
  assert.equal((await request("/logout", {}, logged.cookie)).status, 200);
  assert.equal(
    (await request("/me", undefined, logged.cookie)).body.user,
    null,
  );
  await db
    .prepare("UPDATE account_sessions SET expires_at=?")
    .bind(now() - 1)
    .run();
  assert.equal((await request("/me", undefined, first.cookie)).body.user, null);
  await assert.rejects(
    () =>
      db
        .prepare("DELETE FROM account_users WHERE id=?")
        .bind(first.body.user.id)
        .run(),
    /FOREIGN KEY/,
  );
  await assert.rejects(
    () =>
      db
        .prepare("UPDATE account_users SET is_superadmin=1 WHERE id=?")
        .bind(second.body.user.id)
        .run(),
    /immutable/,
  );
});

test("concurrent first signups result in exactly one superadmin and one permanent bootstrap", async (t) => {
  const { db, request } = await runtime(t);
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      request(
        "/signup",
        account(`race${i}@example.test`, i % 2 ? ["coach"] : ["judge"]),
      ),
    ),
  );
  assert.deepEqual(
    results.map((r) => r.status),
    Array(6).fill(201),
    JSON.stringify(results),
  );
  assert.equal(results.filter((r) => r.body.user.is_superadmin).length, 1);
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM account_users WHERE is_superadmin=1")
        .first()
    ).n,
    1,
  );
  const marker = await db
    .prepare("SELECT user_id FROM account_bootstrap")
    .first();
  assert.equal(
    marker.user_id,
    results.find((r) => r.body.user.is_superadmin).body.user.id,
  );
});

test("failed signup rolls back the account, session and first-admin claim", async (t) => {
  const { db, request } = await runtime(t);
  await db
    .prepare(
      "CREATE TRIGGER fail_session BEFORE INSERT ON account_sessions BEGIN SELECT RAISE(ABORT,'test failure'); END",
    )
    .run();
  assert.equal((await request("/signup", account())).status, 500);
  for (const table of [
    "account_users",
    "account_sessions",
    "account_bootstrap",
  ])
    assert.equal(
      (await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n,
      0,
    );
  await db.prepare("DROP TRIGGER fail_session").run();
  assert.equal(
    (await request("/signup", account())).body.user.is_superadmin,
    true,
  );
});

test("signup validation, cross-origin protection, body limits and rate limits", async (t) => {
  const { request } = await runtime(t);
  for (const roles of [[], ["admin"], ["coach", "coach"], "coach"])
    assert.equal(
      (await request("/signup", account("invalid@example.test", roles))).status,
      400,
    );
  assert.equal(
    (await request("/signup", { ...account(), password: "short" })).status,
    400,
  );
  assert.equal(
    (await request("/signup", { ...account(), school: " " })).status,
    400,
  );
  assert.equal(
    (await request("/signup", { ...account(), email: "bad-address" })).status,
    400,
  );
  assert.equal(
    (
      await request("/signup", account(), "", {
        Origin: "https://evil.example.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/signup", { ...account(), name: "x".repeat(17000) }))
      .status,
    413,
  );
  assert.equal(
    (await request("/signup", account(), "", { "Content-Type": "text/plain" }))
      .status,
    415,
  );
  assert.equal(
    (await request("/signup", account("valid@example.test", ["coach"]))).status,
    201,
  );
  // Per-IP signup limit is generous (shared school Wi-Fi) but still enforced.
  let limited;
  for (let i = 0; i < 60 && limited !== 429; i++)
    limited = (
      await request("/signup", account(`bulk${i}@example.test`, ["coach"]))
    ).status;
  assert.equal(limited, 429);
});
