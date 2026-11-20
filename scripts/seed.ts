import "dotenv/config";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { query, tx, mongo, close } from "../lib/db";
import { enqueue } from "../lib/indexing";
const families = [
  [
    "Credential phishing",
    "Employee entered account credentials on an imitation sign-in page delivered by email. Unauthorized mailbox access followed.",
    "Revoke active sessions, reset the password, enable multifactor authentication and block the phishing domain.",
    "authentication_anomaly",
    "T1566",
  ],
  [
    "Ransomware encryption",
    "A malicious executable encrypted files on a workstation and demanded payment. Shared folders became inaccessible.",
    "Isolate the host, remove the malicious payload, rebuild the workstation and restore clean offline backups.",
    "file_encryption",
    "T1486",
  ],
  [
    "SQL injection",
    "Untrusted SQL fragments in a web request bypassed database input handling and exposed application records.",
    "Replace concatenated SQL with parameterized queries, restrict database privileges and review exposed records.",
    "web_attack",
    "T1190",
  ],
  [
    "Password guessing",
    "Repeated login failures from one remote source targeted multiple employee accounts against the VPN gateway.",
    "Rate limit authentication, block the abusive source and enforce multifactor authentication.",
    "authentication_failure",
    "T1110",
  ],
  [
    "Data exfiltration",
    "A compromised service account transferred confidential documents to an unfamiliar external destination.",
    "Disable the compromised account, block outbound transfers, rotate credentials and assess exposed information.",
    "outbound_transfer",
    "T1041",
  ],
  [
    "Privilege escalation",
    "An attacker exploited an outdated local component to obtain administrator permissions on a server.",
    "Patch the vulnerable component, remove unauthorized privileges and investigate lateral access.",
    "privilege_change",
    "T1068",
  ],
  [
    "Malicious PowerShell",
    "An encoded command launched a script interpreter to download and execute an untrusted payload.",
    "Stop malicious scripts, restrict scripting privileges and review endpoint execution policy.",
    "script_execution",
    "T1059.001",
  ],
  [
    "Web service denial",
    "A large burst of requests exhausted the public website connection pool and prevented normal customer access.",
    "Apply request rate limits, filter abusive traffic and increase service resilience.",
    "traffic_flood",
    "T1499",
  ],
  [
    "Malicious browser extension",
    "An unapproved browser add-on captured session cookies and redirected users to advertising pages.",
    "Remove the extension, revoke browser sessions and restrict extension installation to an allowlist.",
    "browser_extension",
    "T1176",
  ],
  [
    "Public cloud storage exposure",
    "An incorrectly configured storage bucket allowed unauthenticated downloads of internal project documents.",
    "Remove public permissions, apply least-privilege policies and review storage access logs.",
    "storage_access",
    "T1530",
  ],
];
async function main() {
  if (Number((await query("SELECT count(*) FROM incidents")).rows[0].count) > 0)
    throw new Error(
      "Seed requires an empty incident database; no data was overwritten.",
    );
  const ap = process.env.SEED_ADMIN_PASSWORD,
    bp = process.env.SEED_ANALYST_PASSWORD;
  if (
    !ap ||
    !bp ||
    ap.length < 12 ||
    bp.length < 12 ||
    ap.length > 72 ||
    bp.length > 72
  )
    throw new Error(
      "Set seed passwords of 12–72 characters in your local environment",
    );
  const ids = {
    admin: randomUUID(),
    analyst: randomUUID(),
    second: randomUUID(),
  };
  for (const [id, name, email, role, pw] of [
    [ids.admin, "Workspace Admin", "admin@cybertrace.test", "Admin", ap],
    [ids.analyst, "Maya Analyst", "analyst@cybertrace.test", "Analyst", bp],
    [ids.second, "Noah Analyst", "analyst2@cybertrace.test", "Analyst", bp],
  ])
    await query(
      "INSERT INTO app_users(user_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)",
      [id, name, email, await hash(pw, 12), role],
    );
  const assets: string[] = [];
  for (const [name, type, criticality, owner, location] of [
    ["Identity gateway", "Identity", "Critical", "Identity team", "Lab A"],
    ["Finance workstation", "Endpoint", "High", "Finance team", "Lab B"],
    ["Customer portal", "Web application", "High", "Application team", "Lab C"],
    ["Document server", "Server", "Critical", "Operations", "Lab A"],
    ["Cloud archive", "Storage", "Medium", "Cloud team", "Lab D"],
  ]) {
    assets.push(
      (
        await query(
          "INSERT INTO assets(asset_name,asset_type,criticality,owner_name,location) VALUES($1,$2,$3,$4,$5) RETURNING asset_id",
          [name, type, criticality, owner, location],
        )
      ).rows[0].asset_id,
    );
  }
  const vulns: string[] = [];
  for (const [name, description] of [
    [
      "Missing multifactor authentication",
      "Synthetic weakness: account access relies on one credential.",
    ],
    [
      "Unparameterized database query",
      "Synthetic weakness: untrusted input can alter SQL query structure.",
    ],
    [
      "Outdated software component",
      "Synthetic weakness: a local component has not been patched.",
    ],
    [
      "Overly broad storage policy",
      "Synthetic weakness: public read permission on sensitive objects.",
    ],
  ])
    vulns.push(
      (
        await query(
          "INSERT INTO vulnerabilities(name,severity,description) VALUES($1,'High',$2) RETURNING vulnerability_id",
          [name, description],
        )
      ).rows[0].vulnerability_id,
    );
  const techniques: string[] = [];
  for (const f of families)
    techniques.push(
      (
        await query(
          "INSERT INTO attack_techniques(technique_name,mitre_id,description) VALUES($1,$2,$3) RETURNING technique_id",
          [
            f[0],
            f[4],
            `Demo mapping for ${f[0]}; analyst must verify technique assignment in real incidents.`,
          ],
        )
      ).rows[0].technique_id,
    );
  const db = await mongo(),
    fixtures: any[] = [];
  for (let n = 0; n < 50; n++) {
    const f = families[n % 10],
      id = randomUUID(),
      creator = n % 3 === 0 ? ids.second : ids.analyst,
      assigned = n % 3 === 0 ? ids.second : ids.analyst,
      status = ["Open", "Investigating", "Contained", "Resolved", "Closed"][
        Math.floor(n / 10)
      ],
      sev = [
        "High",
        "Critical",
        "Medium",
        "High",
        "Critical",
        "High",
        "Medium",
        "High",
        "Low",
        "Medium",
      ][n % 10],
      detected = new Date(Date.now() - (50 - n) * 86400000);
    await tx(async (c) => {
      await c.query(
        "INSERT INTO incidents(incident_id,title,description,severity,status,detected_at,created_by,assigned_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          `${f[0]} · Training case ${String(n + 1).padStart(2, "0")}`,
          `${f[1]} This synthetic case occurred in training environment ${Math.floor(n / 10) + 1}.`,
          sev,
          status,
          detected,
          creator,
          assigned,
        ],
      );
      await c.query(
        "INSERT INTO incident_assets(incident_id,asset_id,impact) VALUES($1,$2,$3)",
        [id, assets[n % 5], "Investigation required"],
      );
      await c.query(
        "INSERT INTO incident_techniques(incident_id,technique_id) VALUES($1,$2)",
        [id, techniques[n % 10]],
      );
      await c.query(
        "INSERT INTO incident_vulnerabilities(incident_id,vulnerability_id) VALUES($1,$2)",
        [id, vulns[n % 4]],
      );
      await enqueue(c, "incident", id, id, 1);
      const done = ["Resolved", "Closed"].includes(status),
        rid = randomUUID();
      await c.query(
        "INSERT INTO remediations(remediation_id,incident_id,action,description,status,completed_at) VALUES($1,$2,$3,$4,$5,$6)",
        [
          rid,
          id,
          "Contain and remediate " + f[0].toLowerCase(),
          f[2],
          done ? "Completed" : "Pending",
          done ? detected : null,
        ],
      );
      await enqueue(c, "remediation", rid, id, 1);
    });
    const now = new Date(),
      report = await db
        .collection("investigation_reports")
        .insertOne({
          incident_id: id,
          summary: f[0] + " investigation findings",
          detailed_report:
            f[1] +
            " Analysts reviewed sample evidence and correlated the timeline. All events and identities in this record are synthetic.",
          remediation_summary: f[2],
          analyst_notes: [
            {
              author_id: assigned,
              text: "Training evidence reviewed; no real organizational records used.",
              created_at: now,
            },
          ],
          author_id: assigned,
          version: 1,
          created_at: now,
          updated_at: now,
        });
    await tx((c) => enqueue(c, "report", report.insertedId.toString(), id, 1));
    await db
      .collection("incident_logs")
      .insertMany(
        Array.from({ length: 4 }, (_, j) => ({
          incident_id: id,
          event_type: j < 3 ? f[3] : "investigation_note",
          event_time: new Date(detected.getTime() + j * 60000),
          source_ip: `192.0.2.${j + 10}`,
          message: `Synthetic ${f[0].toLowerCase()} sample event ${j + 1}`,
          raw_data: {
            training: true,
            sequence: j + 1,
            environment: "isolated lab",
          },
        })),
      );
    fixtures.push({ incident_id: id, family: n % 10, title: f[0] });
  }
  await mkdir(".local", { recursive: true });
  await writeFile(".local/seed-map.json", JSON.stringify(fixtures, null, 2));
  console.log(
    "Seeded 3 users, 50 incidents, 50 reports, 200 logs, 50 remediation tasks and 150 indexing jobs. Passwords were not printed.",
  );
}
main()
  .then(close)
  .catch(async (e) => {
    console.error(e);
    await close();
    process.exit(1);
  });
