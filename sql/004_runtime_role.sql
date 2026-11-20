-- Optional deployment step, executed with psql as the database owner.
-- Supply a unique password interactively with \password after creating the role.
-- Do not put real passwords in this script or source control.
CREATE ROLE cybertrace_runtime LOGIN;
GRANT CONNECT ON DATABASE cybertrace TO cybertrace_runtime;
GRANT USAGE ON SCHEMA public TO cybertrace_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON app_users,incidents,assets,vulnerabilities,attack_techniques,
 incident_assets,incident_vulnerabilities,incident_techniques,remediations,incident_status_history,
 embedding_sources,embedding_jobs,incident_embeddings TO cybertrace_runtime;
GRANT SELECT ON incident_overview TO cybertrace_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO cybertrace_runtime;
\password cybertrace_runtime
-- Switch application DATABASE_URL to this role, not the migration owner.
-- Re-run grants for new tables on future migrations. No CREATE/ALTER/DROP grants.
