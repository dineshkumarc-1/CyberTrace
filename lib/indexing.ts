import { query, tx, mongo, DB } from "./db";
import { ObjectId } from "mongodb";
export const model = () =>
  process.env.EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";
export async function enqueue(
  c: DB,
  type: string,
  id: string,
  incident: string,
  version: number,
) {
  await c.query(
    `INSERT INTO embedding_sources(source_type,source_id,incident_id,version) VALUES($1,$2,$3,$4)
 ON CONFLICT(source_type,source_id) DO UPDATE SET version=GREATEST(embedding_sources.version,EXCLUDED.version)`,
    [type, id, incident, version],
  );
  await c.query(
    `INSERT INTO embedding_jobs(source_type,source_id,incident_id,source_version) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [type, id, incident, version],
  );
}
export async function embed(texts: string[]): Promise<number[][]> {
  const r = await fetch(
    `${process.env.EMBEDDING_URL || "http://127.0.0.1:8001"}/embed`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts }),
      signal: AbortSignal.timeout(90000),
    },
  );
  if (!r.ok) throw new Error("Embedding service unavailable");
  const data = await r.json();
  if (data.model !== model()) throw new Error("Embedding model mismatch");
  if (
    !Array.isArray(data.vectors) ||
    data.vectors.length !== texts.length ||
    data.vectors.some(
      (v: any) =>
        !Array.isArray(v) ||
        v.length !== 384 ||
        v.some((n: any) => typeof n !== "number" || !Number.isFinite(n)) ||
        !v.some((n: number) => n !== 0),
    )
  )
    throw new Error("Invalid vectors");
  return data.vectors;
}
// Conservative 500-character windows avoid the model's short token limit for normal English.
// Dense code/log tokenization can still truncate; raw logs are intentionally excluded.
export function chunks(text: string) {
  const s = text.trim();
  const out: string[] = [];
  for (let i = 0; i < s.length; i += 420) out.push(s.slice(i, i + 500));
  return out.length ? out : ["No content"];
}
export async function source(j: any) {
  if (j.source_type === "incident") {
    const i = (
      await query("SELECT * FROM incidents WHERE incident_id=$1", [
        j.incident_id,
      ])
    ).rows[0];
    return i && { version: i.version, text: `${i.title}\n${i.description}` };
  }
  if (j.source_type === "report") {
    const r = await (
      await mongo()
    )
      .collection("investigation_reports")
      .findOne({ _id: new ObjectId(j.source_id) });
    return (
      r && {
        version: r.version,
        text: `${r.summary}\n${r.detailed_report}\n${r.remediation_summary}`,
      }
    );
  }
  const r = (
    await query("SELECT * FROM remediations WHERE remediation_id=$1", [
      j.source_id,
    ])
  ).rows[0];
  return (
    r && {
      version: r.version,
      text: `${r.action}\n${r.description}\nStatus: ${r.status}`,
    }
  );
}
export async function runOne() {
  const j = await tx(async (c) => {
    await c.query(
      "UPDATE embedding_jobs SET status='Pending' WHERE status='Processing' AND updated_at<now()-interval '10 minutes'",
    );
    const row = (
      await c.query(
        "SELECT * FROM embedding_jobs WHERE status='Pending' ORDER BY job_id FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!row) return null;
    await c.query(
      "UPDATE embedding_jobs SET status='Processing',attempts=attempts+1,updated_at=now() WHERE job_id=$1",
      [row.job_id],
    );
    return row;
  });
  if (!j) return false;
  try {
    const s = await source(j);
    if (!s || s.version !== j.source_version) {
      await query(
        "UPDATE embedding_jobs SET status='Failed',error='Superseded source version',updated_at=now() WHERE job_id=$1",
        [j.job_id],
      );
      return true;
    }
    const texts = chunks(s.text),
      vectors = await embed(texts);
    await tx(async (c) => {
      const live = (
        await c.query(
          "SELECT version FROM embedding_sources WHERE source_type=$1 AND source_id=$2 FOR UPDATE",
          [j.source_type, j.source_id],
        )
      ).rows[0];
      if (!live || live.version !== j.source_version)
        throw new Error("Source changed during indexing");
      await c.query(
        "DELETE FROM incident_embeddings WHERE source_type=$1 AND source_id=$2",
        [j.source_type, j.source_id],
      );
      for (let k = 0; k < texts.length; k++)
        await c.query(
          "INSERT INTO incident_embeddings(incident_id,source_type,source_id,source_version,chunk_index,content_text,embedding,model_name) VALUES($1,$2,$3,$4,$5,$6,$7::vector,$8)",
          [
            j.incident_id,
            j.source_type,
            j.source_id,
            j.source_version,
            k,
            texts[k],
            JSON.stringify(vectors[k]),
            model(),
          ],
        );
      await c.query(
        "UPDATE embedding_jobs SET status='Ready',error=NULL,updated_at=now() WHERE job_id=$1",
        [j.job_id],
      );
    });
  } catch (e) {
    await query(
      "UPDATE embedding_jobs SET status='Failed',error=$2,updated_at=now() WHERE job_id=$1",
      [j.job_id, String((e as Error).message).slice(0, 300)],
    );
  }
  return true;
}
export async function reconcile() {
  let n = 0;
  for (const i of (
    await query("SELECT incident_id,version FROM incidents WHERE NOT archived")
  ).rows) {
    await enqueue(
      { query },
      "incident",
      i.incident_id,
      i.incident_id,
      i.version,
    );
    n++;
  }
  for (const r of (await query("SELECT * FROM remediations")).rows) {
    await enqueue(
      { query },
      "remediation",
      r.remediation_id,
      r.incident_id,
      r.version,
    );
    n++;
  }
  const cursor = (await mongo()).collection("investigation_reports").find();
  for await (const r of cursor) {
    if (
      (
        await query("SELECT 1 FROM incidents WHERE incident_id=$1", [
          r.incident_id,
        ])
      ).rowCount
    ) {
      await enqueue(
        { query },
        "report",
        r._id.toString(),
        r.incident_id,
        r.version,
      );
      n++;
    }
  }
  return n;
}
