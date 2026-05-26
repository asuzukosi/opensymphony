#!/usr/bin/env bash
set -euo pipefail
cd "$SYMPHONY_WORKSPACE_PATH"
exec /Users/kosisochukwuasuzu/Developer/agents/hermes-agent/.hermes_venv/bin/hermes chat -q "Work on the issue in this workspace. Exit when done."