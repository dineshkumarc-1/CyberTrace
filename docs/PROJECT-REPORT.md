# CyberTrace — Project Report

Cybersecurity Incident Management and Semantic Knowledge Retrieval

**Team / student IDs / section / instructor: to be completed with real details.**

## Project overview

CyberTrace is a web-based Cybersecurity Incident Management and Semantic Knowledge Retrieval System. It brings structured incident tracking and flexible investigation evidence into one application and allows analysts to find historically related incidents without knowing the exact terminology used in earlier reports.

Organizations accumulate incident records, affected-asset inventories, vulnerabilities, attack techniques, logs, analyst notes and remediation findings. These records differ in structure and are often searched in isolation. An analyst may miss a useful earlier investigation when it uses a different description of the same underlying problem.

The application uses PostgreSQL for related structured records, MongoDB for investigation documents and heterogeneous logs, and pgvector for derived semantic representations. Next.js supplies the interface and server/API layer. Local ONNX sentence embeddings avoid sending investigation text to an external inference API.

Academic context: DBMS Experiential Learning, Level 3. This package is an AI-assisted implementation. It is not a claim of completed human team work, instructor approval, unique section title, or a published GitHub repository. Students must review, adapt and explain the implementation under their course's originality rules.

## Objectives, scope and requirements

Objectives: (1) enforce integrity for incident relationships; (2) support an observable investigation workflow; (3) preserve flexible evidence; (4) reuse historical remediation knowledge; (5) demonstrate advanced database operations through a working web application.

Functional scope: sign-in and server-side role checks; dashboard; incident creation, assignment, update and archive; structured keyword filtering and pagination; asset/vulnerability/technique links; investigation reports with optimistic editing and notes; paginated sample logs with event aggregation; remediation completion tracking; status history; semantic search with original snippets; account and reference-data management.

Admin can manage users/reference data and all incidents. Analyst can read created or assigned incidents and modify assigned active incidents. Analyst-created incidents are self-assigned; only Admin can reassign or archive. Both roles share retrieval screens, but results are restricted by the same access policy as incident detail.

Out of scope: automated intrusion detection, live SIEM connectors, vulnerability scanning, malware execution, automatic remediation, SSO/MFA integration and production hosting. Data is synthetic. Nonfunctional goals are clear validation, reproducible setup, parameterized access, understandable failures and responsive desktop/mobile presentation. No unmeasured performance SLA is claimed.

## System architecture

The browser calls Next.js Route Handlers; it never connects directly to a database. The server validates session, role, parent-incident access and request body before persistence. PostgreSQL and MongoDB are accessed only on the server.

A background worker reads pending SQL jobs, loads authoritative source content, chunks text, calls the loopback embedding service and stores vector snippets with model and source version. Search embeds the query using the same model, ranks authorized current chunks and returns source-linked incident results.

The application is a single-organization academic deployment. The embedding service binds to loopback. PostgreSQL, MongoDB, the application and the model have independent failure modes; reporting a failure does not imply that all source writes were rolled back across stores.

## ER model and relational mapping

A user creates zero or more incidents; each incident has exactly one creator. A user can be assigned many incidents; an incident has zero or one assignee. An incident may affect many assets, involve many vulnerabilities and use many attack techniques. Each M:N relationship is mapped to an associative table with a composite primary key.

An incident has many remediation tasks and status-history entries in SQL. Investigation reports and logs are MongoDB document entities with application-managed incident references. Dashed diagram links represent these cross-store references, not enforceable PostgreSQL foreign keys.

The full-size physical schema is supplied separately as diagrams/relational-schema.svg, with editable Graphviz source. The SQL migration and generated data dictionary are authoritative for all columns, composite keys, constraints and defaults.

## Relational schema and integrity

Core relations: app_users; incidents; assets; vulnerabilities; attack_techniques; incident_assets; incident_vulnerabilities; incident_techniques; remediations; incident_status_history. Retrieval support: embedding_sources; embedding_jobs; incident_embeddings. schema_migrations tracks installation state.

Primary keys use UUIDs for domain records and generated bigint IDs for jobs/history. app_users.email is unique and lowercase. CVE and MITRE identifiers are unique when supplied; CVE IDs may be absent. Three junction tables use incident ID plus related-entity ID as their primary key, preventing duplicate links. Foreign keys protect relational references; reference-entity deletion is restricted when links exist.

