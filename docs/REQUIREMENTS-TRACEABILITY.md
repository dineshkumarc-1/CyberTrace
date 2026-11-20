# PDF requirements traceability

| PDF item | Requirement | Evidence | Status / limitation |
|---|---|---|---|
| 1 | Unique meaningful title | README; report; confirm section uniqueness | Instructor/team action required |
| 2 | Two-person contributions | TEAM-CONTRIBUTIONS.md; actual Git commits | Names and genuine history required |
| 3 | SQL + another paradigm | PostgreSQL + MongoDB + pgvector | Implemented |
| 4 | ER/schema/data models | diagrams/; DATA-DICTIONARY; DATA-MODEL | Included |
| 5 | DDL/keys/constraints/index/view | sql/001_schema.sql; 002_demo_queries.sql | Implemented |
| 6 | DML/joins/grouping/HAVING/subquery | lib/api.ts; sql/002_demo_queries.sql | Implemented |
| 7 | At least four advanced concepts | Transactions, view, trigger, indexes, Mongo aggregation, vectors | Implemented; see test evidence |
| 8 | Embeddings/retrieval explanation | DATA-MODEL.md; embeddings/server.mjs | Included; evaluation recorded separately |
| 9 | Next.js functional UI | app/page.tsx; screenshots/ | Implemented |
| 10 | Backend and environment integration | app/api; lib/db; .env.example | Implemented |
| 11 | Authentication and two roles | lib/auth.ts; admin and analyst policies | Implemented |
| 12 | DB validation/integrity | SQL constraints; mongo/setup.ts; tests | Implemented |
| 13 | Basic security | SECURITY.md; auth/parameterization | Implemented with documented limits |
| 14 | Complete project documentation | PROJECT-REPORT; dictionary; models; results | Included |
| 15 | GitHub and individual commits | README; TEAM-CONTRIBUTIONS | User/team must create/push repo and real commits |
| 16 | Evaluation/demo/test/contributions | DEMO-SCRIPT; VIVA; tests; screenshots | Demo kit included; team defense required |
| 17 | Originality/no direct copying | AI-assistance disclosure; team adaptation | Instructor approval and student work required |
| 18 | Beyond CRUD and justified choices | Semantic retrieval, audit, analytics, transactional linking | Implemented |
