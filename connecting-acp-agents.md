# Connecting ACP Agents to Symphony

This guide explains how Symphony runs ACP agents in **mock mode** (local dev) and **subprocess mode** (`acp.mode: subprocess` in `WORKFLOW.md`). Use it when wiring a real ACP CLI (for example Hermes) into the desktop orchestrator.

---

## 1. Symphony subprocess contract

When `acp.mode` is `subprocess`, Symphony does not embed an agent runtime. On each dispatch it **spawns a child process** using the `command` and `args` from `WORKFLOW.md`, binds that process to the issue workspace, and tracks success or failure from the process exit code.

Reference implementation: [`apps/desktop/src/runtime/acp.ts`](apps/desktop/src/runtime/acp.ts).

### When a subprocess starts

1. The orchestrator selects a candidate issue and creates a run attempt.
2. The workspace manager ensures a per-issue directory under the configured workspace root (default `.symphony-workspaces/`).
3. `before_agent_run` hooks run in that directory.
4. Symphony calls `spawn(command, args, …)` once per agent session.

Each session gets a unique `sessionId` and a session ref of the form `acp-cli://<sessionId>`.

### Working directory (`cwd`)

The child process **must** run with:

```text
cwd = <workspace_root>/<sanitized_issue_identifier>
```

- `workspace_root` comes from `workspace_root` or `workspace.root` in `WORKFLOW.md` (default `.symphony-workspaces`).
- The directory name is derived from the issue identifier: lowercased, restricted to `[a-z0-9-_]`, with other characters replaced by `-`.

Symphony rejects subprocess sessions when `workspacePath` is empty. Agents should treat `cwd` as the only writable project root for that run.

Symphony also sets `SYMPHONY_WORKSPACE_PATH` to the same absolute path (see below).

### Standard I/O (`stdio`)

Symphony launches the agent with `stdio: "pipe"` (stdin, stdout, and stderr are all piped).

| Stream | Symphony behavior | Implications for agents |
|--------|-------------------|-------------------------|
| **stdin** | Piped, not written by Symphony today | Do not rely on stdin unless your wrapper supplies input |
| **stdout** | Read and buffered in memory for the session | Safe for protocol or log output; not persisted to SQLite |
| **stderr** | Read, appended to an in-memory buffer (max 8192 chars) | Use for diagnostics; surfaced on failure |

**Exit semantics:**

- Exit code **0** → session status `succeeded`.
- Exit code **non-zero** → session status `failed`. The stored error is `exit_<code>` or `exit_<code>:<stderr_tail>` when stderr is non-empty.
- stderr tail length is capped at **500 characters** (most recent bytes).
- Spawn failures (missing binary, `EACCES`, etc.) → `spawn_error:<message>`.

Agents should exit **0 only when the run completed successfully**. Non-zero exits schedule retries according to orchestrator policy.

### Environment variables

The subprocess inherits the Electron main process environment (`process.env`) plus these Symphony variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `SYMPHONY_RUN_ATTEMPT_ID` | Stable id for this run attempt | `issue-1:attempt:1` |
| `SYMPHONY_ISSUE_ID` | Internal issue id (DB key) | `issue-1` |
| `SYMPHONY_ATTEMPT_NUMBER` | 1-based attempt number for this issue | `1` |
| `SYMPHONY_WORKSPACE_PATH` | Absolute path to the issue workspace (same as `cwd`) | `/path/.symphony-workspaces/sym-1` |

No other Symphony-specific variables are injected today. Prefer these over parsing argv when possible.

Example check inside a wrapper script:

```bash
cd "$SYMPHONY_WORKSPACE_PATH"
echo "run attempt $SYMPHONY_RUN_ATTEMPT_ID for issue $SYMPHONY_ISSUE_ID"
```

### Command and arguments

Configure the executable in `WORKFLOW.md`:

```yaml
acp:
  mode: subprocess
  command: hermes
  args: ["acp"]
```

Symphony invokes `spawn(command, args, …)` **without a shell**. Paths must be resolvable on `PATH`, or `command` must be an absolute path. Arguments are passed verbatim; use `args` for flags and subcommands.

Default when omitted (mock-oriented fallback in config parsing): `command: node`, `args: ["-e", "setTimeout(() => process.exit(0), 1200)"]` — override this for real agents.

### Cancellation

If the orchestrator reconciles away a running session (issue moved to a terminal state, duplicate dispatch cleanup, etc.), Symphony sends **SIGTERM** to the child, marks the session `cancelled`, and sets `errorMessage` to `cancelled_by_reconciliation`.

Agents should handle SIGTERM and exit promptly.

### Minimal agent checklist

