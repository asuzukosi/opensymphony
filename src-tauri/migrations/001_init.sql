PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  workspace_root TEXT NOT NULL,
  prompt_template TEXT NOT NULL DEFAULT '',
  poll_interval_ms INTEGER NOT NULL DEFAULT 3000,
  max_concurrency INTEGER NOT NULL DEFAULT 1,
  retry_max_attempts INTEGER NOT NULL DEFAULT 3,
  retry_backoff_ms INTEGER NOT NULL DEFAULT 30000,
  permission_mode TEXT NOT NULL DEFAULT 'requiresApproval'
    CHECK (permission_mode IN ('autoApprove', 'requiresApproval')),
  use_worktrees INTEGER NOT NULL DEFAULT 0,
  orchestrator_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (orchestrator_status IN ('idle', 'running', 'stopped')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platforms (
  project_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, platform),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER,
  board_column TEXT NOT NULL DEFAULT 'backlog'
    CHECK (board_column IN ('backlog', 'inProgress', 'review', 'done')),
  executor TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, identifier),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issue_tags (
  issue_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (issue_id, tag),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issue_files (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issue_comments (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS run_attempts (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  error_message TEXT,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  run_attempt_id TEXT NOT NULL,
  runtime_kind TEXT NOT NULL,
  session_ref TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  FOREIGN KEY (run_attempt_id) REFERENCES run_attempts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pending_permissions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS retry_queue (
  issue_id TEXT PRIMARY KEY,
  attempt_number INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  issue_id TEXT,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_project_id TEXT,
  FOREIGN KEY (active_project_id) REFERENCES projects(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO app_state (id, active_project_id) VALUES (1, NULL);

CREATE INDEX IF NOT EXISTS idx_platforms_project ON platforms(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_project_column ON issues(project_id, board_column);
CREATE INDEX IF NOT EXISTS idx_issues_updated_at ON issues(updated_at);
CREATE INDEX IF NOT EXISTS idx_issue_tags_issue ON issue_tags(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_files_issue ON issue_files(issue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON issue_comments(issue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_run_attempts_issue_started ON run_attempts(issue_id, started_at);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_attempt ON agent_sessions(run_attempt_id);
CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_retry_queue_due_at ON retry_queue(due_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_project_created ON audit_events(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pending_permissions_issue ON pending_permissions(issue_id);
