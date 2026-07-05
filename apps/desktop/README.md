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
- ACP agent execution via JSON-RPC client (`ACPClientAdapter`) — spawns a configured ACP server on stdio per issue workspace.
- Startup stale-run recovery and terminal workspace cleanup.

## Architecture

### Process layout

| Layer | Location | Role |
|-------|----------|------|
| Main | `src/main.ts`, `src/orchestrator-runtime.ts` | Electron bootstrap, SQLite, orchestrator tick loop, IPC handlers |
| Preload | `src/preload.ts` | Exposes `window.symphonyDesktop` (`SymphonyDesktopApi`) |
| Renderer | `src/renderer/` | React routes, shadcn UI, IPC hooks (no direct `window` access) |

Orchestration domain logic lives in `@symphony/core` and `@symphony/db`; the main process hosts the tick loop, ACP adapter (`src/runtime/acp/`), and workspace manager.

### Renderer IPC hooks

Components import **domain hooks only** (`apps/desktop/src/renderer/hooks/`):

```
routes / components
       ↓  useRuntimeState, useProjectBoard, useIssue, useMutateIssue, useRuntimeControls, useSettings
       ↓  useIpcQuery, useIpcMutation
       ↓  getIpcClient() in renderer/lib/ipc-client.ts
       ↓  preload → ipcMain handlers → orchestrator-runtime
```

Do not call `window.symphonyDesktop` outside `ipc-client.ts`. A boundary test enforces this (`test/renderer-ipc-boundary.test.ts`).

### IPC surface (6 channels)

Defined in [`src/ipc.ts`](src/ipc.ts):

| Method | Domain hook(s) | Used by |
|--------|----------------|---------|
| `getRuntimeState` | `useRuntimeState` | Dashboard, Agents |
| `getProjectBoard` | `useProjectBoard` | Board |
| `getIssue` | `useIssue` | Issue detail |
| `mutateIssue` | `useMutateIssue` | Board, Issue detail |
| `controlRuntime` | `useRuntimeControls` | Settings, Agents |
| `getSettings` | `useSettings` | Settings |

Writes return updated runtime state where applicable; reads support optional polling via `useIpcQuery`.

### Related docs

- [`docs/connecting-acp-agents.md`](../../docs/connecting-acp-agents.md) — ACP client architecture, Hermes, demo server, troubleshooting
- [`WORKFLOW.md`](../../WORKFLOW.md) — default runtime config

## Setup

Run these steps from the **repository root** unless noted.

### Prerequisites

- [Bun](https://bun.sh) (see `packageManager` in the root `package.json`)
- Node.js toolchain pulled in by Bun for Electron/Vite
- macOS, Linux, or Windows with build tools available for native modules (`better-sqlite3`)

### 1. Install dependencies

```bash
bun install
```

This installs workspace packages (`@symphony/core`, `@symphony/db`, `@symphony/ui`, `@symphony/desktop`) and Electron dev dependencies.

### 2. Rebuild native modules for Electron

The desktop app uses `better-sqlite3`, which must be compiled for Electron’s Node ABI:

```bash
cd apps/desktop
bun run rebuild:native
```

Or from the repo root (same effect — `dev` runs this automatically):

```bash
bun run --filter @symphony/desktop rebuild:native
```

Re-run `rebuild:native` after upgrading Electron, switching machines, or if startup fails with errors mentioning `better-sqlite3`, `NODE_MODULE_VERSION`, or “was compiled against a different Node.js version”.

**Monorepo note:** `better-sqlite3` is hoisted to the repo root `node_modules/`. The rebuild command must target that path (`-m ../..` from this package). Running `electron-rebuild -m .` here is a no-op and leaves the binary compiled for system Node (115) while Electron needs 136.

Electron dev and Vitest both share the same native binary, so only one ABI is active at a time:

| Goal | Command (from repo root) |
|------|--------------------------|
| Run the desktop app | `bun run rebuild:electron` then `bun run dev` |
| Run tests that touch SQLite | `bun run rebuild:node` then `bun run test` |

`bun run dev` already runs `rebuild:native` before launching Electron.

### 3. Configure orchestration

Default config lives at [`WORKFLOW.md`](../../WORKFLOW.md) in the repo root. The checked-in default uses the demo ACP server for local development (`node` + absolute path to `scripts/demo-acp-server.mjs`). Replace the path with your clone location before dispatching runs.

To use a different file:

```bash
export SYMPHONY_WORKFLOW_PATH=/absolute/path/to/WORKFLOW.md
```

For production Hermes, swap the `acp` block to `command: hermes`, `args: ["acp"]` — see [`docs/connecting-acp-agents.md`](../../docs/connecting-acp-agents.md).

### 4. Start the desktop app

From the repo root:

```bash
bun run dev
```

This runs Turbo `dev` for the monorepo, which executes `@symphony/desktop`’s script: `rebuild:native` → Vite renderer on `http://127.0.0.1:5173` → Electron main process.

From `apps/desktop` only:

```bash
bun run dev
```

Renderer-only (no Electron shell):

```bash
cd apps/desktop
bun run dev:web
```

### 5. First run in the UI

1. Open **Settings** → **Start runtime** (or use **Run tick** on **Agents**).
2. Confirm **Configuration** shows your workflow path and ACP mode.
3. Use **Board** to create/move tasks; **Agents** and **Dashboard** show dispatch state.

SQLite data is stored under the Electron user data directory for the app.

### Other commands

From repo root:

```bash
bun run check-types
bun run test
bun run build
```

Desktop package only:

```bash
cd apps/desktop
bun run test
bun run build
```

