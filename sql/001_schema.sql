CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE app_users (
 user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 email text NOT NULL UNIQUE CHECK(email=lower(email) AND position('@' IN email)>1),
 password_hash text NOT NULL CHECK(password_hash LIKE '$2%'),
 role text NOT NULL CHECK(role IN ('Admin','Analyst')), active boolean NOT NULL DEFAULT true,
 token_version integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE incidents (
 incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 200),
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 10 AND 20000),
 severity text NOT NULL CHECK(severity IN ('Low','Medium','High','Critical')),
 status text NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Investigating','Contained','Resolved','Closed')),
 detected_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
 assigned_to uuid REFERENCES app_users(user_id) ON DELETE RESTRICT, archived boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1
);
CREATE TABLE assets (
 asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_name text NOT NULL UNIQUE,
 asset_type text NOT NULL, criticality text NOT NULL CHECK(criticality IN ('Low','Medium','High','Critical')),
 owner_name text NOT NULL, location text NOT NULL
);
CREATE TABLE vulnerabilities (
 vulnerability_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cve_id text UNIQUE CHECK(cve_id IS NULL OR cve_id ~ '^CVE-[0-9]{4}-[0-9]{4,}$'),
 name text NOT NULL, severity text NOT NULL CHECK(severity IN ('Low','Medium','High','Critical')),
 description text NOT NULL, published_date date
);
CREATE TABLE attack_techniques (
 technique_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), technique_name text NOT NULL,
 mitre_id text UNIQUE CHECK(mitre_id IS NULL OR mitre_id ~ '^T[0-9]{4}(\.[0-9]{3})?$'), description text NOT NULL
);
CREATE TABLE incident_assets (
 incident_id uuid REFERENCES incidents ON DELETE CASCADE, asset_id uuid REFERENCES assets ON DELETE RESTRICT,
 impact text NOT NULL DEFAULT '', relationship_details text NOT NULL DEFAULT '', PRIMARY KEY(incident_id,asset_id)
);
CREATE TABLE incident_vulnerabilities (
 incident_id uuid REFERENCES incidents ON DELETE CASCADE, vulnerability_id uuid REFERENCES vulnerabilities ON DELETE RESTRICT,
 discovered_at timestamptz NOT NULL DEFAULT now(), details text NOT NULL DEFAULT '', PRIMARY KEY(incident_id,vulnerability_id)
);
CREATE TABLE incident_techniques (
 incident_id uuid REFERENCES incidents ON DELETE CASCADE, technique_id uuid REFERENCES attack_techniques ON DELETE RESTRICT,
 observed_at timestamptz NOT NULL DEFAULT now(), details text NOT NULL DEFAULT '', PRIMARY KEY(incident_id,technique_id)
);
CREATE TABLE remediations (
 remediation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES incidents ON DELETE CASCADE,
 action text NOT NULL CHECK(length(trim(action)) BETWEEN 3 AND 200), description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','In Progress','Completed')),
 completed_at timestamptz, version integer NOT NULL DEFAULT 1,
 CHECK ((status='Completed' AND completed_at IS NOT NULL) OR (status<>'Completed' AND completed_at IS NULL))
);
CREATE TABLE incident_status_history (
 history_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, incident_id uuid NOT NULL REFERENCES incidents ON DELETE CASCADE,
 old_status text, new_status text NOT NULL, changed_by uuid NOT NULL REFERENCES app_users ON DELETE RESTRICT,
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE embedding_sources (
 source_type text CHECK(source_type IN ('incident','report','remediation')), source_id text,
 incident_id uuid NOT NULL REFERENCES incidents ON DELETE CASCADE, version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(source_type,source_id)
);
CREATE TABLE embedding_jobs (
 job_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, source_type text NOT NULL, source_id text NOT NULL,
 incident_id uuid NOT NULL REFERENCES incidents ON DELETE CASCADE, source_version integer NOT NULL,
 status text NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Processing','Ready','Failed')),
 attempts integer NOT NULL DEFAULT 0, error text, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_type,source_id,source_version), FOREIGN KEY(source_type,source_id) REFERENCES embedding_sources ON DELETE CASCADE
);
CREATE TABLE incident_embeddings (
 embedding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES incidents ON DELETE CASCADE,
 source_type text NOT NULL, source_id text NOT NULL, source_version integer NOT NULL, chunk_index integer NOT NULL,
 content_text text NOT NULL, embedding vector(384) NOT NULL, model_name text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_type,source_id,chunk_index), FOREIGN KEY(source_type,source_id) REFERENCES embedding_sources ON DELETE CASCADE
);
CREATE INDEX incident_filter_idx ON incidents(status,severity,detected_at DESC);
CREATE INDEX incident_assignee_idx ON incidents(assigned_to);
CREATE INDEX incident_creator_idx ON incidents(created_by);
CREATE INDEX incident_assets_asset_idx ON incident_assets(asset_id);
CREATE INDEX incident_vulns_vuln_idx ON incident_vulnerabilities(vulnerability_id);
CREATE INDEX incident_techniques_technique_idx ON incident_techniques(technique_id);
CREATE INDEX remediation_incident_idx ON remediations(incident_id);
CREATE INDEX status_history_incident_idx ON incident_status_history(incident_id,changed_at);
CREATE INDEX embedding_incident_idx ON incident_embeddings(incident_id);
CREATE INDEX embedding_jobs_queue_idx ON embedding_jobs(status,updated_at);
CREATE VIEW incident_overview AS
 SELECT i.*, u.name AS assignee_name, c.name AS creator_name,
 (SELECT count(*)::integer FROM incident_assets a WHERE a.incident_id=i.incident_id) AS asset_count
 FROM incidents i LEFT JOIN app_users u ON u.user_id=i.assigned_to JOIN app_users c ON c.user_id=i.created_by;
CREATE FUNCTION track_incident_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
 NEW.updated_at := now(); NEW.version := OLD.version + 1;
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NOT ((OLD.status='Open' AND NEW.status='Investigating') OR
          (OLD.status='Investigating' AND NEW.status='Contained') OR
          (OLD.status='Contained' AND NEW.status='Resolved') OR
          (OLD.status='Resolved' AND NEW.status IN ('Closed','Investigating')) OR
          (OLD.status='Closed' AND NEW.status='Investigating')) THEN
    RAISE EXCEPTION 'Invalid incident status transition';
  END IF;
  actor := nullif(current_setting('app.actor_id',true),'')::uuid;
  IF actor IS NULL THEN RAISE EXCEPTION 'Status changes require app.actor_id'; END IF;
  INSERT INTO incident_status_history(incident_id,old_status,new_status,changed_by) VALUES(OLD.incident_id,OLD.status,NEW.status,actor);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER incident_change BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION track_incident_change();
