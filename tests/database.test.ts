import test, { after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { query, tx, mongo, close } from "../lib/db";
import { randomUUID } from "node:crypto";
import { setupMongo } from "../mongo/setup";
after(close);
const enabled = !!process.env.DATABASE_URL && !!process.env.MONGODB_URI;
function dbtest(name: string, fn: () => Promise<void>) {
  test(name, { skip: !enabled }, fn);
}
async function rollback(fn: (c: any) => Promise<void>) {
  const sentinel = new Error("rollback test");
  try {
    await tx(async (c) => {
      await fn(c);
      throw sentinel;
    });
  } catch (e) {
    if (e !== sentinel) throw e;
  }
}
dbtest("SQL constraint rejects invalid severity", async () => {
  await assert.rejects(
    tx(async (c) => {
      const u = (await c.query("SELECT user_id FROM app_users LIMIT 1")).rows[0]
        .user_id;
      await c.query(
        "INSERT INTO incidents(title,description,severity,detected_at,created_by) VALUES('Test invalid','Long test description','Impossible',now(),$1)",
        [u],
      );
    }),
    /check constraint/i,
  );
});
dbtest("SQL rejects missing foreign key", async () => {
  await assert.rejects(
    tx((c) =>
      c.query(
        "INSERT INTO incident_assets(incident_id,asset_id) VALUES($1,$2)",
        [randomUUID(), randomUUID()],
      ),
    ),
    /foreign key/i,
  );
});
dbtest("SQL rejects duplicate user email", async () => {
  await assert.rejects(
    tx(async (c) => {
      const u = (await c.query("SELECT * FROM app_users LIMIT 1")).rows[0];
      await c.query(
        "INSERT INTO app_users(name,email,password_hash,role) VALUES($1,$2,$3,$4)",
        [u.name, u.email, u.password_hash, u.role],
      );
    }),
    /unique/i,
  );
});
dbtest("SQL rejects duplicate junction key", async () => {
  await assert.rejects(
    tx(async (c) => {
      const r = (await c.query("SELECT * FROM incident_assets LIMIT 1"))
        .rows[0];
      await c.query(
        "INSERT INTO incident_assets(incident_id,asset_id) VALUES($1,$2)",
        [r.incident_id, r.asset_id],
      );
    }),
    /unique/i,
  );
});
dbtest("Transaction rollback removes partial insert", async () => {
  const id = randomUUID();
  await assert.rejects(
    tx(async (c) => {
      const u = (await c.query("SELECT user_id FROM app_users LIMIT 1")).rows[0]
        .user_id;
      await c.query(
        "INSERT INTO incidents(incident_id,title,description,severity,detected_at,created_by) VALUES($1,'Rollback test','Long description for test','Low',now(),$2)",
        [id, u],
      );
      await c.query(
        "INSERT INTO incident_assets(incident_id,asset_id) VALUES($1,$2)",
        [id, randomUUID()],
      );
    }),
  );
  assert.equal(
    (await query("SELECT 1 FROM incidents WHERE incident_id=$1", [id]))
      .rowCount,
    0,
  );
});
dbtest("Status trigger records actor and history", async () => {
  await rollback(async (c) => {
    const i = (
      await c.query("SELECT * FROM incidents WHERE status='Open' LIMIT 1")
    ).rows[0];
    await c.query("SELECT set_config('app.actor_id',$1,true)", [i.created_by]);
    await c.query(
      "UPDATE incidents SET status='Investigating' WHERE incident_id=$1",
      [i.incident_id],
    );
    const h = (
      await c.query(
        "SELECT * FROM incident_status_history WHERE incident_id=$1 ORDER BY history_id DESC LIMIT 1",
        [i.incident_id],
      )
    ).rows[0];
    assert.equal(h.changed_by, i.created_by);
    assert.equal(h.new_status, "Investigating");
  });
});
dbtest("Illegal workflow transition rejected", async () => {
  await assert.rejects(
    tx(async (c) => {
      const i = (
        await c.query("SELECT * FROM incidents WHERE status='Open' LIMIT 1")
      ).rows[0];
      await c.query("SELECT set_config('app.actor_id',$1,true)", [
        i.created_by,
      ]);
      await c.query(
        "UPDATE incidents SET status='Closed' WHERE incident_id=$1",
        [i.incident_id],
      );
    }),
    /Invalid incident status transition/,
  );
});
dbtest("Status update without actor rejected", async () => {
  await assert.rejects(
    tx(async (c) => {
      const i = (
        await c.query("SELECT * FROM incidents WHERE status='Open' LIMIT 1")
      ).rows[0];
      await c.query(
        "UPDATE incidents SET status='Investigating' WHERE incident_id=$1",
        [i.incident_id],
      );
    }),
    /require app.actor_id/,
  );
});
dbtest("Completed remediation requires completion date", async () => {
  await assert.rejects(
    tx(async (c) => {
      await c.query(
        "UPDATE remediations SET status='Completed',completed_at=NULL WHERE remediation_id=(SELECT remediation_id FROM remediations LIMIT 1)",
      );
    }),
    /check constraint/i,
  );
});
dbtest("MongoDB rejects invalid log document", async () => {
  await setupMongo();
  await assert.rejects(
    (await mongo())
      .collection("incident_logs")
      .insertOne({ incident_id: "bad", message: 42 }),
    /validation/i,
  );
});
dbtest("MongoDB aggregates expected event totals", async () => {
  const db = await mongo(),
    r = await db.collection("incident_logs").findOne({});
  const groups = await db
    .collection("incident_logs")
    .aggregate([
      { $match: { incident_id: r!.incident_id } },
      { $group: { _id: "$event_type", total: { $sum: 1 } } },
    ])
    .toArray();
  const sum = groups.reduce((n: number, r: any) => n + r.total, 0);
  assert.equal(
    sum,
    await db
      .collection("incident_logs")
      .countDocuments({ incident_id: r!.incident_id }),
  );
});
dbtest("pgvector cosine ranks identical vectors first", async () => {
  const a = Array(384).fill(0);
  a[0] = 1;
  const b = Array(384).fill(0);
  b[1] = 1;
  const r = await query(
    "SELECT 1-($1::vector <=> $1::vector) AS identical,1-($1::vector <=> $2::vector) AS unrelated",
    [JSON.stringify(a), JSON.stringify(b)],
  );
  assert.equal(Number(r.rows[0].identical), 1);
  assert.equal(Number(r.rows[0].unrelated), 0);
});
dbtest("Incident overview does not multiply incident rows", async () => {
  const a = Number(
      (await query("SELECT count(*) FROM incidents")).rows[0].count,
    ),
    b = Number(
      (await query("SELECT count(*) FROM incident_overview")).rows[0].count,
    );
  assert.equal(a, b);
});
