# @symphony/core

Domain and orchestration layer for Symphony.

## Core Services

- `WorkflowLoaderService`: parses `WORKFLOW.md` front matter + prompt body.
- `RuntimeConfigService`: typed config with defaults.
- `OrchestratorService`: dispatch/retry/reconcile loop logic.
- `RunLifecycleService`: run + agent session transitions.
- `RestartRecoveryService`: stale in-flight recovery on startup.
- `WorkspaceManagerService`: per-issue workspace + hook execution.
- `StructuredLoggerService`: JSON-line event logging.

## Adapter Boundaries

- Tracker adapters:
- `DbTrackerAdapter`
- `LinearTrackerAdapter` (shape/stub)
- `createTrackerAdapter(...)` provider factory.

- Runtime adapters are selected by desktop runtime config and integrated in `apps/desktop`.

## Tests

- Unit and integration coverage under `packages/core/test`.
- Includes orchestration E2E integration scenarios invoked by Playwright harness.
