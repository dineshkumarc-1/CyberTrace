import "dotenv/config";
import { readFile } from "node:fs/promises";
import { query, close } from "../lib/db";
import { setupMongo } from "../mongo/setup";
async function main() {
  await query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
  );
  if (
    !(await query("SELECT 1 FROM schema_migrations WHERE name='001_schema'"))
      .rowCount
  ) {
    await query(
      "BEGIN;" +
        (await readFile("sql/001_schema.sql", "utf8")) +
        ";INSERT INTO schema_migrations(name) VALUES('001_schema');COMMIT;",
    );
  }
  await setupMongo();
  console.log("PostgreSQL schema and MongoDB validators/indexes ready");
}
main()
  .then(close)
  .catch(async (e) => {
    console.error(e);
    await close();
    process.exit(1);
  });
