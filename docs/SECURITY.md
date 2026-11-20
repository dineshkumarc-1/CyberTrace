# Security model and limitations
## Controls implemented
- bcrypt password hashes, cost 12; no default plaintext seed passwords in source.
- Signed HS256 sessions, issuer/audience/expiry validation; HttpOnly/SameSite=Strict cookie, Secure for HTTPS APP_ORIGIN.
- Server-side database-backed active-state/role checks on every authenticated request. Token version revokes earlier sessions after account changes.
- Origin and custom-header checks for every mutation, including login; JSON-only requests, bounded request bodies.
- Parameterized SQL. Only whitelisted identifiers enter generated SQL. Mongo filters constructed server-side.
- Zod validation and strict database constraints/collection validators.
- Creator/assignee-based incident visibility; only assignees/Admin can modify evidence. Creation self-assigns analysts; only Admin reassigns/archives.
- Same authorization scope in dashboard, list, detail, logs, reports, and vector ranking. Unauthorized incident IDs return 404.
- Mongo live-version check during search prevents a stale report chunk leaking through a reconciliation window.
- React text rendering escapes supplied text; no raw HTML injection API is used.
- Frame restrictions and response security headers. Next.js CSP retains unsafe-inline/eval for compatibility; production should adopt nonces and a tighter policy.
- Local-only database ports in Compose; generated test secrets and model cache excluded from Git.

## Known limits / deployment work
This is a single-organization academic application. No SSO, MFA enrollment, password-reset email, immutable external audit store, encryption-key service, malware scanning, disaster-recovery automation, or distributed rate limiter. Login throttling is process-local and email-keyed, so a multi-instance deployment needs a shared limiter and edge/IP abuse protection. SameSite and origin checks require a correctly configured exact APP_ORIGIN.
Logout removes the current cookie but does not revoke a stolen JWT; expiry or a user token-version update does. A stolen session remains a concern; never use synthetic demo credentials for real accounts.
The embedding server has no independent authentication and binds only to loopback. Do not expose it publicly. Initial model loading downloads third-party artifacts; pin/review model revisions for a controlled deployment.
Compose uses privileged bootstrap database accounts for reproducible installation. Create separate least-privilege runtime PostgreSQL and Mongo users before shared deployment; use TLS, secret management, backup/restore tests, and security review. Pin container digests for reproducible production images.
Cross-store operations are eventually consistent, not globally atomic. Report writes may succeed while enqueueing fails: API reports reconciliation required; run reconciliation and retry. SQL foreign keys do not validate Mongo references. Direct database administrators can bypass application permissions.
Semantic similarity is not threat detection or a guarantee that remediation is correct. Analysts must review source evidence and approve actions.
