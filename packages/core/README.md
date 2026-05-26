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

- Tracker reads: `DbTrackerAdapter` (issue state categories for reconciliation).
- Tracker writes: `TrackerService` (audit-aware transitions, comments, labels).
- Runtime adapters: selected by desktop ACP config and integrated in `apps/desktop`.

## Tests

- Unit and integration coverage under `packages/core/test`.
- Includes orchestration E2E integration scenarios invoked by Playwright harness.
