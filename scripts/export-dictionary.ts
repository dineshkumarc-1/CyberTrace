import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { query, close } from "../lib/db";
async function main() {
  const rows = (
    await query(
      `SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name NOT IN ('incident_overview','schema_migrations') ORDER BY table_name,ordinal_position`,
    )
  ).rows;
  let text =
    "# Data dictionary\n\nGenerated from the implemented database schema. Full constraints follow each table; composite primary and foreign keys are authoritative there. Derived vector chunks are not authoritative incident records.\n";
  for (const name of [...new Set<string>(rows.map((r: any) => r.table_name))]) {
    text +=
      "\n## " +
      name +
      "\n\n| Attribute | SQL type | Nullable | Default |\n|---|---|---|---|\n";
    for (const r of rows.filter((r: any) => r.table_name === name))
      text += `| ${r.column_name} | ${r.data_type === "USER-DEFINED" ? r.udt_name : r.data_type} | ${r.is_nullable} | ${String(r.column_default ?? "—").replaceAll("|", "\\|")} |\n`;
    const constraints = (
      await query(
        `SELECT c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname=$1 ORDER BY c.contype,c.conname`,
        [name],
      )
    ).rows;
    text +=
      "\nConstraints:\n" +
      constraints
        .map((c: any) => "- `" + c.definition.replaceAll("`", "") + "`")
        .join("\n") +
      "\n";
  }
  text +=
    "\n## MongoDB and vector metadata\nSee DATA-MODEL.md for every document field, validation rule, compound index, embedding dimension and retrieval rule.\n";
  await writeFile("docs/DATA-DICTIONARY.md", text);
}
main()
  .then(close)
  .catch(async (e) => {
    console.error(e);
    await close();
    process.exit(1);
  });
