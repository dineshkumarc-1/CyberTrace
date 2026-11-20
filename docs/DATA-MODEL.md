# Data model and retrieval strategy
## Logical ER relationships
User 1:N created incidents (incident creator mandatory); user 1:N assignments (incident assignee optional). Incident M:N assets/vulnerabilities/attack techniques through composite-PK junctions. Incident 1:N remediations/status history/reports/logs/embedding sources. Reports and logs are document entities, not duplicate SQL tables.

## Relational normalization
Core records are separated by entity; M:N links are decomposed into junction tables. Names of assets/techniques are not repeated as authoritative values in incidents. Creator and assignee refer to one user relation. Status labels and severity use CHECK constraints. Reports do not maintain an independent copy of actionable remediation-task status. The SQL view derives counts instead of storing mutable totals. Vector chunks are explicitly derived, denormalized retrieval data, not the source of truth.

## Mongo investigation_reports
Required fields: `_id` ObjectId; `incident_id` UUID string; `summary` string 5–2000; `detailed_report` string 10–30000; `remediation_summary` string <=5000; `author_id` UUID string; `version` positive integer; BSON `created_at`, `updated_at`; `analyst_notes` array with author, text, BSON date. Reports have multiple notes; practical UI/app limits bound note additions, but no production archival/maximum-document policy is implemented.
Indexes: `{incident_id:1,updated_at:-1}`. Report ID is exposed as its ObjectId hexadecimal string. Updates use optimistic version matching and increment `version` atomically.

## Mongo incident_logs
Required incident reference, event type (2–100), BSON event time, message (1–4000), raw_data object. Optional source_ip. API validates IPv4/IPv6. Payloads differ by service, so raw_data remains flexible. Each event is a separate document, avoiding an unbounded incident-level log array.
Indexes: `{incident_id:1,event_time:-1}` and `{incident_id:1,event_type:1}`. UI/API use 15-row pagination. Aggregation matches one authorized incident, groups by event type, sums events, sorts descending.
Mongo incident references are application-managed. SQL cannot enforce these foreign keys. Application verifies existence/access before writes; incident archival avoids destructive orphaning. Reconciliation ignores orphan reports rather than inventing an SQL parent.

## Vector data
Model: `Xenova/all-MiniLM-L6-v2`, quantized q8 ONNX via Hugging Face Transformers.js; 384-dimensional mean-pooled, L2-normalized sentence embeddings. This is a general-language baseline, not a cybersecurity-trained model.
Input: incident title+description, report summary+findings+remediation summary, SQL remediation action+description+status. Analyst-note-only text is not embedded; report findings should include relevant conclusions. Raw logs and secrets are excluded.
Chunking: 500-character windows, 80-character overlap. Conservative baseline for English narratives; tokenizer truncation remains possible for dense text/code. Production work should use model-aware token chunking. Each chunk stores source identifiers, version, model and original snippet.
Storage: `incident_embeddings.embedding vector(384)` in PostgreSQL. Unique source_type/source_id/chunk_index avoids duplicate slots. A current-version source registry and queue make indexing observable.
Metric: cosine distance via `<=>`; reported similarity is `1-distance`, not probability. Exact distance ranking for the demo; optional HNSW script is provided but not enabled/tested by default.
Retrieval: same-model query embedding; authorization, status/severity and non-archived filters; current SQL source version; live report version check; choose best available chunk per incident; return top five incident IDs/snippets. All authorized chunks are ranked for correctness on this small dataset. Large-scale retrieval needs measured candidate limits/index tuning.

## Cross-store consistency
SQL create/update + SQL queue is atomic in a local transaction. Mongo report save and SQL enqueue are not atomic: a successful report can need reconciliation. `npm run reconcile` registers current source versions and missing jobs. Worker claims pending jobs with row locks, computes vectors outside the transaction, rechecks source version, then replaces chunks transactionally. A 10-minute processing lease allows recovery from a crashed worker. The UI requeues current Failed jobs; superseded versions remain historical. A very slow worker exceeding the lease can duplicate computation; writes remain replacement-based, but this is not an exactly-once queue.
Changing model requires deleting/rebuilding existing derived vectors and requeueing current jobs; version keys alone do not distinguish model changes. Keep model settings identical in app, worker, and service.
