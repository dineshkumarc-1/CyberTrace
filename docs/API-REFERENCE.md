# API reference
All paths are under `/api`. JSON responses; server-side session required except login. Mutations require JSON, exact configured Origin and `X-CyberTrace: 1`. The browser supplies Origin automatically. Authentication failures 401; forbidden operations 403; unknown/unauthorized incident 404; version/unique/FK conflict 409; validation 400; model/database unavailability 503.

| Method | Route | Purpose |
|---|---|---|
| POST | auth/login | email/password; sets signed cookie |
| GET | auth/me | current active user |
| POST | auth/logout | clears cookie |
| GET | lookups | reference records and active user display identities |
| GET | dashboard | authorized grouped incident totals and recent incidents |
| GET | incidents | q, severity, status, archived, page; 15 rows/page |
| POST | incidents | title, description, severity, ISO detected_at, relation ID arrays; optional Admin assignee |
| GET | incidents/:id | incident, links, up to 50 reports, remediation, recent history/jobs |
| PATCH | incidents/:id | version required; title/description/severity/status; Admin assignment/archive |
| POST/DELETE | incidents/:id/links | kind=assets/vulnerabilities/techniques and id |
| POST | incidents/:id/reports | summary, detailed_report, remediation_summary, optional note |
| PATCH | incidents/:id/reports/:reportId | report fields and current version |
| GET | incidents/:id/logs | page; logs and event-type aggregation |
| POST | incidents/:id/logs | event_type, ISO event_time, message, optional IP, raw_data object |
| POST | incidents/:id/remediations | action and description |
| PATCH | incidents/:id/remediations/:rid | status; completion date managed server-side |
| POST | incidents/:id/retry | queue current failed indexing jobs |
| POST | search | q plus optional severity/status; top five authorized incidents |
| GET/POST | admin/users | list/create accounts |
| PATCH | admin/users/:uid | role/active; session revocation; cannot alter own state |
| POST | admin/references/:kind | create asset/vulnerability/technique |
| PATCH | admin/references/:kind/:id | replace editable reference fields |
| DELETE | admin/references/:kind/:id | delete unused reference; SQL FK protects in-use records |

Reference identifiers are selected from a whitelist. Arbitrary table names, Mongo filters and SQL fragments are never accepted. Bodies are strictly validated. Report/log paths are write-authorized at the parent incident before operation.
For the academic dataset, report/history display caps are documented; production requires full pagination and external evidence/attachment storage.
