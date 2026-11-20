# CyberTrace
Cybersecurity Incident Management and Semantic Knowledge Retrieval — DBMS Level 3 mini project.

**Start here:** `docs/START-HERE.md`. Delivery verification and limitations: `docs/TEST-RESULTS.md`.
This is an AI-assisted implementation for study and adaptation. Your course forbids copying an existing project. Obtain your instructor's approval for AI assistance, understand the code, and make and document your team's own design/implementation contributions. Do not claim generated work or test runs as personal contributions.

## Stack and scope
Next.js 16 / React 19 / TypeScript; PostgreSQL + pgvector; MongoDB; local ONNX sentence embeddings.
Admin and Analyst roles; incident workflow; asset/vulnerability/technique linking; report editing and notes; paginated logs and Mongo aggregation; remediation; audit history; authorized keyword and semantic retrieval; dashboard; account and reference-data administration.
This is not a SIEM, malware detector, or production security product. Use only synthetic data.

## Prerequisites
Node.js 22 or 24, npm, Docker Engine + Docker Compose, a browser, initial internet access for npm/images/model download. Allocate about 4 GB RAM or more. Python is **not** required to run the application. PostgreSQL 16 with pgvector and MongoDB 8 may also be installed natively.

## Recommended setup (Docker databases)
1. `npm ci`
2. Copy `.env.example` to `.env`.
3. Set `POSTGRES_PASSWORD` and `MONGO_PASSWORD` in `.env` (alphanumeric demo values simplify URL configuration). Set matching URLs:
   ```dotenv
   DATABASE_URL=postgresql://cybertrace:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/cybertrace
   MONGODB_URI=mongodb://cybertrace:YOUR_MONGO_PASSWORD@127.0.0.1:27017/?authSource=admin
   MONGODB_DB=cybertrace
   SESSION_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
   APP_ORIGIN=http://localhost:3000
   EMBEDDING_URL=http://127.0.0.1:8001
   EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
   SEED_ADMIN_PASSWORD=YOUR_DEMO_PASSWORD_AT_LEAST_12_CHARACTERS
   SEED_ANALYST_PASSWORD=ANOTHER_DEMO_PASSWORD_AT_LEAST_12_CHARACTERS
   ```
   Generate a secret with `openssl rand -hex 32`. URL-encode special characters in connection-string passwords. Never prefix secrets with `NEXT_PUBLIC_`.
4. `docker compose up -d`
5. `npm run db:setup`
6. `npm run db:seed` — empty incident database only; refuses to overwrite incidents.
7. Terminal A: `npm run embeddings` — first run downloads an ONNX model; wait for the listening message.
8. Terminal B: `npm run worker` — leave running; indexes pending sources.
9. Terminal C: `npm run dev` — open **http://localhost:3000**, matching `APP_ORIGIN` exactly.

Seed accounts: `admin@cybertrace.test`, `analyst@cybertrace.test`, `analyst2@cybertrace.test`.
Passwords are the local values you configured, not hard-coded defaults. Both analysts share the seed analyst password; create separate passwords/accounts before any non-demo use. Passwords are hashed with bcrypt cost 12.

### Production-style local build
`npm run typecheck && npm run build && npm start`
This does not make the project production hardened. Deployment notes: `docs/SECURITY.md`.

## Database scripts
- `sql/001_schema.sql`: entities, constraints, indexes, view, workflow/audit trigger.
- `sql/002_demo_queries.sql`: DDL/DML, joins, grouping, HAVING, aggregates, subquery, EXPLAIN; all changes roll back.
- `sql/003_optional_vector_index.sql`: optional HNSW; not needed for 50 incidents.
- `mongo/setup.ts`: JSON-schema validators and compound indexes.
- `npm run reconcile`: find sources missing indexing jobs; safe to rerun.
- `npm run worker -- --drain`: process pending jobs and exit.
- Failed current jobs can be retried on the incident's History & indexing tab; then run the worker.

Run demonstration SQL:
`docker compose exec -T postgres psql -U cybertrace -d cybertrace < sql/002_demo_queries.sql`
The bootstrap database user is privileged for migrations. For shared deployments create a restricted runtime SQL role and Mongo readWrite user after setup; do not use database owner/root credentials in the application.

## Tests
- `npm test`: unit + database integration tests. Database cases skip if URLs are absent. Run after setup and seeding, against a dedicated synthetic test database.
- `npm run evaluate`: ten family-labelled synthetic queries; writes `docs/retrieval-results.json`. Run after the worker drains. Seed labels are saved in ignored `.local/seed-map.json`; reseeding a fresh database regenerates them.
- `npm run test:e2e`: requires running application/model, seeded database, and indexed incidents. Tests create an E2E synthetic incident and evidence. Use a dedicated demo/test database.
- Playwright defaults to `/usr/local/bin/chromium`; set `CHROMIUM_PATH` to your local Chromium/Chrome executable. Alternatively edit Playwright config to remove `executablePath` and run `npx playwright install chromium`.
- E2E screenshots are generated under `docs/screenshots/`. Existing screenshots show the delivery's actual local run, not your installation.

## Alternative restricted-environment test harness
`npm run test:services` starts PGlite PostgreSQL-engine + pgvector through a loopback-only test HTTP transport and a downloaded MongoDB binary. **It overwrites `.env` with generated local-only secrets**; back up an existing `.env` first. It is a sandbox testing aid, not the recommended deployment. Download defaults target Amazon Linux 2023; other hosts can override MONGOMS_DOWNLOAD_URL or use Docker. TEST_DATABASE_HTTP activates this isolated test transport; leave it unset for a normal PostgreSQL deployment. Mongo data is ephemeral; remove `.local/pglite` and rerun setup/seed for a complete reset. Do not use this harness with real data. See TEST-RESULTS for the environment actually verified.

## Structure
`app/` UI and route entry; `lib/` auth, validation, SQL/Mongo API, indexing; `sql/` migration/demos; `mongo/` validation; `embeddings/` ONNX service; `scripts/` setup/seed/worker/reconcile/evaluate; `tests/` unit/integration/E2E; `docs/` submission deliverables.

## Team / originality / Git
Fill real names and contributions in `docs/TEAM-CONTRIBUTIONS.md`. A local Git repository may be included, but you must create your own GitHub repository, review secrets, push code, and build an authentic two-member commit history. No GitHub repository or fabricated member commits are supplied.

## Troubleshooting
- Connection refused: check Docker health and matching database URLs.
- Schema permissions: run migration using a role allowed to install vector/create schema objects.
- Login origin error: use `APP_ORIGIN` exactly; do not mix localhost and 127.0.0.1.
- No semantic results: start model and worker; inspect job status; run reconcile and retry failures.
- Model unavailable: initial internet/model download is required; keyword retrieval still works.
- Mixed embedding model IDs: use the same configured model in app, worker, and service; reindex all sources after model changes.
- Seed refuses: use a fresh demo database rather than deleting existing incident evidence.

## Optional report regeneration
The editable report source is docs/PROJECT-REPORT.md. To regenerate the supplied evidence-based PDF using Python, install reportlab and Pillow, then run `python scripts/build-report.py`. This is optional and not required for the web app. The builder reads the recorded evidence files; it does not run tests by itself.
