# @symphony/desktop

Electron desktop runtime and React renderer for Symphony.

## Responsibilities

- Boots Electron main process and secure preload bridge.
- Hosts orchestration runtime tick loop against local SQLite task data.
- Exposes typed IPC for runtime state, controls, and issue mutations.
- Renders Dashboard, Board, Agents, Issue detail, and Settings views.

## Key Runtime Capabilities

- Start/stop/manual tick controls.
- Poll interval override + persistence.
- Workflow config hot-reload (path/version/reload timestamp surfaced in snapshot).
- ACP agent execution:
  - mock mode for local development
  - subprocess mode for real ACP CLI agents
- Startup stale-run recovery and terminal workspace cleanup.

## IPC Surface (high level)

- Snapshot/status/queue inspection.
- Runtime control (`start`, `stop`, `tick`, poll interval set/reset).
- Audit and issue run history fetch.
- Issue mutations: state transition + comment add (SQLite-backed).

## Run

From repo root:

```bash
bun run dev
```
