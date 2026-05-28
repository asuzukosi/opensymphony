---
project_id: symphony-local
poll_interval_ms: 3000
max_concurrency: 2
retry_max_backoff_ms: 300000
workspace:
  root: .symphony-workspaces
# hermes acp on stdio — use absolute path so electron main process can find the binary
acp:
  command: /Users/kosisochukwuasuzu/Developer/agents/hermes-agent/.hermes_venv/bin/hermes
  args: ["acp"]
  permission_mode: requires_approval # auto_approve or requires_approval
# local dev without hermes — demo acp server (replace with your repo absolute path):
#   command: node
#   args: ["/absolute/path/to/symphony/scripts/demo-acp-server.mjs"]
#   permission_mode: requires_approval
hooks:
  timeout_ms: 60000
---

Issue {{identifier}}: {{title}}

{{description}}

Log your plan in 2-4 bullets for your own reference and the user's visibility — do not wait for approval, proceed straight into execution.

Take the fewest steps that still produce correct work. No over-engineering, no extra scope, no sub-agents unless strictly required.

After implementing, verify the task was actually completed correctly (run tests, builds, or whatever the repo uses to confirm the change works). Leave the work ready for human review.

End with a brief summary: what changed and any follow-up notes. No preamble, no conversational filler.
