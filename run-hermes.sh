#!/usr/bin/env bash
# deprecated — do not use for new Symphony setups.
#
# this script ran `hermes chat` and inferred success from process exit code.
# symphony now uses the acp json-rpc client (`ACPClientAdapter`) and expects
# an acp server on stdio (for example `hermes acp` or scripts/demo-acp-server.mjs).
#
# migration:
#   production: set WORKFLOW.md to `command: hermes`, `args: ["acp"]`
#   local dev:  set WORKFLOW.md to `command: node`,
#               `args: ["/absolute/path/to/symphony/scripts/demo-acp-server.mjs"]`
#
# see connecting-acp-agents.md for the full subprocess contract.

set -euo pipefail
cd "$SYMPHONY_WORKSPACE_PATH"
exec /Users/kosisochukwuasuzu/Developer/agents/hermes-agent/.hermes_venv/bin/hermes chat -q "Work on the issue in this workspace. Exit when done."
