# Evaluation demonstration (12–15 minutes)
## Before evaluation
Run your own tests. Start SQL/Mongo, embedding server, worker, and app. Ensure pending jobs finish. Keep SQL client, mongosh and README available. Use only demo passwords. Do not expose .env on screen.

1. **Problem/motivation (1 min):** Analysts lose historical context when fixed incident metadata and flexible evidence are scattered. Explain semantic retrieval vs keyword matching. State this is not live detection.
2. **Design (2 min):** Open conceptual ER and physical SQL schema. Explain 1:N creator/assignee and three M:N junctions, composite keys, optional assignee, and Mongo application references. Justify SQL/Mongo/vector based on data characteristics.
3. **Application (3 min):** Login as Admin. Show dashboard and incident filters. Create incident, assign Maya, select an asset and technique. Save. Explain the transaction also writes the indexing job. Move Open → Investigating. Show trigger-created history. Add report, log and remediation; mark remediation complete.
4. **Database depth (3 min):** Run sql/002_demo_queries.sql; show DDL, DML, view, joins, grouping/HAVING, subquery, EXPLAIN and safe rollback. Run mongo/aggregations.js for the chosen incident. Explain indexes and that a tiny dataset may use sequential scan. Show duplicate/FK/check rejection and automated rollback test.
5. **Knowledge retrieval (2 min):** Wait for worker. Search 'Employee gave a password to a counterfeit login website'. Show source text and linked historical incident. Explain 384 dimensions, same-model embeddings, cosine score, current-version checks and authorized ranking. A similarity score is not an attack probability.
6. **Roles/security (1 min):** Login as Analyst. Show no Admin screen; server endpoint returns 403. Explain creator/assignee access, secure session, hashed passwords, parameterization and secret configuration without displaying actual secrets.
7. **Testing/contributions (1–2 min):** Show actual TEST-RESULTS, retrieval JSON, screenshots and genuine team commits. State sandbox-vs-Docker verification limits honestly. Show documentation and future improvements.

## Failure fallback
If model download/inference fails, show the unavailable message and functioning keyword search. Show existing actual retrieval logs without implying the current live query succeeded. If databases are unavailable, repair/start them; do not substitute static screenshots while claiming the app is live.
