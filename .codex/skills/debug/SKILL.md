---
name: debug
description:
  Investigate stuck runs and execution failures by tracing Symphony Electron
  runtime logs with issue/session identifiers; use when runs stall, retry
  repeatedly, or fail unexpectedly.
---

# Debug

## Goals

- Find why a run is stuck, retrying, or failing in the Electron orchestrator.
- Correlate issue identity to an ACP session quickly.
- Read structured logs in the right order to isolate root cause.

## Log Sources

- Primary runtime log: Electron main-process stdout/stderr while the desktop app runs.
  - `StructuredLoggerService` emits one JSON object per line.
  - Capture from the terminal running `bun run dev`, or from packaged app logs if redirected.
- DevTools console: renderer errors only; orchestration diagnostics live in main-process logs.

## Correlation Keys

JSON log fields from `StructuredLoggerService`:

- `issueIdentifier`: human ticket key (example: `P1-42`)
- `issueId`: internal SQLite issue id
- `runAttemptId`: orchestrator run attempt id
- `sessionId`: ACP agent session id
- `sessionId`: symphony-side session row id
- `sessionRef`: acp agent session id from `session/new`
- `event`: stable event name for filtering (`dispatch_started`, `session_finished`, etc.)

Use these fields as join keys during debugging.

## Quick Triage (Stuck Run)

1. Confirm the issue appears in `getRuntimeState` running or retrying queues.
2. Find recent JSON lines for the ticket (`issueIdentifier` or `issueId`).
3. Extract `sessionId` and `runAttemptId` from matching lines.
4. Trace that session across start, poll updates, completion/failure, and retry scheduling.
5. Decide class of failure: ACP subprocess/protocol error, early process exit, reconciliation cancel, or retry loop.

## Commands

```bash
# 1) Narrow by ticket identifier (fastest entry point)
rg -n '"issueIdentifier":"P1-42"' /path/to/captured-main.log

# 2) If needed, narrow by internal issue id
rg -n '"issueId":"issue-uuid"' /path/to/captured-main.log

# 3) Pull session ids seen for that ticket
rg -o '"sessionId":"[^"]+"' /path/to/captured-main.log | sort -u

# 4) Trace one session end-to-end
rg -n '"sessionId":"<session-id>"' /path/to/captured-main.log

# 5) Focus on retry/failure signals
rg -n 'session_failed|run_failed|retry_scheduled|reconcile_cancelled|"level":"error"' /path/to/captured-main.log
```

## Investigation Flow

1. Locate the ticket slice:
   - Search by `issueIdentifier` first.
   - Add `issueId` if noise is high.
2. Establish timeline:
   - Identify dispatch / session start events for the `runAttemptId`.
   - Follow with session poll updates and terminal session/run events.
3. Classify the problem:
   - ACP subprocess failure: spawn error, early process exit, or protocol error.
   - Reconciliation cancel: issue left active workflow states while a run was in flight.
   - Retry loop: failed run with scheduled retry entry in snapshot/retry queue.
4. Validate scope:
   - Check whether failures are isolated to one issue/session or repeating across tickets.
5. Capture evidence:
   - Save key JSON lines with `timestamp`, `issueIdentifier`, `issueId`, `runAttemptId`, and
     `sessionId`.
   - Record probable root cause and the exact failing stage.

## Notes

- Prefer `rg` over `grep` for speed on large log captures.
- Main-process logs are JSON lines; pipe through `jq` when you need formatted fields.
- Renderer IPC errors usually indicate UI wiring problems, not orchestrator dispatch failures.
