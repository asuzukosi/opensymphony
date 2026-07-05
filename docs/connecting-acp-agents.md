# Connecting ACP Agents to Symphony

This guide explains how Symphony runs agents through the **ACP JSON-RPC client**. Symphony spawns a configured ACP **server** on stdio, acts as the ACP **client**, and drives session completion from protocol messages — not from process exit codes.

Reference implementation: [`apps/desktop/src/runtime/acp/acp-client-adapter.ts`](../apps/desktop/src/runtime/acp/acp-client-adapter.ts).

---

## 1. ACP client architecture

When Symphony loads an `acp` block from `WORKFLOW.md`, it uses `ACPClientAdapter`:

1. Spawns `command` + `args` with `stdio: "pipe"` and `cwd` set to the issue workspace.
2. Connects `@agentclientprotocol/sdk` `ClientSideConnection` over NDJSON on the child stdio.
3. Runs the session lifecycle: `initialize` → `session/new` → `session/prompt` → handle `session/update` and `session/request_permission` → complete on `stopReason`.
4. Persists session events (prompt, stream chunks, tool calls, permissions, errors) for the issue detail timeline.
5. Exposes live **phase** and **last event summary** on running agent cards.

Symphony implements only two client handlers:

| Handler | Purpose |
|---------|---------|
| `session/update` | Stream chunks, tool calls, phase transitions, persisted events |
| `session/request_permission` | Operator policy (`auto_approve` or `requires_approval`) |

Symphony does **not** implement `fs/*` or `terminal/*` client capabilities. Agents read and write files inside the issue workspace via spawn `cwd` / `SYMPHONY_WORKSPACE_PATH`.

### Subprocess contract

Each session gets a unique Symphony `sessionId`. The adapter stores the agent's `sessionId` from `session/new` as `sessionRef` once the ACP handshake completes. Legacy schemes such as `acp://issue/attempt` and `acp-cli://…` are no longer written.

**Working directory:**

```text
cwd = <workspace_root>/<sanitized_issue_identifier>
```

- `workspace_root` from `workspace_root` or `workspace.root` in `WORKFLOW.md` (default `.symphony-workspaces`).
- Symphony rejects sessions when `workspacePath` is empty.

**Environment variables** (inherited `process.env` plus):

| Variable | Description |
|----------|-------------|
| `SYMPHONY_RUN_ATTEMPT_ID` | Stable id for this run attempt |
| `SYMPHONY_ISSUE_ID` | Internal issue id |
| `SYMPHONY_ATTEMPT_NUMBER` | 1-based attempt number |
| `SYMPHONY_WORKSPACE_PATH` | Absolute workspace path (same as `cwd`) |

**Command and arguments** — configure in `WORKFLOW.md`:

```yaml
acp:
  command: hermes
  args: ["acp"]
  permission_mode: auto_approve
```

Symphony calls `spawn(command, args, …)` without a shell. Use an absolute path when the binary is not on `PATH`.

**Cancellation:** reconciliation sends `session/cancel`, then `SIGTERM` to the child if needed. Session status becomes `cancelled` with `cancelled_by_reconciliation`.

**Early process exit** before a protocol turn completes is recorded as a structured session error (for example `early_process_exit_1`), not as a generic exit-code success/failure path.

Implementation modules:

| Module | Role |
|--------|------|
| [`acp-protocol.ts`](../apps/desktop/src/runtime/acp/acp-protocol.ts) | SDK re-exports + initialize defaults |
| [`stdio-stream.ts`](../apps/desktop/src/runtime/acp/stdio-stream.ts) | Child stdio → NDJSON stream |
| [`symphony-client.ts`](../apps/desktop/src/runtime/acp/symphony-client.ts) | `ClientSideConnection` factory |
| [`prompt-renderer.ts`](../apps/desktop/src/runtime/acp/prompt-renderer.ts) | `WORKFLOW.md` prompt + issue fields |
| [`permission-router.ts`](../apps/desktop/src/runtime/acp/permission-router.ts) | Permission policy routing |
| [`permission-store.ts`](../apps/desktop/src/runtime/acp/permission-store.ts) | Pending permission queue |

---

## 2. Visibility model

Symphony surfaces in-progress agent work through three layers:

### Session phases

`ACPClientAdapter` tracks phase per session:

`spawning` → `initializing` → `prompting` → `streaming` → `terminal`

