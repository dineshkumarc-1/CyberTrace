# Data dictionary

Generated from the implemented database schema. Full constraints follow each table; composite primary and foreign keys are authoritative there. Derived vector chunks are not authoritative incident records.

## app_users

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| user_id | uuid | NO | gen_random_uuid() |
| name | text | NO | — |
| email | text | NO | — |
| password_hash | text | NO | — |
| role | text | NO | — |
| active | boolean | NO | true |
| token_version | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |

Constraints:
- `CHECK (((email = lower(email)) AND (POSITION(('@'::text) IN (email)) > 1)))`
- `CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 120)))`
- `CHECK ((password_hash ~~ '$2%'::text))`
- `CHECK ((role = ANY (ARRAY['Admin'::text, 'Analyst'::text])))`
- `NOT NULL active`
- `NOT NULL created_at`
- `NOT NULL email`
- `NOT NULL name`
- `NOT NULL password_hash`
- `NOT NULL role`
- `NOT NULL token_version`
- `NOT NULL user_id`
- `PRIMARY KEY (user_id)`
- `UNIQUE (email)`

## assets

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| asset_id | uuid | NO | gen_random_uuid() |
| asset_name | text | NO | — |
| asset_type | text | NO | — |
| criticality | text | NO | — |
| owner_name | text | NO | — |
| location | text | NO | — |

Constraints:
- `CHECK ((criticality = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text])))`
- `NOT NULL asset_id`
- `NOT NULL asset_name`
- `NOT NULL asset_type`
- `NOT NULL criticality`
- `NOT NULL location`
- `NOT NULL owner_name`
- `PRIMARY KEY (asset_id)`
- `UNIQUE (asset_name)`

## attack_techniques

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| technique_id | uuid | NO | gen_random_uuid() |
| technique_name | text | NO | — |
| mitre_id | text | YES | — |
| description | text | NO | — |

Constraints:
- `CHECK (((mitre_id IS NULL) OR (mitre_id ~ '^T[0-9]{4}(\.[0-9]{3})?$'::text)))`
- `NOT NULL description`
- `NOT NULL technique_id`
- `NOT NULL technique_name`
- `PRIMARY KEY (technique_id)`
- `UNIQUE (mitre_id)`

## embedding_jobs

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| job_id | bigint | NO | — |
| source_type | text | NO | — |
| source_id | text | NO | — |
| incident_id | uuid | NO | — |
| source_version | integer | NO | — |
| status | text | NO | 'Pending'::text |
| attempts | integer | NO | 0 |
| error | text | YES | — |
| updated_at | timestamp with time zone | NO | now() |

Constraints:
- `CHECK ((status = ANY (ARRAY['Pending'::text, 'Processing'::text, 'Ready'::text, 'Failed'::text])))`
- `FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE`
- `FOREIGN KEY (source_type, source_id) REFERENCES embedding_sources(source_type, source_id) ON DELETE CASCADE`
- `NOT NULL attempts`
- `NOT NULL incident_id`
- `NOT NULL job_id`
- `NOT NULL source_id`
- `NOT NULL source_type`
- `NOT NULL source_version`
- `NOT NULL status`
- `NOT NULL updated_at`
- `PRIMARY KEY (job_id)`
- `UNIQUE (source_type, source_id, source_version)`

## embedding_sources

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| source_type | text | NO | — |
| source_id | text | NO | — |
| incident_id | uuid | NO | — |
| version | integer | NO | — |

Constraints:
- `CHECK ((source_type = ANY (ARRAY['incident'::text, 'report'::text, 'remediation'::text])))`
- `CHECK ((version > 0))`
- `FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE`
- `NOT NULL incident_id`
- `NOT NULL source_id`
- `NOT NULL source_type`
- `NOT NULL version`
- `PRIMARY KEY (source_type, source_id)`

## incident_assets

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| incident_id | uuid | NO | — |
| asset_id | uuid | NO | — |
| impact | text | NO | ''::text |
| relationship_details | text | NO | ''::text |

Constraints:
- `FOREIGN KEY (asset_id) REFERENCES assets(asset_id) ON DELETE RESTRICT`
- `FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE`
- `NOT NULL asset_id`
- `NOT NULL impact`
- `NOT NULL incident_id`
- `NOT NULL relationship_details`
- `PRIMARY KEY (incident_id, asset_id)`

## incident_embeddings

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| embedding_id | uuid | NO | gen_random_uuid() |
| incident_id | uuid | NO | — |
| source_type | text | NO | — |
| source_id | text | NO | — |
| source_version | integer | NO | — |
| chunk_index | integer | NO | — |
| content_text | text | NO | — |
| embedding | vector | NO | — |
| model_name | text | NO | — |
| updated_at | timestamp with time zone | NO | now() |

Constraints:
- `FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE`
- `FOREIGN KEY (source_type, source_id) REFERENCES embedding_sources(source_type, source_id) ON DELETE CASCADE`
- `NOT NULL chunk_index`
- `NOT NULL content_text`
- `NOT NULL embedding_id`
- `NOT NULL embedding`
- `NOT NULL incident_id`
- `NOT NULL model_name`
- `NOT NULL source_id`
- `NOT NULL source_type`
- `NOT NULL source_version`
- `NOT NULL updated_at`
- `PRIMARY KEY (embedding_id)`
- `UNIQUE (source_type, source_id, chunk_index)`

