// Local development only. Deployments use server/index.js with Cloudflare bindings.
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
import { localBindings } from "./local-config.mjs";
const vars = await localBindings(".wrangler/local-api");
const mf = new Miniflare(
  convertV4MiniflareOptions({
    host: "127.0.0.1",
    port: 8787,
    modules: [
      { type: "ESModule", path: "server/index.js" },
      { type: "ESModule", path: "server/security.js" },
    ],
    compatibilityDate: "2026-11-02",
    d1Databases: ["DB"],
    resourcePersistencePath: ".wrangler/local-api",
    bindings: vars,
    serviceBindings: {
      ASSETS: () =>
        new Response("Use the Vite frontend at port 4173", { status: 404 }),
    },
  }),
);
const db = await mf.getD1Database("DB");
await db
  .prepare("CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)")
  .run();
for (const file of (await readdir("migrations"))
  .filter((x) => x.endsWith(".sql"))
  .sort()) {
  if (
    await db
      .prepare("SELECT name FROM local_migrations WHERE name=?")
      .bind(file)
      .first()
  )
    continue;
  for (const sql of (await readFile("migrations/" + file, "utf8"))
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(sql).run();
  await db.prepare("INSERT INTO local_migrations VALUES(?)").bind(file).run();
}
console.log(
  "Local Cloudflare API ready on port 8787. Database migrations applied.",
);
process.on("SIGINT", async () => {
  await mf.dispose();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await mf.dispose();
  process.exit(0);
});