Running entries in the runtime snapshot include `phase` and `lastEventSummary`. The **Agents** page running cards show both.

### Session events (SQLite)

Events append to `session_events` during the run:

| Kind | Source |
|------|--------|
| `prompt` | Rendered task sent to the agent |
| `stream_chunk` | `session/update` with `agent_message_chunk` |
| `tool_call` | `session/update` with `tool_call` |
| `permission_request` / `permission_resolve` | Permission flow |
| `error` | Protocol or lifecycle failures |

Issue detail → **Run history** → **Session timeline** renders these events chronologically.

### Audit trail

Structured JSON-line logs from the orchestrator (`attempt_dispatched`, `attempt_failed`, etc.) remain available in the Electron main process output.

---

## 3. Permission modes

Configure the default in `WORKFLOW.md`:

```yaml
acp:
  permission_mode: auto_approve   # or requires_approval
```

| Mode | Behavior |
|------|----------|
| `auto_approve` | Symphony approves `session/request_permission` immediately. Events are still persisted. |
| `requires_approval` | Requests enqueue in the main-process permission store. The agent blocks until an operator approves or denies. |

When `requires_approval` is active and pending items exist, the desktop app shows a **Pending agent permissions** banner (approve/deny per request with issue and session context).

### Settings override

Operators can override the workflow default without editing `WORKFLOW.md`:

- **Settings → Agent permissions** — select **Auto approve** or **Requires approval**
- **Reset to workflow default** — clears the runtime override (same pattern as poll interval override)

Settings exposes `permissionMode` and `permissionModeSource` (`workflow` or `override`).

IPC:

- `getPendingPermissions()` — list pending requests (empty in `auto_approve`)
- `resolvePermission({ id, decision: "approve" | "deny" })` — unblocks the agent
- `controlRuntime({ action: "setPermissionMode", permissionMode })` / `clearPermissionModeOverride`

---

## 4. `WORKFLOW.md` configuration

Start from the repo-root [`WORKFLOW.md`](../WORKFLOW.md).

**Production (Hermes ACP):**

```yaml
---
project_id: symphony-local
poll_interval_ms: 30000
max_concurrency: 2
retry_max_backoff_ms: 300000
workspace:
  root: .symphony-workspaces
acp:
  command: hermes
  args: ["acp"]
  permission_mode: auto_approve
hooks:
  timeout_ms: 60000
---

Issue {{identifier}}: {{title}}

{{description}}

Complete the scoped work, run relevant checks, and leave the issue ready for human review.
```

Prompt template variables: `{{identifier}}`, `{{title}}`, `{{description}}`.

Symphony resolves `WORKFLOW.md` from the repo root by default, or from `SYMPHONY_WORKFLOW_PATH`. **Settings → Configuration** shows the loaded workflow path, ACP command/args, permission mode, and prompt template preview.

At dispatch, Symphony effectively runs:

```text
spawn("hermes", ["acp"], {
  cwd: "<workspace_root>/<sanitized_issue_identifier>",
  env: { ...process.env, SYMPHONY_* },
  stdio: "pipe",
})
```

Then speaks ACP JSON-RPC on stdin/stdout: initialize, session/new, session/prompt with the rendered issue prompt.

---

## 5. Hermes install and checklist

