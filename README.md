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
| `/` | Dashboard — runtime stats, running/retry panels, activity charts, audit feed |
| `/board` | Kanban — four fixed columns, drag-and-drop, create issue dialog, issue sheet |
| `/issue/[id]` | Issue detail — comments, run history, session timeline, permission panel |
| `/agents` | Agent registry CRUD + project assignment |
| `/settings` | Project settings — general, workflow, prompt template, runtime, permissions |

Shell layout: `src/app/(shell)/layout.tsx` wraps all routes with sidebar nav, project switcher (create/edit projects), and `ActiveProjectProvider`.

### domain hooks

| Hook | Responsibility |
| ---- | -------------- |
| `useProject()` | Project list, active project, create/rename/delete, `setActiveProject` |
| `useRuntime()` | Runtime summary slices + start/stop/tick/poll override + pause/resume/cancel run |
| `useAgentActivity(timeRange)` | Dashboard activity chart buckets |
| `useBoard()` | All board columns, `transitionIssue`, `createIssue` |
| `useIssue(id)` | Issue reads/writes, comments, session events |
| `useIssuePermissions(issueId)` | Pending permissions + resolve (issue page only) |
| `useProjectSettings()` | Narrow project field reads/writes including prompt template |
| `useAgents()` | Agent CRUD + project assign/unassign |

Private IPC primitives: `useIpcQuery`, `useIpcMutation` in `src/lib/ipc/hooks.ts` (not exported from the barrel).

### ui conventions

- Design tokens in `src/app/globals.css` (Roboto sans, Bricolage Grotesque brand, radius/shadow presets)
- Heroicons via `src/components/ui/hero-icons.tsx` — no Lucide in app code
- Permissions UI is scoped to `/issue/[id]` only — no global permission queue in the shell
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

See [docs/connecting-acp-agents.md](docs/connecting-acp-agents.md) for agent setup.

## database

SQLite database opened on app start:

```
{app_data_dir}/symphony.sqlite
```

- schema: `src-tauri/migrations/001_init.sql`
- repos: `src-tauri/src/db/repos/`
- types: `src-tauri/src/types/` (single source of truth for serde shapes)

Run repo tests:

```bash
cd src-tauri && cargo test
```

## ipc commands

Narrow Tauri commands — one read slice or write action per handler. No monolithic `mutate_issue` / `control_runtime` enums.

**62 commands** registered in `src-tauri/src/lib.rs` (28 reads, 32 writes, plus analytics).

| module | reads | writes |
|--------|------:|-------:|
| `commands/board.rs` | 2 | — |
| `commands/issue.rs` | 4 | 6 |
| `commands/permissions.rs` | 1 | 1 |
| `commands/runtime.rs` | 6 | 8 |
| `commands/project.rs` | 11 | 10 |
| `commands/agent.rs` | 3 | 6 |
| `commands/app_state.rs` | 1 | 1 |
| `commands/analytics.rs` | 2 | — |

Channel naming: `opensymphony:<kebab-case-action>` (e.g. `opensymphony:get-board-column`, `opensymphony:create-issue`).

TypeScript mirror:

- `src/lib/ipc/channels.ts` — channel constants
- `src/lib/ipc/types.ts` — request/response types
- `src/lib/ipc/client.ts` — `getIpcClient()` methods

Rust command args use snake_case; the TS client passes camelCase invoke payloads.