CHECK constraints enforce role, severity, status, positive source versions, identifier patterns, minimum text requirements and completion-date consistency. Required values use NOT NULL. A trigger updates incident timestamp/version, validates workflow transitions and records old/new status plus the authenticated actor. Incident creation and related links/job creation use one SQL transaction.

The design separates independent entities and resolves M:N relationships instead of repeating names in incident records. Counts are derived in incident_overview rather than persisted as mutable totals. Embedding chunks are intentionally denormalized derived data, not the authoritative incident/report source. See DATA-DICTIONARY.md for every implemented attribute and constraint.

## Document and vector data models

MongoDB investigation_reports stores ObjectId, incident UUID string, summary, detailed findings, remediation narrative, author UUID, analyst notes, positive version, and BSON timestamps. incident_logs stores incident UUID, event type/time, optional IP, message and a flexible raw_data object. Logs are separate documents, avoiding an unbounded array in a parent incident. Collection validators reject invalid required fields/types. Compound indexes support incident/time retrieval and event grouping.

Actionable remediation status remains in SQL; a report's remediation summary is narrative context, not a second authoritative task list. API checks verify incident existence and access before Mongo writes. There is no database-enforced FK between SQL and MongoDB.

Vectors: Xenova/all-MiniLM-L6-v2, q8 ONNX via Transformers.js; 384 dimensions, mean pooling and normalization. Incident descriptions, report findings/remediation summaries and remediation tasks are embedded. Passwords, tokens and raw log dumps are excluded. Text uses 500-character windows with 80-character overlap; dense input can still exceed the model token limit, a documented baseline limitation.

incident_embeddings stores source type/ID/version, chunk index, text, vector, model and timestamp. Cosine distance uses pgvector <=>; similarity is 1 minus distance. Exact ranking is used for the small dataset; an optional HNSW script is included, not enabled by default. The query and indexed content must use the same model. Similarity is not an attack probability.

## Implementation and advanced database features

Six advanced concepts are implemented: transactions, views, triggers, indexing, MongoDB aggregation and vector similarity search. Each supports a concrete application feature rather than being added only for demonstration.

Transactions: create incident + entity links + index job together; invalid links cause rollback. View: incident_overview joins creator/assignee and derives asset counts. Trigger: legal status transitions create actor-attributed history and increment incident version. Indexes: filter/assignment/creator and relation lookup indexes; compound Mongo incident/time and incident/event indexes. Aggregation: logs grouped by event type for one authorized incident. Vector search: exact authorized current-chunk ranking with incident deduplication.

SQL/002_demo_queries.sql demonstrates CREATE, ALTER, INSERT, UPDATE, SELECT, DELETE, DROP; JOIN, GROUP BY, HAVING, ORDER BY, aggregate functions, a subquery, the view, EXPLAIN ANALYZE and trigger history. Disposable DDL and application-domain association deletion are wrapped in rollback. mongo/aggregations.js supplies inspection and aggregation examples. A small dataset may legitimately use a sequential scan; no unsupported indexing speedup is claimed.

Application operations are available through JSON Route Handlers. Zod rejects unknown fields and invalid types. Identifiers for dynamic reference operations are server-whitelisted; data values are parameterized. API-REFERENCE.md documents each endpoint, permission boundary and expected error code.

## Security and cross-store consistency

Passwords are bcrypt hashes; seed passwords and database/session secrets are supplied through ignored environment configuration. Signed sessions validate algorithm, issuer, audience and expiry. Cookies are HttpOnly, SameSite Strict and Secure when APP_ORIGIN is HTTPS. Active user/role/token version is checked on each authenticated request. Role changes revoke earlier sessions.

Mutations require the exact configured Origin, JSON content type and custom application header. The interface renders text through React, not arbitrary HTML. The login limiter is process-local; it is not sufficient for a distributed deployment. Database bootstrap accounts in Compose must be replaced by least-privilege runtime users before shared deployment. Additional production work includes TLS, secret management, tighter nonce-based CSP, shared throttling, backups and security review.

A PostgreSQL transaction cannot make a MongoDB write atomic. Mongo reports can be saved while SQL job enqueueing fails; the response identifies reconciliation as necessary. Reconciliation registers current sources and missing jobs. Index jobs show Pending, Processing, Ready or Failed. The worker computes outside the SQL transaction, rechecks source version and replaces chunks atomically. Crash leases permit retries but do not claim exactly-once execution.