[Hermes Agent](https://github.com/NousResearch/hermes-agent) runs as an ACP server on stdio (`hermes acp`).

Official docs: [ACP Editor Integration](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp).

### Install

```bash
git clone https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
pip install -e '.[acp]'
```

Confirm the binary:

```bash
which hermes
hermes acp --version
hermes acp --check
hermes doctor
```

Hermes logs diagnostics to **stderr** and uses **stdout** for ACP JSON-RPC.

Configure provider credentials in `~/.hermes/.env` and `~/.hermes/config.yaml` before dispatching from Symphony.

### End-to-end checklist (production)

1. `hermes acp --check` passes in the environment that launches Symphony.
2. `WORKFLOW.md` sets `command: hermes`, `args: ["acp"]`.
3. Start Symphony (`bun run dev`), open **Settings**, confirm ACP config and permission mode.
4. Move an issue to an active board column; start the runtime and run a tick.
5. Inspect `.symphony-workspaces/<identifier>/`, **Agents** running cards (phase / last event), and issue **Session timeline**.

For local dev without Hermes, use the demo server config in §6 instead of step 2.

If `hermes` works in your terminal but fails from Symphony, compare `PATH` and Hermes config between the two environments.

---

## 6. Local development (demo ACP server)

The repo-root [`WORKFLOW.md`](../WORKFLOW.md) defaults to the demo ACP server for local development without Hermes. Update the `args` entry to the **absolute path** of [`scripts/demo-acp-server.mjs`](../scripts/demo-acp-server.mjs) in your clone:

```yaml
acp:
  command: node
  args: ["/absolute/path/to/symphony/scripts/demo-acp-server.mjs"]
  permission_mode: auto_approve
```

Use an **absolute path** — agent subprocesses start in the issue workspace, not the repo root.

Smoke tests:

```bash
bun run test -- apps/desktop/test/acp-client-adapter.test.ts
bun run test -- apps/desktop/test/acp-json-rpc.test.ts
bun run test -- apps/desktop/test/acp-permission.test.ts
```

Optional Hermes integration (skipped when binary missing):

```bash
bun run test -- apps/desktop/test/acp-client-spike.test.ts
```

---

## 7. Workspace binding

Each dispatched issue gets an isolated directory:

```text
<workspace_root>/<sanitized_issue_identifier>/
```

Implementation: [`packages/core/src/services/workspace-manager-service.ts`](../packages/core/src/services/workspace-manager-service.ts).

| Phase | Action |
|-------|--------|
| First dispatch | Create workspace; run `after_create` hooks |
| Before agent | Run `before_agent_run` hooks |
| After run | Run `after_run` hooks |
| Terminal state | Run `before_remove` hooks; delete workspace |

Hook failure semantics:

- `after_create` / `before_agent_run` failure → fatal to dispatch
- `after_run` / `before_remove` failure → logged; run outcome still recorded

Agents should treat `SYMPHONY_WORKSPACE_PATH` as the only mutable tree for that issue.

---

## 8. Troubleshooting

### `spawn_error:…`

- `acp.command` not on `PATH` for the Electron main process
- Typo in command or missing executable bit
- Fix: use an absolute path; launch Symphony from a shell where `which hermes` succeeds

### Session failed with protocol or early-exit errors

- Check issue **Run history** and **Session timeline** for `error` events
- Re-run manually with the same `cwd` and `SYMPHONY_*` env vars
- For Hermes: `hermes doctor`, `hermes status`, `hermes acp --check`

### Permission queue stuck

- Confirm **Settings → Agent permissions** is **Requires approval**
- Approve or deny pending items in the app banner
- Pending list is empty when mode is **Auto approve**

### Session cancelled (`cancelled_by_reconciliation`)

Expected when the issue moves to a terminal state or reconciliation cancels duplicate runs.

### Workflow validation errors

- Required: `project_id`, `acp.command`
- Override: `SYMPHONY_WORKFLOW_PATH=/absolute/path/to/WORKFLOW.md`
- Default resolution: [`apps/desktop/src/runtime/workflow-path.ts`](../apps/desktop/src/runtime/workflow-path.ts)

### Dispatch never runs

- Start runtime in **Settings**; run **Run tick**
- Issue must be in an active workflow column
- Check `max_concurrency` and running/retry queues on **Agents**

---

## 9. Deprecated legacy pathways

The following approaches are **retired** and must not be used for new integrations.

### Exit-code subprocess (removed)

Previously, Symphony spawned a child and inferred success/failure from **process exit code** only (`exit_0`, `exit_1:stderr`, etc.). That path had no `session/update` stream, no permission flow, no phase transitions, and no meaningful in-progress observability.

Do **not** point `acp.command` at wrapper scripts that run `hermes chat` and exit. Use `hermes acp` (ACP server) instead. Symphony is now the ACP client.

### Removed config fields

`acp.mode` and `mock_completion_delay_ms` are no longer used. Symphony always runs the ACP JSON-RPC client against `acp.command` + `acp.args`.

Legacy in-process mock mode (`acp.mode: mock`) has been removed. Use the demo ACP server (§6) for local dev and CI instead:

```yaml
acp:
  command: node
  args: ["/absolute/path/to/symphony/scripts/demo-acp-server.mjs"]
```

### Removed references

- Exit-code troubleshooting (`exit_<code>:…` as primary completion signal) — see §8 session timeline errors instead
