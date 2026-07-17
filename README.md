# opensymphony

Tauri desktop app for agent orchestration. Next.js frontend in `src/`, Rust backend in `src-tauri/`.

## development

```bash
bun install
bun run dev:web   # next.js on http://127.0.0.1:3000
bun run dev       # tauri window
bun run build     # production bundle
bun run check-types
bun run lint
```

## frontend

Next.js App Router UI in `src/`. Pages use domain hooks over Tauri IPC — do not call `getIpcClient()` directly from route or feature components.

### routes

| Route | Purpose |
| ----- | ------- |
| `/` | Dashboard — running/retry panels, activity charts, recent finished |
| `/board` | Kanban — four fixed columns, drag-and-drop, create task dialog, task detail sheet |
| `/settings` | Settings — platform install status and active project runtime |

Shell layout: `src/app/(shell)/layout.tsx` wraps all routes with sidebar nav, project switcher (create/edit projects), `ActiveProjectProvider`, and a URL-driven task sheet (`?task=` via `TaskSheetHost`).

### domain hooks

| Hook | Responsibility |
| ---- | -------------- |
| `useProject()` | Project list, active project, create/rename/delete, `setActiveProject` |
| `useRuntime({ projectId?, enabled? })` | Dashboard activity panels (running, retry, finished) |
| `useAgentActivity(timeRange, { projectId? })` | Dashboard agent activity buckets; omit `projectId` for cross-project |
| `useBoard()` | All board columns, `transitionTask`, `createTask` |
| `useTask({ taskId, enabled? })` | Task sheet reads/writes, comments, session events, auto-approve permissions |
| `useTaskPermissions(taskId)` | Pending permissions + resolve (task sheet only) |
| `useProjectSettings()` | Active project runtime settings |
| `usePlatformStatuses()` | Global platform install status (Settings) |
| `useProjectPlatforms(projectId)` | Platforms assigned to a project (task picker) |

Private IPC primitives: `useIpcQuery`, `useIpcMutation` in `src/lib/ipc/hooks.ts` (not exported from the barrel).

### ui conventions

- Design tokens in `src/app/globals.css` (Roboto sans, Bricolage Grotesque brand, radius/shadow presets)
- Heroicons via `src/components/ui/hero-icons.tsx` — no Lucide in app code
- Permissions UI is scoped to the task detail sheet only — no global permission queue in the shell
- Run controls (pause/resume/cancel) live on the dashboard running sessions table

### layout

```
src/
  app/(shell)/          # routed pages
  components/           # feature + layout + ui (shadcn)
  contexts/             # active project provider
  hooks/                # domain hooks
  lib/ipc/              # channels, types, client, hooks
```

## platforms

Six supported agent platforms are defined in `src/lib/platforms.ts` (Rust mirror: `src-tauri/src/types/platforms.rs`). Hermes is the default for new projects and the first e2e path.

| Platform | ACP command | Required binaries |
| -------- | ----------- | ----------------- |
| Hermes | `hermes acp` | `hermes` |
| OpenClaw | `openclaw acp` | `openclaw` |
| Claude Code | `npx claude-code-acp` | `npx`, `claude` |
| Codex | `npx -y @agentclientprotocol/codex-acp` | `npx`, `codex` |
| Pi | `npx pi-acp` | `npx`, `pi` |
| Antigravity | `sh -c 'export AGY_BIN="$(which agy)" && exec npx antigravity-acp'` | `npx`, `agy` |

**Install check:** on startup and in Settings → Platforms, the app checks whether each platform's required binaries are on `PATH`. Uninstalled platforms are grayed out and not selectable in pickers. Project create rejects any selected platform that is not installed.

**No connect/disconnect flow:** platforms are assigned to a project at create time only. Dispatch spawns the platform's ACP command directly — there is no separate agent registry or connection step. Install the CLI, assign the platform when creating a project, set a task executor, and create backlog work. The orchestrator wakes automatically when a project has work (backlog, running attempts, or scheduled retries).

### hermes setup

Install the Hermes CLI so `hermes` is on `PATH`, then verify in Settings → Platforms. Create a project with Hermes assigned, set Hermes as the task executor, and add a backlog task — the orchestrator starts automatically.

