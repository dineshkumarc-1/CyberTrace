import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { query, close } from "../lib/db";
import { embed, model } from "../lib/indexing";
const queries = [
  "Employee gave a password to a counterfeit login website",
  "Files were locked by malware demanding payment",
  "A crafted web input changed a database query",
  "Someone repeatedly guessed passwords on the remote access gateway",
  "Confidential files were sent outside the organization",
  "A local exploit granted administrator access",
  "An encoded script downloaded an executable",
  "Traffic overwhelmed the public application",
  "A rogue browser add-on stole login sessions",
  "Cloud documents were downloadable without signing in",
];
async function main() {
  const fixture = JSON.parse(await readFile(".local/seed-map.json", "utf8")),
    results = [];
  for (let n = 0; n < queries.length; n++) {
    const v = (await embed([queries[n]]))[0];
    const rows = (
      await query(
        `SELECT e.incident_id,min(e.embedding <=> $1::vector) AS distance FROM incident_embeddings e JOIN embedding_sources s ON s.source_type=e.source_type AND s.source_id=e.source_id JOIN incidents i ON i.incident_id=e.incident_id WHERE e.source_version=s.version AND e.model_name=$2 AND NOT i.archived GROUP BY e.incident_id ORDER BY distance LIMIT 5`,
        [JSON.stringify(v), model()],
      )
    ).rows;
    const ids = fixture
      .filter((r: any) => r.family === n)
      .map((r: any) => r.incident_id);
    const hits = rows.filter((r: any) => ids.includes(r.incident_id)).length;
    results.push({
      query: queries[n],
      relevantFamily: n,
      relevantCount: ids.length,
      resultIds: rows.map((r: any) => r.incident_id),
      hitAt5: hits > 0 ? 1 : 0,
      precisionAt5: rows.length ? hits / rows.length : 0,
    });
  }
  const output = {
    evaluatedAt: new Date().toISOString(),
    dataset:
      "50 synthetic incidents; labels based on seeded attack families; not a real-world benchmark",
    model: model(),
    hitAt5: results.reduce((s, r) => s + r.hitAt5, 0) / results.length,
    meanPrecisionAt5:
      results.reduce((s, r) => s + r.precisionAt5, 0) / results.length,
    results,
  };
  await writeFile(
    "docs/retrieval-results.json",
    JSON.stringify(output, null, 2),
  );
  console.log({
    hitAt5: output.hitAt5,
    meanPrecisionAt5: output.meanPrecisionAt5,
  });
}
main()
  .then(close)
  .catch(async (e) => {
    console.error(e);
    await close();
    process.exit(1);
  });
