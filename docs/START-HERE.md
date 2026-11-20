# Delivery guide
1. Read README setup instructions and TEST-RESULTS before claiming any verification.
2. Start databases, run setup/seed, then start embedding service, worker, and Next.js.
3. Review `Project-Report.pdf` and editable report source.
4. Open `docs/diagrams/` for conceptual ER, physical schema, and architecture (SVG + editable DOT).
5. Use `docs/DEMO-SCRIPT.md` for evaluation.
6. Fill team details; replace training assumptions where your instructor requires a different workflow.
7. Create a GitHub repository and contribute genuinely as two members.
8. Rerun tests on your own Docker PostgreSQL/Mongo deployment. The supplied sandbox test engine is disclosed separately.

## Deliverables map
- Problem, objectives, scope, requirements: PROJECT-REPORT.md / Project-Report.pdf
- ER diagram: diagrams/conceptual-er.svg
- Relational schema: diagrams/relational-schema.svg and sql/001_schema.sql
- Document/vector model: DATA-MODEL.md
- Data dictionary: DATA-DICTIONARY.md
- Architecture: diagrams/architecture.svg
- DDL, DML, advanced queries: sql/ and mongo/aggregations.js
- Next.js source: app/ and lib/
- Testing: TEST-RESULTS.md, raw JSON outputs, tests/
- Screenshots: screenshots/
- Git/team: TEAM-CONTRIBUTIONS.md, README
- Demo, viva, future enhancements: DEMO-SCRIPT.md, VIVA.md, report
- Requirement coverage: REQUIREMENTS-TRACEABILITY.md

## Source history
The ZIP includes an AI-assisted initial source Git bundle. To inspect it, run `git clone cybertrace-source.bundle cybertrace-history` from the extracted root. This is one clearly labelled generated commit, not individual student contribution history. Use a clean extracted source directory for your own reviewed project work and genuine team commits.

The report's figures are overview-scale illustrations. Open the separate SVG/PNG diagrams for full-size field names and relationship labels. The data dictionary and SQL migration are authoritative for all constraints.