## incident_status_history

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| history_id | bigint | NO | — |
| incident_id | uuid | NO | — |
| old_status | text | YES | — |
| new_status | text | NO | — |
| changed_by | uuid | NO | — |
| changed_at | timestamp with time zone | NO | now() |

Constraints:
- `FOREIGN KEY (changed_by) REFERENCES app_users(user_id) ON DELETE RESTRICT`
- `FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE`
- `NOT NULL changed_at`
- `NOT NULL changed_by`
- `NOT NULL history_id`
- `NOT NULL incident_id`
- `NOT NULL new_status`
- `PRIMARY KEY (history_id)`

## incident_techniques

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| incident_id | uuid | NO | — |
| technique_id | uuid | NO | — |
| observed_at | timestamp with time zone | NO | now() |
| details | text | NO | ''::text |

Constraints:
- `FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE`
- `FOREIGN KEY (technique_id) REFERENCES attack_techniques(technique_id) ON DELETE RESTRICT`
- `NOT NULL details`
- `NOT NULL incident_id`
- `NOT NULL observed_at`
- `NOT NULL technique_id`
- `PRIMARY KEY (incident_id, technique_id)`

## incident_vulnerabilities

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| incident_id | uuid | NO | — |
| vulnerability_id | uuid | NO | — |
| discovered_at | timestamp with time zone | NO | now() |
| details | text | NO | ''::text |

Constraints:
- `FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE`
- `FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(vulnerability_id) ON DELETE RESTRICT`
- `NOT NULL details`
- `NOT NULL discovered_at`
- `NOT NULL incident_id`
- `NOT NULL vulnerability_id`
- `PRIMARY KEY (incident_id, vulnerability_id)`

## incidents

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| incident_id | uuid | NO | gen_random_uuid() |
| title | text | NO | — |
| description | text | NO | — |
| severity | text | NO | — |
| status | text | NO | 'Open'::text |
| detected_at | timestamp with time zone | NO | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| created_by | uuid | NO | — |
| assigned_to | uuid | YES | — |
| archived | boolean | NO | false |
| version | integer | NO | 1 |

Constraints:
- `CHECK (((length(TRIM(BOTH FROM description)) >= 10) AND (length(TRIM(BOTH FROM description)) <= 20000)))`
- `CHECK ((severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text])))`
- `CHECK ((status = ANY (ARRAY['Open'::text, 'Investigating'::text, 'Contained'::text, 'Resolved'::text, 'Closed'::text])))`
- `CHECK (((length(TRIM(BOTH FROM title)) >= 3) AND (length(TRIM(BOTH FROM title)) <= 200)))`
- `FOREIGN KEY (assigned_to) REFERENCES app_users(user_id) ON DELETE RESTRICT`
- `FOREIGN KEY (created_by) REFERENCES app_users(user_id) ON DELETE RESTRICT`
- `NOT NULL archived`
- `NOT NULL created_at`
- `NOT NULL created_by`
- `NOT NULL description`
- `NOT NULL detected_at`
- `NOT NULL incident_id`
- `NOT NULL severity`
- `NOT NULL status`
- `NOT NULL title`
- `NOT NULL updated_at`
- `NOT NULL version`
- `PRIMARY KEY (incident_id)`

## remediations

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| remediation_id | uuid | NO | gen_random_uuid() |
| incident_id | uuid | NO | — |
| action | text | NO | — |
| description | text | NO | ''::text |
| status | text | NO | 'Pending'::text |
| completed_at | timestamp with time zone | YES | — |
| version | integer | NO | 1 |

Constraints:
- `CHECK (((length(TRIM(BOTH FROM action)) >= 3) AND (length(TRIM(BOTH FROM action)) <= 200)))`
- `CHECK ((((status = 'Completed'::text) AND (completed_at IS NOT NULL)) OR ((status <> 'Completed'::text) AND (completed_at IS NULL))))`
- `CHECK ((status = ANY (ARRAY['Pending'::text, 'In Progress'::text, 'Completed'::text])))`
- `FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE`
- `NOT NULL action`
- `NOT NULL description`
- `NOT NULL incident_id`
- `NOT NULL remediation_id`
- `NOT NULL status`
- `NOT NULL version`
- `PRIMARY KEY (remediation_id)`

## vulnerabilities

| Attribute | SQL type | Nullable | Default |
|---|---|---|---|
| vulnerability_id | uuid | NO | gen_random_uuid() |
| cve_id | text | YES | — |
| name | text | NO | — |
| severity | text | NO | — |
| description | text | NO | — |
| published_date | date | YES | — |

Constraints:
- `CHECK (((cve_id IS NULL) OR (cve_id ~ '^CVE-[0-9]{4}-[0-9]{4,}$'::text)))`
- `CHECK ((severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text])))`
- `NOT NULL description`
- `NOT NULL name`
- `NOT NULL severity`
- `NOT NULL vulnerability_id`
- `PRIMARY KEY (vulnerability_id)`
- `UNIQUE (cve_id)`

## MongoDB and vector metadata
See DATA-MODEL.md for every document field, validation rule, compound index, embedding dimension and retrieval rule.
