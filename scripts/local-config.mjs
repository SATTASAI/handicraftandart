import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
// Local credentials stay in the ignored runtime directory, never in browser code or Git.
export async function localBindings(persistPath, varsPath = ".dev.vars") {
  const vars = {};
  try {
    for (const line of (await readFile(varsPath, "utf8")).split("\n")) {
      const n = line.indexOf("=");
      if (n > 0 && !line.trim().startsWith("#")) {
        let value = line.slice(n + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        )
          value = value.slice(1, -1);
        vars[line.slice(0, n).trim()] = value;
      }
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (!vars.AUTH_SECRET) {
    await mkdir(persistPath, { recursive: true });
    const path = join(persistPath, "auth-secret");
    try {
      await writeFile(path, randomBytes(32).toString("hex"), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    vars.AUTH_SECRET = (await readFile(path, "utf8")).trim();
  }
  return { DEMO_MODE: "true", ...vars };
}
