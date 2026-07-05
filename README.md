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
