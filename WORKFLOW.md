---
project_id: symphony-local
poll_interval_ms: 30000
max_concurrency: 2
retry_max_backoff_ms: 300000
workspace:
  root: .symphony-workspaces
acp:
  mode: mock
  mock_completion_delay_ms: 1200
hooks:
  timeout_ms: 60000
---

You are working on a Symphony issue from the local project board.

Complete the scoped work, run relevant checks, and leave the issue ready for human review.
