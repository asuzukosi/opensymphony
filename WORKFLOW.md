---
project_id: symphony-local
poll_interval_ms: 30000
max_concurrency: 2
retry_max_backoff_ms: 300000
workspace:
  root: .symphony-workspaces
# hermes acp on stdio — use absolute path so electron main process can find the binary
acp:
  command: /Users/kosisochukwuasuzu/Developer/agents/hermes-agent/.hermes_venv/bin/hermes
  args: ["acp"]
  permission_mode: auto_approve
# local dev without hermes — demo acp server (replace with your repo absolute path):
#   command: node
#   args: ["/absolute/path/to/symphony/scripts/demo-acp-server.mjs"]
#   permission_mode: auto_approve
hooks:
  timeout_ms: 60000
---

Issue {{identifier}}: {{title}}

{{description}}

Complete the scoped work, run relevant checks, and leave the issue ready for human review.
