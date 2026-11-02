import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { localBindings } from "../scripts/local-config.mjs";
import { passwordHash, verifyPassword } from "../server/security.js";
test("local D1 data and password pepper survive a runtime restart", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "handicraft-persist-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = await localBindings(
    directory,
    join(directory, "missing.dev.vars"),
  );
  const hash = await passwordHash("local-test-passphrase", first.AUTH_SECRET);
  const create = () =>
    new Miniflare(
      convertV4MiniflareOptions({
        modules: [
          { type: "ESModule", path: "server/index.js" },
          { type: "ESModule", path: "server/security.js" },
        ],
        compatibilityDate: "2026-11-02",
        d1Databases: ["DB"],
        resourcePersistencePath: directory,
      }),
    );
  let runtime = create();
  try {
    const db = await runtime.getD1Database("DB");
    await db.prepare("CREATE TABLE persistence_probe(value TEXT)").run();
    await db
      .prepare("INSERT INTO persistence_probe VALUES(?)")
      .bind("saved-registration")
      .run();
  } finally {
    await runtime.dispose();
  }
  const second = await localBindings(
    directory,
    join(directory, "missing.dev.vars"),
  );
  assert.equal(second.AUTH_SECRET, first.AUTH_SECRET);
  assert(
    await verifyPassword("local-test-passphrase", hash, second.AUTH_SECRET),
  );
  runtime = create();
  try {
    assert.equal(
      (
        await (
          await runtime.getD1Database("DB")
        )
          .prepare("SELECT value FROM persistence_probe")
          .first()
      ).value,
      "saved-registration",
    );
  } finally {
    await runtime.dispose();
  }
});
