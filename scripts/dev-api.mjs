import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile } from "node:fs/promises";
export function devApi() {
  return {
    name: "local-d1",
    async configureServer(server) {
      const mf = new Miniflare(
        convertV4MiniflareOptions({
          modules: [
            { type: "ESModule", path: "server/index.js" },
            { type: "ESModule", path: "server/security.js" },
            { type: "ESModule", path: "server/registrations.js" },
          ],
          compatibilityDate: "2026-11-02",
          d1Databases: ["DB"],
          resourcePersistencePath:
            process.env.LOCAL_D1_PATH || ".wrangler/accounts-v1",
        }),
      );
      const db = await mf.getD1Database("DB");
      if (
        !(await db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='account_users'",
          )
          .first())
      ) {
        await db.exec(
          await readFile("migrations/0011_restart_accounts.sql", "utf8"),
        );
      }
      if (
        !(await db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='event_competitions'",
          )
          .first())
      ) {
        // Add the registration schema without resetting existing account data.
        await db.exec(
          await readFile(
            "migrations/0012_competition_registration.sql",
            "utf8",
          ),
        );
      }
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (
              size >
              (req.url.split("?")[0] === "/api/registration-documents"
                ? 1048576
                : 65536)
            ) {
              res.writeHead(413, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "ข้อมูลมีขนาดใหญ่เกินกำหนด" }));
              return;
            }
            chunks.push(chunk);
          }
          const body = Buffer.concat(chunks),
            headers = new Headers();
          for (const [key, value] of Object.entries(req.headers))
            if (value)
              headers.set(key, Array.isArray(value) ? value.join(",") : value);
          const response = await mf.dispatchFetch(
            "http://" + req.headers.host + req.url,
            { method: req.method, headers, ...(body.length ? { body } : {}) },
          );
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "ไม่สามารถเชื่อมต่อระบบบัญชีได้" }));
        }
      });
      server.httpServer?.once("close", () => mf.dispose());
    },
  };
}
