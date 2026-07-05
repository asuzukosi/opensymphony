# Electron stack (temporary porting guide)

**Temporary.** This tree exists only to guide the Tauri migration. It will be **deleted entirely** once Rust + Next.js parity is confirmed (migration plan t60).

Do not import from here in live code. Do not extend or maintain this tree. Copy patterns into `src/` and `src-tauri/` at the repo root, then remove this folder.

**Not part of the active monorepo workspace.** Root `bun install` does not link these packages. Not built in CI.

## Layout

```
reference/electron-stack/
  apps/desktop/       # Electron shell + React/Vite renderer
  packages/core/      # TS orchestration services
  packages/db/        # SQLite migrations + repos
```

The live app uses `src/` (Next.js + all UI components) and `src-tauri/` (Rust) at the repo root.

## Port mapping

| Reference | Live (Tauri) |
|-----------|--------------|
| `apps/desktop/src/renderer/` | `src/app/`, `src/components/`, `src/hooks/` |
| `apps/desktop/src/runtime/` + `packages/core/` | `src-tauri/src/` |
| `packages/db/migrations/` | `src-tauri/migrations/` |

## End state

After t60, this directory does not exist. The repo ships only the Tauri app.
