# Symphony (TypeScript Monorepo)

This repository contains a Bun + Turbo + TypeScript implementation of Symphony in a React + Electron format.

## Current Scope

- UI-first desktop orchestration runtime (Electron main + renderer).
- No non-UI control plane/server in this implementation.
- Pluggable tracker adapter boundary (`db` active, `linear` interface shape present).
- Agent runtime adapter boundary (`mock-acp`, `acp-cli`).

## Monorepo Layout

- `apps/desktop`: Electron app shell, orchestration runtime loop, IPC, React UI routes.
- `packages/core`: orchestration domain/services (config parsing, selection, retries, lifecycle, adapters, logging, restart recovery).
- `packages/db`: SQLite schema/migrations + repository/store layer.
- `packages/ui`: shared UI primitives and styles used by desktop renderer.
- `tests/e2e`: Playwright harness for end-to-end acceptance checks.

## Architecture Summary

1. `WORKFLOW.md` is parsed into typed runtime config.
2. Runtime config selects:
- tracker provider (`db` or `linear`)
- runtime adapter (`mock-acp` or `acp-cli`)
- workspace/hook behavior
3. Orchestrator tick performs:
- candidate selection
- bounded dispatch
- run/session lifecycle updates
- retry scheduling/backoff
- reconciliation against tracker state
4. Workspace manager applies hooks:
- `after_create`
- `before_agent_run`
- `after_run`
- `before_remove`
5. Structured logger emits JSON-line events for runtime operations.
6. Restart recovery marks stale in-flight runs as failed and schedules retries on startup.

## Tracker Adapter Model

Tracker access is behind a provider boundary in `@symphony/core`:

- `DbTrackerAdapter`: active local provider used in current runtime.
- `LinearTrackerAdapter`: provider interface shape for Linear-backed integration (not yet wired to live API calls in this repo).

All orchestrator read/write interactions flow through this adapter boundary.

## Running

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
- runtime adapter selection + `acp-cli` subprocess path
- workflow reload/re-apply
- workspace lifecycle + terminal cleanup
- structured logging
- first-class tracker write APIs
- restart recovery semantics
- executable E2E orchestration scenarios

## License

Apache-2.0 (see `LICENSE`).
