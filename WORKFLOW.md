---
project_id: symphony-local
poll_interval_ms: 30000
max_concurrency: 2
retry_max_backoff_ms: 300000
workspace:
  root: .symphony-workspaces
acp:
  mode: subprocess
  command: /Users/kosisochukwuasuzu/Developer/interfaces/symphony/run-hermes.sh
  args: []
hooks:
  timeout_ms: 60000
---

You are working on a Symphony issue from the local project board.

Complete the scoped work, run relevant checks, and leave the issue ready for human review.