Search checks source versions in SQL and report versions live in Mongo, filtering stale content even during a reconciliation gap. Archived incidents and unauthorized records are excluded before ranking. Model unavailability returns an explicit error; keyword retrieval remains available. See SECURITY.md and DATA-MODEL.md for limitations.

## Testing and evaluation

The delivered source was tested using the local environment recorded in TEST-RESULTS.md. Unit/database checks: 22 passed in the latest recorded run. Browser checks: 6 expected passes and 0 unexpected failures in the latest JSON artifact at report-generation time. Refer to raw logs for exact final counts.

The SQL tests exercise the PostgreSQL engine with pgvector through PGlite's loopback test transport; MongoDB is an actual local MongoDB 8.0.17 binary. The recommended Docker PostgreSQL 16 + MongoDB deployment was not run here because Docker is unavailable. This is not a claim that networked PostgreSQL deployment or production security was verified.

Integrity cases include invalid severity/FK, duplicate email/link, partial transaction rollback, actor-attributed history, illegal transition, missing actor, invalid remediation completion date, Mongo validation, Mongo aggregation totals, vector cosine arithmetic and non-duplicating view rows. Domain cases cover access policy, strict schemas, invalid IP, weak password, optimistic version requirement, chunk coverage and origin checks. Browser scenarios cover incident/evidence/remediation workflow, role denial, request integrity, desktop/mobile screens and semantic results.

Retrieval evaluation used 50 synthetic incidents across ten labelled families and ten paraphrased queries, with five returned incidents/query. Recorded Hit@5: 1; mean Precision@5: 1. Hit@5 measures whether any labelled relevant incident appears; Precision@5 measures relevant returned incidents divided by five. This small, repetitive synthetic dataset is a functional smoke test, not evidence of real-world cybersecurity retrieval accuracy. No large-scale latency or adversarial-security benchmark is claimed.

## Application screenshots

The dashboard screenshot below is captured from the running application with synthetic data. Counts reflect its capture time, not a persistent production installation. The interface exposes authorized incident totals, status workload, recent incidents and navigation to historical knowledge.

The archive includes full-resolution screenshots of the incident workspace, investigation reports, logs, audit/indexing state, incident list, administration, mobile overview and semantic search. Screenshots are evidence of actual browser runs; they are not substitutes for a live demonstration.

## Semantic retrieval screenshot

The knowledge-search screen shows a paraphrased query and linked incident results, each with severity, workflow status, source type, source text and cosine similarity. Analysts should open and assess the original evidence before applying remediation.

The displayed score is numeric similarity, never a confidence percentage. Current-source and authorization checks are mandatory regardless of the visual interface. The baseline model is general-purpose; evaluation on more diverse, independently labelled cases is required before practical organizational use.

## Delivery, contribution and conclusion

Setup: install Node dependencies with npm ci; configure .env; start Docker databases; run db:setup and db:seed; start embeddings, worker and the Next.js app. README supplies exact commands, environment variables, account names, troubleshooting and test execution instructions. No real secrets, model cache, database files or node_modules are included in the source archive.

Demo sequence: explain the problem/design; show roles; create and link an incident; update status and inspect trigger history; add report/log/remediation; demonstrate SQL and Mongo operations; run semantic search; show test evidence and real team contributions. DEMO-SCRIPT.md and VIVA.md provide a timed guide and technical questions.

Team members, IDs, instructor, section and GitHub URL must be filled with real information. TEAM-CONTRIBUTIONS.md contains a proposed split with both database and application work for each member; it is not fabricated evidence that students already performed it. Establish genuine individual commits and obtain instructor approval for AI assistance and originality.

Conclusion: the implemented system connects relational integrity, flexible evidence and semantic reuse through one web workflow. It goes beyond CRUD through transactional linking, automatic audit history, aggregation and semantic retrieval. Future work includes token-aware chunking, domain-specific model evaluation, hybrid ranking, full evidence pagination, durable distributed jobs, SSO/MFA, backup/retention policies, stronger runtime roles and scale/security testing. REQUIREMENTS-TRACEABILITY.md maps every PDF item to evidence and remaining human actions.

## Supporting appendices

- DATA-DICTIONARY.md: all SQL attributes/types/nullability/defaults/constraints.
- DATA-MODEL.md: document/vector fields, indexes and retrieval.
- API-REFERENCE.md: application endpoints.
- TEST-RESULTS.md and JSON/log evidence.
- REQUIREMENTS-TRACEABILITY.md: complete guideline map.
- diagrams/: conceptual ER, physical schema and architecture.
