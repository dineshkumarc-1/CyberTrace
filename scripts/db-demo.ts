import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { query, close, mongo } from "../lib/db";
async function main() {
  await query(await readFile("sql/002_demo_queries.sql", "utf8"));
  const groups = (
    await query(
      "SELECT severity,count(*) AS incidents FROM incidents WHERE NOT archived GROUP BY severity ORDER BY incidents DESC",
    )
  ).rows;
  const views = (
    await query(
      "SELECT title,assignee_name,asset_count FROM incident_overview ORDER BY detected_at DESC LIMIT 5",
    )
  ).rows;
  const db = await mongo();
  const r = await db.collection("incident_logs").findOne({});
  const logs = await db
    .collection("incident_logs")
    .aggregate([
      { $match: { incident_id: r!.incident_id } },
      { $group: { _id: "$event_type", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ])
    .toArray();
  const sqlVersion = (await query("SELECT version()")).rows[0];
  const mongoVersion = await db.admin().serverInfo();
  await writeFile(
    "docs/database-demo-results.json",
    JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        ddlDmlScript:
          "Completed; mutating demonstration statements rolled back",
        sqlVersion,
        mongoVersion: mongoVersion.version,
        severityGroups: groups,
        overviewSample: views,
        mongoAggregation: logs,
      },
      null,
      2,
    ),
  );
  console.log(
    "DDL/DML, advanced SQL, trigger and Mongo aggregation demonstrations executed.",
  );
}
main()
  .then(close)
  .catch(async (e) => {
    console.error(e);
    await close();
    process.exit(1);
  });