## orchestrator

Per-project runtime in `src-tauri/src/orchestrator/`. Event-driven dispatch with a fixed 30s watchdog for safety sweeps.

**Wake:** task create, column → backlog, executor set, session finish (when retry scheduled), retry timer fire, max concurrency increase.

**Sleep:** when a project has no backlog, no running attempts, and no retry queue rows — watchdog stops and `orchestrator_status` becomes `idle`.

**Event triggers (immediate):**

| Event | Action |
| ----- | ------ |
| Work added | wake runtime + dispatch |
| Session terminal (ACP channel) | sync outcome + fill slots + maybe sleep |
| Column → review/done | reconcile (cancel ACP + retry) + maybe sleep |
| Column → done | remove per-task workspace immediately |

**Watchdog (30s):** reconcile out-of-scope attempts, sweep orphan sessions, dispatch due retries, fill slots, cleanup done workspaces, maybe sleep.

**Startup:** `hydrate_from_db` wakes projects with any work and heals stale `orchestrator_status = running` when idle.

## project creation

Open the project switcher → **New project**. All configuration is set at create time; workspace folder and isolation flags are not editable in Settings afterward.

| Field | Notes |
| ----- | ----- |
| Name | Required |
| Assign to (platforms) | Multi-select from installed platforms; Hermes pre-selected when installed; min 1 |
| Workspace folder | Native folder picker (`@tauri-apps/plugin-dialog`); source repo agents work from |
| Per-task workspaces | Default on — each task gets an isolated sandbox under app data |
| Use worktrees | Only when per-task workspaces is on; uses `git worktree` instead of directory copy |
| Prompt template | Monaco editor; must include `{{identifier}}`, `{{title}}`, `{{description}}` |
| Max concurrency | Default 5 |
| Retry max / backoff | Default 3 attempts, 30000 ms backoff |

## workspace modes

Set at project create only (`use_per_task_workspaces`, `use_worktrees` in the DB).

**Per-task workspaces (default):** first dispatch for a task materializes `{app_data}/workspaces/{project_id}/{task_id}/`. ACP sessions use that path as `cwd`. Subsequent dispatches for the same task reuse the existing sandbox. When the task reaches **done**, the sandbox is removed.

| `use_worktrees` | Materialization |
| --------------- | --------------- |
| Off (default) | Recursive copy of `workspace_root` into the sandbox on first use |
| On | `git worktree add` at the sandbox path — requires `git` on PATH, `git worktree` support, and a git-initialized `workspace_root` |

**Shared root (`use_per_task_workspaces = false`):** all tasks use `projects.workspace_root` directly. No sandbox dirs are created or cleaned up. Concurrent tasks may modify the same files.

## Tasks

**Executor:** each task optionally picks one platform from the project's assigned set (create dialog or task metadata). Tasks without an executor are skipped by dispatch. Only installed platforms are offered.

**Auto-approve permissions:** per-task boolean (`tasks.auto_approve_permissions`). When enabled, ACP permission requests for that task are approved immediately with no pending queue. When disabled, pending requests appear in the task detail sheet; resolve via the permissions panel. There is no project-level permission mode.

## database

SQLite database opened on app start:

```
{app_data_dir}/opensymphony.sqlite
```

macOS example: `~/Library/Application Support/com.opensymphony.desktop/opensymphony.sqlite`

- schema: `src-tauri/migrations/001_init.sql` (edit in place — no migration 002)
- after a schema pull, delete the local sqlite file and restart the app
- repos: `src-tauri/src/db/repos/`
- types: `src-tauri/src/types/` (single source of truth for serde shapes)

Run repo tests:

```bash
cd src-tauri && cargo test
```

## ipc commands

Narrow Tauri commands — one read slice or write action per handler.

Channel naming: `opensymphony:<kebab-case-action>` (e.g. `opensymphony:list-project-tasks`, `opensymphony:create-task`).

TypeScript mirror:

- `src/lib/ipc/channels.ts` — channel constants
- `src/lib/ipc/types.ts` — request/response types
- `src/lib/ipc/client.ts` — `getIpcClient()` methods

Rust command args use snake_case; the TS client passes camelCase invoke payloads.
