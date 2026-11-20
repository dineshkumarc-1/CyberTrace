import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { ObjectId } from "mongodb";
import { z, ZodError } from "zod";
import { query, tx, mongo } from "./db";
import {
  HttpError,
  current,
  admin,
  scope,
  incident,
  mutationGuard,
  login,
  token,
} from "./auth";
import * as V from "./validation";
import { embed, enqueue, model } from "./indexing";
const refTables: any = {
  assets: ["assets", "asset_id"],
  vulnerabilities: ["vulnerabilities", "vulnerability_id"],
  techniques: ["attack_techniques", "technique_id"],
};
function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
async function body(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 100000)
    throw new HttpError(413, "Request too large");
  const text = await req.text();
  if (Buffer.byteLength(text) > 100000)
    throw new HttpError(413, "Request too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
function pageOf(url: URL) {
  const p = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .parse(url.searchParams.get("page") || 1);
  return { page: p, limit: 15, offset: (p - 1) * 15 };
}
export async function handle(req: Request, parts: string[]) {
  try {
    const method = req.method,
      url = new URL(req.url);
    if (method !== "GET") mutationGuard(req);
    if (parts.join("/") === "auth/login" && method === "POST") {
      const b = z
        .object({
          email: z
            .email()
            .max(254)
            .transform((s) => s.toLowerCase()),
          password: z.string().min(1).max(72),
        })
        .strict()
        .parse(await body(req));
      const u = await login(b.email, b.password);
      const res = json({
        user: {
          user_id: u.user_id,
          name: u.name,
          email: u.email,
          role: u.role,
        },
      });
      res.cookies.set("ct_session", await token(u), {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.APP_ORIGIN?.startsWith("https://"),
        path: "/",
        maxAge: 28800,
      });
      return res;
    }
    const u = await current(req);
    if (parts.join("/") === "auth/logout" && method === "POST") {
      const res = json({ ok: true });
      res.cookies.set("ct_session", "", { path: "/", maxAge: 0 });
      return res;
    }
    if (parts.join("/") === "auth/me" && method === "GET")
      return json({ user: u });
    if (parts[0] === "lookups" && method === "GET")
      return json({
        assets: (await query("SELECT * FROM assets ORDER BY asset_name")).rows,
        vulnerabilities: (
          await query("SELECT * FROM vulnerabilities ORDER BY name")
        ).rows,
        techniques: (
          await query("SELECT * FROM attack_techniques ORDER BY technique_name")
        ).rows,
        users: (
          await query(
            "SELECT user_id,name,role FROM app_users WHERE active ORDER BY name",
          )
        ).rows,
      });
    if (parts[0] === "dashboard" && method === "GET") {
      const s = scope(u);
      const rows = (
        await query(
          `SELECT status,severity,count(*)::integer AS total FROM incidents i WHERE NOT archived AND ${s.sql} GROUP BY status,severity`,
          s.params,
        )
      ).rows;
      const recent = (
        await query(
          `SELECT incident_id,title,severity,status,detected_at FROM incidents i WHERE NOT archived AND ${s.sql} ORDER BY detected_at DESC LIMIT 5`,
          s.params,
        )
      ).rows;
      return json({ groups: rows, recent });
    }
    if (parts[0] === "incidents" && parts.length === 1) {
      if (method === "GET") {
        const s = scope(u),
          params: any[] = [...s.params],
          where = [s.sql];
        function add(sql: string, val: any) {
          params.push(val);
          where.push(sql.replace("?", `$${params.length}`));
        }
        where.push(
          url.searchParams.get("archived") === "true"
            ? "i.archived"
            : "NOT i.archived",
        );
        if (url.searchParams.get("severity"))
          add(
            "i.severity=?",
            V.severity.parse(url.searchParams.get("severity")),
          );
        if (url.searchParams.get("status"))
          add("i.status=?", V.status.parse(url.searchParams.get("status")));
        const q = z
          .string()
          .max(200)
          .parse(url.searchParams.get("q") || "");
        if (q) {
          params.push("%" + q + "%");
          where.push(
            `(i.title ILIKE $${params.length} OR i.description ILIKE $${params.length})`,
          );
        }
        const { page, limit, offset } = pageOf(url),
          condition = where.join(" AND ");
        const total = Number(
          (
            await query(
              `SELECT count(*) FROM incidents i WHERE ${condition}`,
              params,
            )
          ).rows[0].count,
        );
        const rows = (
          await query(
            `SELECT i.* FROM incident_overview i WHERE ${condition} ORDER BY i.detected_at DESC,i.incident_id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset],
          )
        ).rows;
        return json({ rows, total, page, limit });
      }
      if (method === "POST") {
        const b = V.incidentCreate.parse(await body(req));
        if (u.role !== "Admin" && b.assigned_to)
          throw new HttpError(403, "Only Admin assigns incidents");
        const i = await tx(async (c) => {
          if (
            b.assigned_to &&
            !(
              await c.query(
                "SELECT 1 FROM app_users WHERE user_id=$1 AND active",
                [b.assigned_to],
              )
            ).rowCount
          )
            throw new HttpError(400, "Invalid assignee");
          const i = (
            await c.query(
              "INSERT INTO incidents(title,description,severity,detected_at,created_by,assigned_to) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
              [
                b.title,
                b.description,
                b.severity,
                b.detected_at,
                u.user_id,
                u.role === "Admin" ? b.assigned_to || null : u.user_id,
              ],
            )
          ).rows[0];
          for (const [key, table, col] of [
            ["assets", "incident_assets", "asset_id"],
            ["vulnerabilities", "incident_vulnerabilities", "vulnerability_id"],
            ["techniques", "incident_techniques", "technique_id"],
          ] as const)
            for (const id of new Set(b[key]))
              await c.query(
                `INSERT INTO ${table}(incident_id,${col}) VALUES($1,$2)`,
                [i.incident_id, id],
              );
          await enqueue(c, "incident", i.incident_id, i.incident_id, i.version);
          return i;
        }, u.user_id);
        return json(i, 201);
      }
    }
    if (parts[0] === "incidents" && parts[1]) {
      const id = V.uuid.parse(parts[1]);
      if (parts.length === 2 && method === "GET") {
        const i = await incident(id, u),
          db = await mongo();
        const related: any = {};
        for (const [key, table, col] of [
          ["assets", "incident_assets", "asset_id"],
          ["vulnerabilities", "incident_vulnerabilities", "vulnerability_id"],
          ["techniques", "incident_techniques", "technique_id"],
        ])
          related[key] = (
            await query(
              `SELECT r.*,j.* FROM ${table} j JOIN ${refTables[key][0]} r ON r.${col}=j.${col} WHERE j.incident_id=$1`,
              [id],
            )
          ).rows;
        return json({
          incident: i,
          ...related,
          reports: await db
            .collection("investigation_reports")
            .find({ incident_id: id })
            .sort({ updated_at: -1 })
            .limit(50)
            .toArray(),
          remediations: (
            await query(
              "SELECT * FROM remediations WHERE incident_id=$1 ORDER BY action",
              [id],
            )
          ).rows,
          history: (
            await query(
              "SELECT h.*,u.name AS actor_name FROM incident_status_history h JOIN app_users u ON u.user_id=h.changed_by WHERE incident_id=$1 ORDER BY history_id DESC LIMIT 100",
              [id],
            )
          ).rows,
          jobs: (
            await query(
              "SELECT job_id,source_type,status,error,attempts FROM embedding_jobs WHERE incident_id=$1 ORDER BY job_id DESC LIMIT 30",
              [id],
            )
          ).rows,
        });
      }
      if (parts.length === 2 && method === "PATCH") {
        await incident(id, u);
        const b = V.incidentPatch.parse(await body(req));
        if (u.role !== "Admin" && ("assigned_to" in b || "archived" in b))
          throw new HttpError(403, "Admin role required");
        const updated = await tx(async (c) => {
          const i = (
            await c.query(
              "SELECT * FROM incidents WHERE incident_id=$1 FOR UPDATE",
              [id],
            )
          ).rows[0];
          if (u.role !== "Admin" && (i.assigned_to !== u.user_id || i.archived))
            throw new HttpError(403, "Incident is not editable");
          if (i.version !== b.version)
            throw new HttpError(409, "Incident changed. Reload and retry.");
          if (
            b.assigned_to &&
            !(
              await c.query(
                "SELECT 1 FROM app_users WHERE user_id=$1 AND active",
                [b.assigned_to],
              )
            ).rowCount
          )
            throw new HttpError(400, "Invalid assignee");
          const entries = Object.entries(b).filter(([k]) => k !== "version");
          if (!entries.length) return i;
          const r = (
            await c.query(
              `UPDATE incidents SET ${entries.map(([k], n) => `${k}=$${n + 2}`).join(",")} WHERE incident_id=$1 RETURNING *`,
              [id, ...entries.map(([, v]) => v)],
            )
          ).rows[0];
          await enqueue(c, "incident", id, id, r.version);
          return r;
        }, u.user_id);
        return json(updated);
      }
      if (parts[2] === "links" && ["POST", "DELETE"].includes(method)) {
        await incident(id, u, true);
        const b = z
          .object({
            kind: z.enum(["assets", "vulnerabilities", "techniques"]),
            id: V.uuid,
          })
          .strict()
          .parse(await body(req));
        const [table, col] =
          b.kind === "assets"
            ? ["incident_assets", "asset_id"]
            : b.kind === "vulnerabilities"
              ? ["incident_vulnerabilities", "vulnerability_id"]
              : ["incident_techniques", "technique_id"];
        if (method === "POST")
          await query(
            `INSERT INTO ${table}(incident_id,${col}) VALUES($1,$2) ON CONFLICT DO NOTHING`,
            [id, b.id],
          );
        else
          await query(
            `DELETE FROM ${table} WHERE incident_id=$1 AND ${col}=$2`,
            [id, b.id],
          );
        return json({ ok: true });
      }
      if (parts[2] === "reports" && method === "POST") {
        await incident(id, u, true);
        const b = V.reportCreate.parse(await body(req));
        const db = await mongo(),
          now = new Date();
        const r = await db
          .collection("investigation_reports")
          .insertOne({
            incident_id: id,
            summary: b.summary,
            detailed_report: b.detailed_report,
            remediation_summary: b.remediation_summary,
            analyst_notes: b.note
              ? [{ author_id: u.user_id, text: b.note, created_at: now }]
              : [],
            author_id: u.user_id,
            version: 1,
            created_at: now,
            updated_at: now,
          });
        let indexing = "Pending";
        try {
          await tx((c) => enqueue(c, "report", r.insertedId.toString(), id, 1));
        } catch {
          indexing = "Reconciliation required";
        }
        return json({ id: r.insertedId, indexing }, 201);
      }
      if (parts[2] === "reports" && parts[3] && method === "PATCH") {
        await incident(id, u, true);
        if (!ObjectId.isValid(parts[3]))
          throw new HttpError(400, "Invalid report ID");
        const b = V.reportCreate
            .extend({ version: z.number().int().positive() })
            .parse(await body(req)),
          db = await mongo();
        const r = await db
          .collection("investigation_reports")
          .findOneAndUpdate(
            {
              _id: new ObjectId(parts[3]),
              incident_id: id,
              version: b.version,
            },
            {
              $set: {
                summary: b.summary,
                detailed_report: b.detailed_report,
                remediation_summary: b.remediation_summary,
                updated_at: new Date(),
              },
              $inc: { version: 1 },
              ...(b.note
                ? {
                    $push: {
                      analyst_notes: {
                        author_id: u.user_id,
                        text: b.note,
                        created_at: new Date(),
                      },
                    } as any,
                  }
                : {}),
            },
            { returnDocument: "after" },
          );
        if (!r)
          throw new HttpError(
            409,
            "Report changed or missing. Reload and retry.",
          );
        let indexing = "Pending";
        try {
          await tx((c) =>
            enqueue(c, "report", r._id.toString(), id, r.version),
          );
        } catch {
          indexing = "Reconciliation required";
        }
        return json({ id: r._id, indexing });
      }
      if (parts[2] === "logs") {
        await incident(id, u, method !== "GET");
        const db = await mongo();
        if (method === "GET") {
          const { page, limit, offset } = pageOf(url);
          return json({
            rows: await db
              .collection("incident_logs")
              .find({ incident_id: id })
              .sort({ event_time: -1 })
              .skip(offset)
              .limit(limit)
              .toArray(),
            total: await db
              .collection("incident_logs")
              .countDocuments({ incident_id: id }),
            page,
            groups: await db
              .collection("incident_logs")
              .aggregate([
                { $match: { incident_id: id } },
                { $group: { _id: "$event_type", total: { $sum: 1 } } },
                { $sort: { total: -1 } },
              ])
              .toArray(),
          });
        }
        if (method === "POST") {
          const b = V.logCreate.parse(await body(req));
          const r = await db
            .collection("incident_logs")
            .insertOne({
              ...b,
              event_time: new Date(b.event_time),
              incident_id: id,
            });
          return json({ id: r.insertedId }, 201);
        }
      }
      if (parts[2] === "remediations") {
        await incident(id, u, true);
        if (method === "POST") {
          const b = V.remediationCreate.parse(await body(req));
          const r = await tx(async (c) => {
            const r = (
              await c.query(
                "INSERT INTO remediations(incident_id,action,description) VALUES($1,$2,$3) RETURNING *",
                [id, b.action, b.description],
              )
            ).rows[0];
            await enqueue(c, "remediation", r.remediation_id, id, r.version);
            return r;
          });
          return json(r, 201);
        }
        if (method === "PATCH" && parts[3]) {
          const rid = V.uuid.parse(parts[3]),
            b = V.remediationPatch.parse(await body(req));
          const r = await tx(async (c) => {
            const r = (
              await c.query(
                "UPDATE remediations SET status=$3,completed_at=CASE WHEN $3='Completed' THEN now() ELSE NULL END,version=version+1 WHERE remediation_id=$1 AND incident_id=$2 RETURNING *",
                [rid, id, b.status],
              )
            ).rows[0];
            if (!r) throw new HttpError(404, "Remediation missing");
            await enqueue(c, "remediation", rid, id, r.version);
            return r;
          });
          return json(r);
        }
      }
      if (parts[2] === "retry" && method === "POST") {
        await incident(id, u, true);
        await query(
          "UPDATE embedding_jobs SET status='Pending',error=NULL,updated_at=now() WHERE incident_id=$1 AND status='Failed' AND source_version=(SELECT version FROM embedding_sources s WHERE s.source_type=embedding_jobs.source_type AND s.source_id=embedding_jobs.source_id)",
          [id],
        );
        return json({ ok: true });
      }
    }
    if (parts[0] === "search" && method === "POST") {
      const b = z
        .object({
          q: z.string().trim().min(3).max(1000),
          severity: V.severity.optional(),
          status: V.status.optional(),
        })
        .strict()
        .parse(await body(req));
      let vector: number[];
      try {
        vector = (await embed([b.q]))[0];
      } catch {
        throw new HttpError(
          503,
          "Semantic model unavailable. Start the embedding service; keyword search remains available.",
        );
      }
      const s = scope(u, "i", 3),
        params: any[] = [JSON.stringify(vector), model(), ...s.params];
      const filters = [s.sql, "NOT i.archived", "e.source_version=s.version"];
      if (b.severity) {
        params.push(b.severity);
        filters.push(`i.severity=$${params.length}`);
      }
      if (b.status) {
        params.push(b.status);
        filters.push(`i.status=$${params.length}`);
      }
      // Exact ranking over all authorized chunks, then retain the best chunk per incident.
      const candidates = (
        await query(
          `SELECT e.incident_id,i.title,i.severity,i.status,e.content_text,e.source_type,e.source_id,e.source_version,1-(e.embedding <=> $1::vector) AS similarity FROM incident_embeddings e JOIN incidents i ON i.incident_id=e.incident_id JOIN embedding_sources s ON s.source_type=e.source_type AND s.source_id=e.source_id WHERE e.model_name=$2 AND ${filters.join(" AND ")} ORDER BY e.embedding <=> $1::vector`,
          params,
        )
      ).rows;
      const rows: any[] = [],
        seen = new Set();
      let db: any;
      for (const r of candidates) {
        if (seen.has(r.incident_id)) continue;
        // Live Mongo version check also protects the SQL/Mongo reconciliation window.
        if (r.source_type === "report") {
          db ||= await mongo();
          const doc = await db
            .collection("investigation_reports")
            .findOne(
              { _id: new ObjectId(r.source_id), version: r.source_version },
              { projection: { _id: 1 } },
            );
          if (!doc) continue;
        }
        seen.add(r.incident_id);
        rows.push(r);
        if (rows.length === 5) break;
      }
      return json({
        rows,
        model: model(),
        metric: "cosine similarity; not a confidence probability",
      });
    }
    if (parts[0] === "admin") {
      admin(u);
      if (parts[1] === "users") {
        if (method === "GET")
          return json({
            rows: (
              await query(
                "SELECT user_id,name,email,role,active,created_at FROM app_users ORDER BY name",
              )
            ).rows,
          });
        if (method === "POST") {
          const b = V.userCreate.parse(await body(req));
          const r = (
            await query(
              "INSERT INTO app_users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING user_id,name,email,role,active",
              [b.name, b.email, await hash(b.password, 12), b.role],
            )
          ).rows[0];
          return json(r, 201);
        }
        if (method === "PATCH" && parts[2]) {
          const id = V.uuid.parse(parts[2]),
            b = z
              .object({
                role: z.enum(["Admin", "Analyst"]).optional(),
                active: z.boolean().optional(),
              })
              .strict()
              .parse(await body(req));
          if (id === u.user_id)
            throw new HttpError(
              400,
              "Cannot change your own role or active state",
            );
          // Serialize admin-account changes to preserve at least one active administrator.
          await tx(async (c) => {
            await c.query("SELECT pg_advisory_xact_lock(84722)");
            const target = (
              await c.query(
                "SELECT * FROM app_users WHERE user_id=$1 FOR UPDATE",
                [id],
              )
            ).rows[0];
            if (!target) throw new HttpError(404, "User missing");
            if (
              target.role === "Admin" &&
              target.active &&
              (b.role === "Analyst" || b.active === false)
            ) {
              const count = Number(
                (
                  await c.query(
                    "SELECT count(*) FROM app_users WHERE role='Admin' AND active",
                  )
                ).rows[0].count,
              );
              if (count <= 1)
                throw new HttpError(
                  400,
                  "At least one active Admin is required",
                );
            }
            await c.query(
              "UPDATE app_users SET role=COALESCE($2,role),active=COALESCE($3,active),token_version=token_version+1 WHERE user_id=$1",
              [id, b.role ?? null, b.active ?? null],
            );
          });
          return json({ ok: true });
        }
      }
      if (parts[1] === "references" && parts[2] && refTables[parts[2]]) {
        const kind = parts[2] as keyof typeof V.refs,
          [table, col] = refTables[kind];
        if (method === "POST") {
          const b = V.refs[kind].parse(await body(req)),
            keys = Object.keys(b);
          const r = await query(
            `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`,
            Object.values(b),
          );
          return json(r.rows[0], 201);
        }
        if (method === "PATCH" && parts[3]) {
          const id = V.uuid.parse(parts[3]),
            b = V.refs[kind].parse(await body(req)),
            keys = Object.keys(b);
          const r = await query(
            `UPDATE ${table} SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(",")} WHERE ${col}=$1 RETURNING *`,
            [id, ...Object.values(b)],
          );
          if (!r.rowCount) throw new HttpError(404, "Record missing");
          return json(r.rows[0]);
        }
        if (method === "DELETE" && parts[3]) {
          const r = await query(`DELETE FROM ${table} WHERE ${col}=$1`, [
            V.uuid.parse(parts[3]),
          ]);
          if (!r.rowCount) throw new HttpError(404, "Record missing");
          return json({ ok: true });
        }
      }
    }
    throw new HttpError(404, "Endpoint not found");
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof ZodError)
      return json(
        {
          error: "Validation failed",
          details: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        400,
      );
    if (e.code === "23505")
      return json(
        { error: "A record with these unique values already exists" },
        409,
      );
    if (e.code === "23503")
      return json(
        { error: "Referenced record is missing or is still in use" },
        409,
      );
    if (
      ["23514", "23502", "22P02", "22007", "22008", "P0001"].includes(e.code) ||
      e.code === 121
    )
      return json(
        {
          error:
            e.code === "P0001"
              ? "Invalid status transition"
              : "Database validation rejected the data",
        },
        400,
      );
    console.error("API failure:", e.name, e.code || "", e.message);
    return json(
      {
        error:
          "Service unavailable. Check server configuration and database health.",
      },
      503,
    );
  }
}
