PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_audit_events_issue_created;
DROP INDEX IF EXISTS idx_audit_events_project_created;
DROP INDEX IF EXISTS idx_workflow_snapshots_project_created;
DROP INDEX IF EXISTS idx_agent_sessions_attempt;
DROP INDEX IF EXISTS idx_run_attempts_issue_started;
DROP INDEX IF EXISTS idx_labels_project;
DROP INDEX IF EXISTS idx_issue_comments_issue;
DROP INDEX IF EXISTS idx_issues_updated_at;
DROP INDEX IF EXISTS idx_issues_project_state;
DROP INDEX IF EXISTS idx_workflow_states_project_position;

DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS workflow_config_snapshots;
DROP TABLE IF EXISTS agent_sessions;
DROP TABLE IF EXISTS run_attempts;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS issue_dependencies;
DROP TABLE IF EXISTS issue_labels;
DROP TABLE IF EXISTS labels;
DROP TABLE IF EXISTS issue_comments;
DROP TABLE IF EXISTS issues;
DROP TABLE IF EXISTS workflow_states;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS schema_migrations;

PRAGMA foreign_keys = ON;
