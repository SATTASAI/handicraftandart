import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
export function devApi() {
  return {
    name: "local-cloudflare-api",
    async configureServer(server) {
      let vars = {};
      try {
        for (const line of (await readFile(".dev.vars", "utf8")).split("\n")) {
          const n = line.indexOf("=");
          if (n > 0 && !line.startsWith("#"))
            vars[line.slice(0, n).trim()] = line.slice(n + 1).trim();
        }
      } catch {}
      const mf = new Miniflare(
        convertV4MiniflareOptions({
          modules: [
            { type: "ESModule", path: "server/index.js" },
            { type: "ESModule", path: "server/security.js" },
          ],
          compatibilityDate: "2026-11-02",
          d1Databases: ["DB"],
          d1Persist: ".wrangler/vite-api",
          bindings: {
            AUTH_SECRET: vars.AUTH_SECRET || randomBytes(32).toString("hex"),
            DEMO_MODE: "true",
            ...vars,
          },
        }),
      );
      const db = await mf.getD1Database("DB");
      await db
        .prepare(
          "CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)",
        )
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
        await db
          .prepare("INSERT INTO local_migrations VALUES(?)")
          .bind(file)
          .run();
      }
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = Buffer.concat(chunks);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers))
            if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
          const response = await mf.dispatchFetch(
            "http://" + req.headers.host + req.url,
            { method: req.method, headers, ...(body.length ? { body } : {}) },
          );
          res.statusCode = response.status;
          for (const [k, v] of response.headers) res.setHeader(k, v);
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Local API unavailable" }));
        }
      });
      server.httpServer?.once("close", () => mf.dispose());
    },
  };
}
