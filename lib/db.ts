import "dotenv/config";
import { Pool } from "pg";
import { MongoClient } from "mongodb";
export type DB = {
  query: (sql: string, params?: any[]) => Promise<any>;
  release?: () => void;
};
const g = globalThis as any;
export function pool(): Pool {
  if (!g.ctPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
    g.ctPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 10),
    });
  }
  return g.ctPool;
}
// Optional loopback HTTP transport for the isolated PostgreSQL-engine test harness.
// Normal deployments always use node-postgres and DATABASE_URL.
async function remote(action: string, data: any = {}) {
  const r = await fetch(process.env.TEST_DATABASE_HTTP + "/" + action, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const b = await r.json();
  if (!r.ok) {
    const e: any = new Error(b.message);
    e.code = b.code;
    throw e;
  }
  return b;
}
export async function query(sql: string, params: any[] = []): Promise<any> {
  return process.env.TEST_DATABASE_HTTP
    ? remote("query", { sql, params })
    : pool().query(sql, params);
}
export async function tx<T>(
  fn: (c: DB) => Promise<T>,
  actor?: string,
): Promise<T> {
  if (process.env.TEST_DATABASE_HTTP) {
    const { id } = await remote("begin");
    const c: DB = {
      query: (sql, params = []) => remote("query", { id, sql, params }),
    };
    try {
      if (actor)
        await c.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
      const result = await fn(c);
      await remote("commit", { id });
      return result;
    } catch (e) {
      await remote("rollback", { id });
      throw e;
    }
  }
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    if (actor)
      await c.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function mongo() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI required");
  if (!g.ctMongo) g.ctMongo = new MongoClient(process.env.MONGODB_URI);
  await g.ctMongo.connect();
  return g.ctMongo.db(process.env.MONGODB_DB || "cybertrace");
}
export async function close() {
  if (g.ctPool) await g.ctPool.end();
  if (g.ctMongo) await g.ctMongo.close();
  delete g.ctPool;
  delete g.ctMongo;
}
