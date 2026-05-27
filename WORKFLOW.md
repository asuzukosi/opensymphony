---
project_id: symphony-local
poll_interval_ms: 30000
max_concurrency: 2
retry_max_backoff_ms: 300000
workspace:
  root: .symphony-workspaces
# local dev default — demo acp server on stdio (replace with your repo absolute path)
acp:
  command: node
  args: ["/absolute/path/to/symphony/scripts/demo-acp-server.mjs"]
  permission_mode: auto_approve
# production with hermes (requires `hermes` on PATH; run `hermes acp --check`):
#   command: hermes
#   args: ["acp"]
#   permission_mode: requires_approval
hooks:
  timeout_ms: 60000
---

Issue {{identifier}}: {{title}}

{{description}}

Complete the scoped work, run relevant checks, and leave the issue ready for human review.
