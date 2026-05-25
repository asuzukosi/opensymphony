# @symphony/desktop

Electron desktop runtime and React renderer for Symphony.

## Responsibilities

- Boots Electron main process and secure preload bridge.
- Hosts orchestration runtime tick loop.
- Exposes typed IPC for orchestration status/control and tracker write operations.
- Renders Dashboard/Issues/Settings views.

## Key Runtime Capabilities

- Start/stop/manual tick controls.
- Poll interval override + persistence.
- Workflow config hot-reload (path/version/reload timestamp surfaced in snapshot).
- Runtime adapter execution:
- `mock-acp`
- `acp-cli` subprocess sessions
- Startup stale-run recovery and terminal workspace cleanup.

## IPC Surface (high level)

- Snapshot/status/queue inspection.
- Runtime control (`start`, `stop`, `tick`, poll interval set/reset).
- Audit and issue run history fetch.
- Tracker writes: issue transition + issue comment add.

## Run

From repo root:

```bash
bun run dev
```
