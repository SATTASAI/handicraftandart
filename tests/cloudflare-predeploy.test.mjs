import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareCloudflareDeploy } from "../scripts/cloudflare-predeploy.mjs";
test("local builds, GitHub checks and Cloudflare previews never migrate production", () => {
  for (const env of [
    {},
    { CI: "true" },
    { WORKERS_CI: "1", WORKERS_CI_BRANCH: "feature/new-flow" },
  ]) {
    assert.equal(
      prepareCloudflareDeploy(env, () =>
        assert.fail("unexpected production access"),
      ),
      false,
    );
  }
});
test("production records a recovery bookmark then applies migrations", () => {
  const commands = [];
  assert.equal(
    prepareCloudflareDeploy(
      { WORKERS_CI: "1", WORKERS_CI_BRANCH: "main" },
      (args) => commands.push(args),
    ),
    true,
  );
  assert.deepEqual(commands, [
    ["d1", "time-travel", "info", "handicraftandart", "--json"],
    ["d1", "migrations", "apply", "handicraftandart", "--remote"],
  ]);
});
test("unknown branch or failed checkpoint stops migration/build", () => {
  assert.throws(
    () => prepareCloudflareDeploy({ WORKERS_CI: "1" }, () => assert.fail()),
    /branch is missing/,
  );
  let calls = 0;
  assert.throws(
    () =>
      prepareCloudflareDeploy(
        { WORKERS_CI: "true", WORKERS_CI_BRANCH: "main" },
        () => {
          calls++;
          throw new Error("access denied");
        },
      ),
    /access denied/,
  );
  assert.equal(calls, 1);
});
