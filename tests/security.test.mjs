import { test } from "node:test";
import assert from "node:assert/strict";
import {
  passwordHash,
  verifyPassword,
  validPassword,
  medal,
} from "../server/security.js";
test("password hashing uses salt, pepper and rejects incorrect passwords", async () => {
  const a = await passwordHash(
    "a-strong-passphrase",
    "test-secret-not-a-production-key",
  );
  const b = await passwordHash(
    "a-strong-passphrase",
    "test-secret-not-a-production-key",
  );
  assert.notEqual(a, b);
  assert(
    await verifyPassword(
      "a-strong-passphrase",
      a,
      "test-secret-not-a-production-key",
    ),
  );
  assert(
    !(await verifyPassword(
      "different-password",
      a,
      "test-secret-not-a-production-key",
    )),
  );
  assert(!(await verifyPassword("a-strong-passphrase", a, "different-pepper")));
  assert(!validPassword("short"));
  assert(!validPassword("a".repeat(129)));
});
test("award boundaries", () => {
  assert.equal(medal(80), "เหรียญทอง");
  assert.equal(medal(79.99), "เหรียญเงิน");
  assert.equal(medal(70), "เหรียญเงิน");
  assert.equal(medal(60), "เหรียญทองแดง");
  assert.equal(medal(59), "เข้าร่วม");
});
