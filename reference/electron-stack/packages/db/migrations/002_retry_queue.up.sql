CREATE TABLE IF NOT EXISTS retry_queue (
  issue_id TEXT PRIMARY KEY,
  attempt_number INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_retry_queue_due_at ON retry_queue(due_at);
