# Team contributions — complete with real evidence
Do not present this suggested allocation as work already performed by named students.

| Member | Real name / ID | Planned database work | Planned application work | Actual commits and evidence |
|---|---|---|---|---|
| 1 | TO BE FILLED | SQL schema, constraints, views, triggers, transactions | Authentication, incident forms/list, admin | TO BE FILLED |
| 2 | TO BE FILLED | Mongo validators/aggregation, vector model/indexing | Reports/logs, remediation, semantic search | TO BE FILLED |
| Both | TO BE FILLED | Integration, testing, schema review | Responsive UI, documentation, demonstration | TO BE FILLED |

Record dates, commit hashes, files changed, tests written, review comments, and what each member can explain. Each person must contribute to both database and application development. Do not fabricate historical commits or authorship. Acknowledge AI assistance according to your instructor's rules. Check section-level title uniqueness and obtain required team approval.

## GitHub handoff
Create an empty repository in your account, then:
```sh
git init
git add .
git status --short   # inspect: no .env, passwords, node_modules or .local data
git commit -m "Import reviewed CyberTrace implementation"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```
If the archive includes a source Git bundle, follow START-HERE instructions or simply initialize the extracted clean source. Future team work should use genuine individual commits and reviews. Never force invented contributions into the initial history.
