// Isolated test harness only. Normal deployment uses Docker PostgreSQL/MongoDB.
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import http from "node:http";
async function main() {
  await mkdir(".local", { recursive: true });
  const pg = await PGlite.create({
    dataDir: ".local/pglite",
    extensions: { vector },
  });
  const pending = new Map<string, any>();
  function send(res: any, data: any, status = 200) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(
      JSON.stringify(data, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    );
  }
  const server = http.createServer(async (req, res) => {
    try {
      let text = "";
      for await (const x of req) text += x;
      const b = JSON.parse(text || "{}");
      if (req.url === "/begin") {
        const id = randomUUID();
        void pg
          .transaction(async (t) => {
            await new Promise<void>((resolve, reject) => {
              pending.set(id, { t, resolve, reject });
              send(res, { id });
            });
          })
          .catch(() => {});
        return;
      }
      if (req.url === "/commit" || req.url === "/rollback") {
        const entry = pending.get(b.id);
        if (!entry) throw new Error("Unknown transaction");
        pending.delete(b.id);
        if (req.url === "/commit") entry.resolve();
        else entry.reject(new Error("Explicit rollback"));
        await pg.query("SELECT 1");
        send(res, { ok: true });
        return;
      }
      if (req.url === "/query") {
        const db = b.id ? pending.get(b.id)?.t : pg;
        if (!db) throw new Error("Transaction missing");
        if (!b.params?.length && b.sql.includes(";")) {
          const results = await db.exec(b.sql);
          const r = results.at(-1) || {};
          send(res, { ...r, rowCount: r.affectedRows || r.rows?.length || 0 });
        } else {
          const r = await db.query(b.sql, b.params || []);
          send(res, { ...r, rowCount: r.affectedRows || r.rows?.length || 0 });
        }
        return;
      }
      send(res, { message: "Not found" }, 404);
    } catch (e: any) {
      send(res, { message: e.message, code: e.code }, 400);
    }
  });
  await new Promise<void>((r) => server.listen(55433, "127.0.0.1", r));
  // Override MONGOMS_DOWNLOAD_URL for a different operating system if necessary.
  process.env.MONGOMS_DOWNLOAD_URL ||=
    "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-amazon2023-8.0.17.tgz";
  const mongo = await MongoMemoryServer.create({
    binary: { version: "8.0.17" },
    instance: { port: 57017, dbName: "cybertrace" },
  });
  const env = `DATABASE_URL=postgresql://unused-test-harness/unused
TEST_DATABASE_HTTP=http://127.0.0.1:55433
MONGODB_URI=${mongo.getUri()}
MONGODB_DB=cybertrace
SESSION_SECRET=${randomBytes(40).toString("hex")}
APP_ORIGIN=http://localhost:3000
EMBEDDING_URL=http://127.0.0.1:8001
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
SEED_ADMIN_PASSWORD=${randomBytes(18).toString("hex")}
SEED_ANALYST_PASSWORD=${randomBytes(18).toString("hex")}
`;
  await writeFile(".env", env, { mode: 0o600 });
  console.log(
    "SANDBOX_SERVICES_READY (test-only HTTP SQL transport; secrets in ignored .env)",
  );
  async function stop() {
    server.close();
    await pg.close();
    await mongo.stop();
    process.exit(0);
  }
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
