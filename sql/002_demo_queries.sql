-- Run on the synthetic demo database after seeding. All DML below rolls back.
BEGIN;
CREATE TABLE ddl_demo(id integer PRIMARY KEY, note text);
ALTER TABLE ddl_demo ADD CONSTRAINT note_nonempty CHECK(length(note)>0);
INSERT INTO ddl_demo VALUES(1,'DDL and DML evidence');
UPDATE ddl_demo SET note='Updated demonstration' WHERE id=1;
SELECT * FROM ddl_demo;
DELETE FROM ddl_demo WHERE id=1;
DROP TABLE ddl_demo;
-- JOIN / DISTINCT / GROUP BY / ORDER BY
SELECT u.name, count(DISTINCT i.incident_id) AS unresolved_incidents
FROM app_users u JOIN incidents i ON i.assigned_to=u.user_id
WHERE i.status NOT IN ('Resolved','Closed') AND NOT i.archived
GROUP BY u.user_id,u.name HAVING count(DISTINCT i.incident_id)>2
ORDER BY unresolved_incidents DESC;
-- Aggregate and grouping
SELECT severity,count(*) AS incidents FROM incidents WHERE NOT archived GROUP BY severity ORDER BY incidents DESC;
-- Subquery
SELECT incident_id,title FROM incidents i WHERE NOT archived AND EXISTS
 (SELECT 1 FROM remediations r WHERE r.incident_id=i.incident_id AND r.status<>'Completed');
-- View
SELECT title,assignee_name,asset_count FROM incident_overview ORDER BY detected_at DESC LIMIT 10;
-- EXPLAIN: small datasets may prefer a sequential scan.
EXPLAIN ANALYZE SELECT * FROM incidents WHERE status='Open' AND severity='High' ORDER BY detected_at DESC;
-- Safe application-domain DELETE example (rolled back)
DELETE FROM incident_assets WHERE (incident_id,asset_id) IN (SELECT incident_id,asset_id FROM incident_assets LIMIT 1);
ROLLBACK;
-- Trigger evidence, with a valid actor and legal transition; rolled back.
BEGIN;
SELECT set_config('app.actor_id',(SELECT user_id::text FROM app_users WHERE role='Admin' LIMIT 1),true);
UPDATE incidents SET status='Investigating' WHERE incident_id=(SELECT incident_id FROM incidents WHERE status='Open' LIMIT 1);
SELECT * FROM incident_status_history ORDER BY history_id DESC LIMIT 5;
ROLLBACK;