1. Read `SYMPHONY_*` env vars (or accept equivalent flags from a thin wrapper).
2. Run all file changes under `cwd` / `SYMPHONY_WORKSPACE_PATH`.
3. Log diagnostics to **stderr**, not stdout, if stdout is reserved for protocol output.
4. Exit **0** on success, **non-zero** on failure.
5. Ensure `command` is on `PATH` (or use an absolute path) when configuring `WORKFLOW.md`.

---

## 2. Hermes install and example

[Hermes Agent](https://github.com/NousResearch/hermes-agent) can run as an **ACP server** on stdio (`hermes acp`). Symphony uses the same launch shape as ACP-compatible editors: spawn `hermes` with argument `acp`, with `cwd` set to the issue workspace (see [§1](#1-symphony-subprocess-contract)).

Official Hermes ACP docs: [ACP Editor Integration](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp).

### Install Hermes with the ACP extra

Install Hermes from the upstream project, then enable the ACP optional dependency:

```bash
git clone https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
pip install -e '.[acp]'
```

Equivalent with `uv`:

```bash
uv pip install -e '.[acp]'
```

This installs `agent-client-protocol` and exposes:

- `hermes acp` (CLI subcommand — recommended for `WORKFLOW.md`)
- `hermes-acp` (standalone entry point)
- `python -m acp_adapter`

Confirm the binary is on your `PATH`:

```bash
which hermes
hermes acp --version
hermes acp --check
hermes doctor
```

Hermes logs diagnostics to **stderr** and reserves **stdout** for ACP JSON-RPC. That matches Symphony's subprocess contract in [§1](#1-symphony-subprocess-contract).

### Configure provider credentials

ACP mode reuses normal Hermes configuration (`~/.hermes/.env`, `~/.hermes/config.yaml`). There is no separate ACP login flow.

Before dispatching from Symphony, configure a model/provider from a regular shell:

```bash
hermes model
hermes status
```

Symphony inherits the desktop app's environment when it spawns agents. If `hermes` works in your terminal but fails from Symphony, compare `PATH` and Hermes config files between the two environments (see [§5](#5-troubleshooting)).

### `WORKFLOW.md` example (subprocess + Hermes)

Start from the repo-root [`WORKFLOW.md`](WORKFLOW.md) and switch `acp.mode` from `mock` to `subprocess`:

```yaml
---
project_id: symphony-local
poll_interval_ms: 30000
max_concurrency: 2
retry_max_backoff_ms: 300000
workspace_root: .symphony-workspaces
acp:
  mode: subprocess
  command: hermes
  args: ["acp"]
hooks:
  timeout_ms: 60000
  before_agent_run:
    - git status
---

You are working on a Symphony issue from the local project board.

Complete the scoped work, run relevant checks, and leave the issue ready for human review.
```

Symphony resolves `WORKFLOW.md` from the repo root by default, or from `SYMPHONY_WORKFLOW_PATH` when set.

Settings → **Configuration** shows the resolved workflow path, ACP mode, command, and args after the runtime loads the file.

### What Symphony does at dispatch

On each agent session Symphony runs (equivalent to):

```text
spawn("hermes", ["acp"], {
  cwd: "<workspace_root>/<sanitized_issue_identifier>",
  env: { ...process.env, SYMPHONY_* },
  stdio: "pipe",
})
```

It records **succeeded** when the child exits `0`, **failed** when the child exits non-zero (stderr tail attached), and **cancelled** on orchestrator reconciliation (`SIGTERM`).

### Integration note (stdio / exit code)

Symphony's subprocess adapter today **does not write ACP messages to the child's stdin**. It monitors the process lifecycle and exit code only (see [§1](#1-symphony-subprocess-contract)).

`hermes acp` starts an ACP **server** that expects a client on stdio. Editors provide that client; Symphony does not yet. A bare `hermes acp` child may stay running until reconciliation cancels it, rather than exiting after one issue.

For local verification of cwd, env vars, and spawn wiring, use a short test command first (as in `apps/desktop/test/subprocess-acp-runtime.test.ts`), then move to Hermes once you add a wrapper or future ACP client support.

Example temporary smoke test in `WORKFLOW.md`:

```yaml
acp:
  mode: subprocess
  command: /absolute/path/to/write-env.sh
  args: []
```

Example wrapper layout for Hermes (pattern only — adjust to your agent flow):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$SYMPHONY_WORKSPACE_PATH"
# run one bounded agent job, then exit 0/1 for Symphony
exec hermes chat -q "Work on the issue in this workspace. Exit when done."
```

Point `acp.command` at the wrapper script (absolute path or `PATH` entry) until Symphony acts as a full ACP client.

### End-to-end checklist

1. `hermes acp --check` passes in the same environment that launches Symphony.
2. `WORKFLOW.md` sets `acp.mode: subprocess`, `command: hermes`, `args: ["acp"]` (or a wrapper script).
3. Start Symphony (`bun run dev`), open **Settings**, confirm ACP config.
4. Create or move an issue to an active board column; start the runtime and run a tick (**Agents** or **Settings**).
5. Inspect the issue workspace under `.symphony-workspaces/<identifier>/` and run history on the issue detail page.

## 3. Mock mode

Mock mode is the default in the repo-root [`WORKFLOW.md`](WORKFLOW.md). Use it for local UI development, orchestrator testing, and board/agents flows **without** installing an external ACP CLI.

### Configuration

```yaml
acp:
  mode: mock
  mock_completion_delay_ms: 1200
```

| Field | Purpose |
|-------|---------|
| `mode: mock` | Selects the in-process mock adapter (`runtimeKind: mock-acp` in the UI) |
| `mock_completion_delay_ms` | Simulated agent runtime before the session completes (default `1200`) |

`command` and `args` are parsed but **not used** in mock mode — no subprocess is spawned.

### Behavior

1. On dispatch, Symphony creates a mock session with ref `acp://<issueId>/<attemptNumber>`.
2. On each orchestrator tick, Symphony polls open sessions. When `now >= startedAt + mock_completion_delay_ms`, the session finishes.
3. **Success** → run attempt `succeeded`, no retry scheduled for that completion path.
4. **Failure heuristic** → if the internal `issueId` contains `fail` (case-insensitive) and `attemptNumber <= 2`, the session fails with `mock_acp_failure` and a retry is scheduled.

Example: create an issue with id `issue-fail-demo` to exercise the failure/retry path (see `apps/desktop/test/mock-acp-runtime.test.ts`).

Mock mode still runs **workspace hooks** and creates per-issue workspace directories the same way as subprocess mode.

### When to use mock vs subprocess

| Use mock when… | Use subprocess when… |
|-----------------|----------------------|
| Developing dashboard, board, agents, issue detail | Testing a real ACP CLI (Hermes, custom wrapper) |
| Running CI without agent binaries | Validating cwd, env vars, stderr tails |
| Quick orchestration smoke tests | Integrating provider credentials and PATH |

Switch modes by editing `WORKFLOW.md` (or pointing `SYMPHONY_WORKFLOW_PATH` at another file) and reloading the runtime. Settings → **Configuration** shows the active `acp.mode`.

---

## 4. Workspace binding

Each dispatched issue gets an isolated working directory. Agents (subprocess or mock) receive the same path as `cwd` and `SYMPHONY_WORKSPACE_PATH`.

### Path layout

```text
<workspace_root>/<sanitized_issue_identifier>/
```

- **`workspace_root`** — from `workspace_root` or `workspace.root` in `WORKFLOW.md` (default `.symphony-workspaces`).
- Resolved relative to the Electron main process working directory (repo root when running `bun run dev`).
- **`sanitized_issue_identifier`** — issue `identifier` lowercased; characters outside `[a-z0-9-_]` become `-`; leading/trailing `-` stripped; empty slug becomes `issue`.

Example: identifier `SYMPHONYLOCAL-1` → directory `.symphony-workspaces/symphonylocal-1`.

Implementation: [`packages/core/src/services/workspace-manager-service.ts`](packages/core/src/services/workspace-manager-service.ts).

### Lifecycle

| Phase | Action |
|-------|--------|
| First dispatch | `mkdir -p` workspace; run `after_create` hooks |
| Before agent | Run `before_agent_run` hooks in workspace |
| After run completes/fails | Run `after_run` hooks (failures logged, non-fatal) |
| Issue reaches terminal state | Run `before_remove` hooks; delete workspace directory |
| App startup | Remove workspaces for issues already in terminal states |

Hooks are shell commands run with `cwd` set to the workspace. Configure them under `hooks` in `WORKFLOW.md`:

```yaml
hooks:
  timeout_ms: 60000
  after_create:
    - git init
  before_agent_run:
    - git status
  after_run:
    - git status
  before_remove:
    - echo "cleaning up"
```

Hook failure semantics:

- `after_create` / `before_agent_run` failure → **fatal** to the run attempt (dispatch fails).
- `after_run` / `before_remove` failure → logged; run outcome still recorded.

Subprocess agents should treat the workspace as the only mutable tree for that issue. Do not write outside `SYMPHONY_WORKSPACE_PATH`.

---

## 5. Troubleshooting

### Agent never starts (`spawn_error:…`)

Symptoms: run attempt fails immediately; error starts with `spawn_error:`.

Common causes:

- `acp.command` not on `PATH` for the Electron main process (different from your interactive shell).
- Typo in `command` or missing executable bit on a wrapper script.
- Subprocess mode with empty workspace path (should not happen after dispatch — indicates an internal error).

Fixes:

1. Open **Settings → Configuration** and confirm command/args.
2. Use an **absolute path** to the binary or wrapper in `WORKFLOW.md`.
3. Launch Symphony from a shell where `which hermes` (or your command) succeeds, or export `PATH` before `bun run dev`.
4. If the agent bundles native modules, rebuild for your host OS/arch (e.g. reinstall the Python/Node package after platform upgrades). Wrong-arch binaries often surface as immediate `spawn_error` or exit code `126`/`127` in the stderr tail.

### Agent exits non-zero (`exit_<code>:…`)

Symptoms: session `failed`; `errorMessage` like `exit_1:…` with an optional stderr tail (max **500** characters).

Common causes:

- Agent script returned non-zero.
- Hermes/provider misconfiguration (stderr often explains the failure).
- Hook failure surfaced through the agent wrapper.

Fixes:

1. Open the issue **Run history** table — stderr tail is stored on the failed attempt.
2. Re-run the same command manually with `cwd` set to the issue workspace and `SYMPHONY_*` env vars exported.
3. For Hermes, run `hermes doctor`, `hermes status`, and `hermes acp --check` in the launch environment.

### Mock failure (`mock_acp_failure`)

Symptoms: mock session fails without a subprocess.

Cause: issue id contains `fail` and attempt number is `1` or `2` (test heuristic).

Fix: use a neutral issue id, or expect retries while testing failure paths.

### Session cancelled (`cancelled_by_reconciliation`)

Symptoms: session ends with `cancelled_by_reconciliation`; subprocess receives `SIGTERM`.

Causes:

- Issue moved to a terminal workflow state while running.
- Orchestrator reconciliation cancelled duplicate/stale runs.

Fix: expected for terminal transitions; workspace is removed when the issue reaches a terminal state.

### Hermes / ACP server hangs (no exit)

Symptoms: run stays `running`; mock-style progress never completes in subprocess mode.

Cause: `hermes acp` starts an ACP **server** waiting on stdin; Symphony does not send ACP JSON-RPC yet (see [§2 integration note](#integration-note-stdio--exit-code)).

Fix: use a **wrapper script** that runs a bounded job and exits, use **mock mode** for UI work, or verify spawn with a short shell script first.

### Wrong or missing workspace

Symptoms: agent writes files outside the expected tree, or workspace directory name looks unexpected.

Checks:

1. Confirm issue **identifier** on the board (sanitization derives the folder name).
2. Inspect `.symphony-workspaces/` under the repo root (or your configured `workspace_root`).
3. Verify `SYMPHONY_WORKSPACE_PATH` inside the agent matches that directory.

### Workflow not loading / validation errors

Symptoms: dashboard **validation** alert; settings show unexpected config.

Checks:

1. `WORKFLOW.md` YAML front matter parses (`---` delimiters, valid indentation).
2. Required fields: `project_id`, `acp.mode` (`mock` or `subprocess`).
3. Override path: `SYMPHONY_WORKFLOW_PATH=/absolute/path/to/WORKFLOW.md`.
4. Default resolution: repo-root `WORKFLOW.md`, else `WORKFLOW.md` in the process cwd (see [`apps/desktop/src/runtime/workflow-path.ts`](apps/desktop/src/runtime/workflow-path.ts)).

### Poll / dispatch confusion

Symptoms: candidates never run; agents board empty.

Checks:

1. **Settings** → start runtime, confirm status is not `idle`/`stopped` as expected.
2. Run **Run tick** manually; check poll interval.
3. Issue must be in an **active** workflow state column on the board.
4. `max_concurrency` may cap parallel runs — see running/retry queues on **Agents** and **Dashboard**.

### Quick diagnostic commands

```bash
# confirm workflow file used by dev
echo "$SYMPHONY_WORKFLOW_PATH"

# mock path smoke test (from repo root)
bun run test -- apps/desktop/test/mock-acp-runtime.test.ts

# subprocess cwd/env smoke test
bun run test -- apps/desktop/test/subprocess-acp-runtime.test.ts

# hermes (subprocess mode)
hermes doctor && hermes acp --check
```

For structured runtime logs, inspect JSON-line events from the Electron main process (`attempt_dispatched`, `attempt_failed`, `workspace_cleanup_terminal_transition`, etc.).

