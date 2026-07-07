# opensymphony

Tauri desktop app for agent orchestration. Next.js frontend in `src/`, Rust backend in `src-tauri/`.

## development

```bash
bun install
bun run dev:web   # next.js on http://127.0.0.1:3000
bun run dev       # tauri window
bun run build     # production bundle
```

The Electron-era codebase lives temporarily in `reference/electron-stack/` as a porting guide and is deleted after migration.

## database

SQLite database opened on app start:

```
{app_data_dir}/opensymphony.sqlite
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

**60 commands** registered in `src-tauri/src/lib.rs` (28 reads, 32 writes).

| module | reads | writes |
|--------|------:|-------:|
| `commands/board.rs` | 2 | — |
| `commands/issue.rs` | 4 | 6 |
| `commands/permissions.rs` | 1 | 1 |
| `commands/runtime.rs` | 6 | 8 |
| `commands/project.rs` | 11 | 10 |
| `commands/agent.rs` | 3 | 6 |
| `commands/app_state.rs` | 1 | 1 |

Channel naming: `opensymphony:<kebab-case-action>` (e.g. `opensymphony:get-board-column`, `opensymphony:create-issue`).

TypeScript mirror:

- `src/lib/ipc/channels.ts` — channel constants
- `src/lib/ipc/types.ts` — request/response types
- `src/lib/ipc/client.ts` — `getIpcClient()` methods

Rust command args use snake_case; the TS client passes camelCase invoke payloads.
