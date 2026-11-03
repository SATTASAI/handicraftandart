import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function prepareCloudflareDeploy(env, run) {
  // Only the production Git-connected Workers build may alter remote D1.
  // Local builds, GitHub checks and non-main preview builds never do so.
  if (!["1", "true"].includes(env.WORKERS_CI)) return false;
  if (!env.WORKERS_CI_BRANCH)
    throw new Error(
      "Cloudflare build branch is missing; refusing remote migrations.",
    );
  if (env.WORKERS_CI_BRANCH !== "main") return false;
  // Record a recoverable D1 Time Travel bookmark in the Cloudflare build log.
  run(["d1", "time-travel", "info", "handicraftandart", "--json"]);
  run(["d1", "migrations", "apply", "handicraftandart", "--remote"]);
  return true;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    const prepared = prepareCloudflareDeploy(process.env, (args) => {
      const result = spawnSync(
        process.execPath,
        ["node_modules/wrangler/bin/wrangler.js", ...args],
        {
          stdio: ["ignore", "inherit", "inherit"],
          env: { ...process.env, CI: "true" },
        },
      );
      if (result.error) throw result.error;
      if (result.status !== 0)
        throw new Error(
          `Cloudflare preparation failed: ${args.slice(0, 3).join(" ")} (exit ${result.status})`,
        );
    });
    console.log(
      prepared
        ? "Production D1 migrations applied before build."
        : "Remote D1 preparation skipped outside the production Cloudflare build.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
