# Symphony (TypeScript Monorepo)

This repository contains a Bun + Turbo + TypeScript implementation of Symphony in a React + Electron format.

## Current Scope

- UI-first desktop orchestration runtime (Electron main + renderer).
- No non-UI control plane/server in this implementation.
- Local SQLite task tracking (`@symphony/db` + `@symphony/core` services).
- ACP agent subprocess integration (mock mode for dev, subprocess mode for real agents).

## Monorepo Layout

- `apps/desktop`: Electron app shell, orchestration runtime loop, IPC, React UI routes.
- `packages/core`: orchestration domain/services (config parsing, selection, retries, lifecycle, adapters, logging, restart recovery).
- `packages/db`: SQLite schema/migrations + repository/store layer.
- `packages/ui`: shared UI primitives and styles used by desktop renderer.
- `tests/e2e`: Playwright harness for end-to-end acceptance checks.

## Architecture Summary

```
WORKFLOW.md → runtime config → orchestrator tick loop (Electron main)
                    ↓
              @symphony/db (SQLite) + @symphony/core (selection, retries, lifecycle)
                    ↓
              ACP adapter (mock or subprocess) + per-issue workspaces
                    ↓
              React renderer (Dashboard, Board, Agents, Issue, Settings)
```

1. [`WORKFLOW.md`](WORKFLOW.md) is parsed into typed runtime config (`project_id`, poll interval, concurrency, ACP mode, workspace hooks, prompt body).
2. Each **orchestrator tick** selects candidates, dispatches run attempts, polls agent sessions, schedules retries, and reconciles against workflow state.
3. **Workspace manager** creates `<workspace_root>/<issue-identifier>/`, runs hooks, and cleans up terminal issues.
4. **Structured JSON logs** on the main process record dispatch, failures, and workspace events.
5. **Restart recovery** marks stale in-flight runs failed and re-schedules retries on startup.

### SPEC adaptation

[`SPEC.md`](SPEC.md) is the language-agnostic orchestration reference (poll loop, workspaces, hooks, retries). This repo implements the Electron desktop path:

| SPEC concept | This repository |
|--------------|-----------------|
| Issue tracker | Local SQLite via `@symphony/db` |
| Tracker reads / candidate selection | Issue repos + `@symphony/core` orchestrator services |
| Tracker writes (transition, comment, create) | `TrackerService` + `mutateIssue` IPC |
| Agent runtime session | ACP adapter — mock (dev) or subprocess (real CLI) |
| Control plane / server | None — UI-first desktop app only |
| Observability | Electron UI + JSON-line main-process logs |

Historical SPEC sections describing Linear + Codex app-server are design context only, not the active stack.

### Renderer IPC hooks

The desktop renderer never calls `window.symphonyDesktop` directly. All main-process I/O goes through a three-layer stack in `apps/desktop/src/renderer/`:

```
routes / components
       ↓  domain hooks (useRuntimeState, useProjectBoard, useIssue, useSettings, …)
       ↓  generic hooks (useIpcQuery, useIpcMutation)
       ↓  ipc-client → preload → main handlers
```

**Six typed IPC methods** (`apps/desktop/src/ipc.ts`):

| API | Purpose |
|-----|---------|
| `getRuntimeState` | Dashboard, agents — snapshot, queues, metrics |
| `getProjectBoard` | Board — issues grouped by workflow state |
| `getIssue` | Issue detail — metadata, comments, run history |
| `mutateIssue` | Create / update / transition / comment |
| `controlRuntime` | Start, stop, tick, poll interval override |
| `getSettings` | Read-only workflow + ACP config |

See [`apps/desktop/README.md`](apps/desktop/README.md) for setup and desktop-specific layout.

## Task Tracking + Agents

Task data lives in local SQLite via `@symphony/db`. Orchestration in `@symphony/core` drives selection, dispatch, and retries; the desktop main process wires ACP sessions and workspace hooks per issue.

ACP agents run as mock sessions (local dev) or subprocesses (real ACP CLI). See [`connecting-acp-agents.md`](connecting-acp-agents.md) for the subprocess contract, Hermes example, mock mode, and troubleshooting.

## Documentation

| Doc | Contents |
|-----|----------|
| [`SPEC.md`](SPEC.md) | Orchestration concepts and normative design reference |
| [`connecting-acp-agents.md`](connecting-acp-agents.md) | ACP subprocess contract, Hermes, mock mode, troubleshooting |
| [`apps/desktop/README.md`](apps/desktop/README.md) | Desktop setup (`bun install`, `rebuild:native`, `bun run dev`) |
| [`WORKFLOW.md`](WORKFLOW.md) | Default runtime configuration for local dev |

## Running

Configure orchestration via [`WORKFLOW.md`](WORKFLOW.md) at the repo root (`project_id`, poll interval, ACP mode, workspace hooks, agent prompt).

Install:

```bash
bun install
```

Main commands:

```bash
bun run dev
bun run test
bun run check-types
bun run build
bun run test:e2e
```

## Validation Status

The implemented slices include:

- monorepo/tooling baseline
- orchestrator runtime loop + UI controls
- ACP mock + subprocess agent paths
- workflow reload/re-apply
- workspace lifecycle + terminal cleanup
- structured logging
- SQLite-backed issue mutations (transition, comment)
- restart recovery semantics
- executable E2E orchestration scenarios

## License

Apache-2.0 (see `LICENSE`).
