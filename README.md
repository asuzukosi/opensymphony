# OpenSymphony: Manage work not prompts for your agents

Open Symphony is a desktop platform that allows you orchestrate complex work projects between your agents. It allows you to build "loop engineering" pipelines around your agents.

Define projets and tasks and assign it to your agents, review task progress and completion. Add verification loop around tasks and let your agents learn from the task trajectory, allowing your agents to continually improve as they work.

Open Symphony handles the complexity of agent orchstration for you - dispatch, progress management, task retries, permission management and context sandboxing.

Connect to all the agent platforms without any additional configuraiton, full support for popular harnesses such as:
- Hermes
- OpenClaw
- Codex
- Claude Code
- Antigravity
- OpenCode (coming soon)
- Pi (coming soon)
- Your custom harness!

Create a project, assign the agent platforms you already use, drop work on a board, and Open Symphony dispatches, retries, and tracks sessions for you.

## Download the prebuilt binary

Prebuilt installers are published on [GitHub Releases](https://github.com/asuzukosi/opensymphony/releases). No Rust, Bun, or Node install is required to run the app.

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/asuzukosi/opensymphony/main/scripts/install.sh | bash
```

The script downloads the matching installer for your machine from the latest release.

### Windows

Download the `.exe` installer from the [latest release](https://github.com/asuzukosi/opensymphony/releases/latest) and run it.

### Manual download

| Platform | Asset |
| -------- | ----- |
| macOS (Apple Silicon) | `*_aarch64.dmg` |
| macOS (Intel) | `*_x64.dmg` |
| Linux | `*.AppImage` |
| Windows | `*-setup.exe` |

## Build it yourself

Use this path if you are contributing, hacking on the app, or want to compile from source. You only get a binary for the OS you build on.

### Requirements

- [Bun](https://bun.sh) `1.3.8+`
- [Rust](https://rustup.rs) stable
- Linux only: WebView system packages (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`)

### Setup and run

```bash
bun install
bun run dev        # desktop app
bun run dev:web    # frontend only on http://127.0.0.1:3000
```

### Production build (current OS)

```bash
bun run build
```

Artifacts are written under `src-tauri/target/release/bundle/` (`.dmg` / `.AppImage` / `.exe` depending on your host).

### Publish installers for all platforms

Pushing a version tag runs the GitHub Actions release workflow, which builds macOS, Linux, and Windows installers and attaches them to a draft release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

You can also run the **release** workflow manually from the Actions tab.

## What you get

- **Board** — backlog → in progress → review → done, with drag-and-drop
- **Dashboard** — live sessions, retry queue, activity, recently finished
- **Projects** — workspace folder, concurrency, retries, and prompt template
- **Task detail** — comments, session timeline, permissions, run history

## Agent platforms

Open Symphony talks to agent CLIs you install yourself. Platforms that are not on your `PATH` stay disabled until you install them.

| Platform | Needs on PATH |
| -------- | ------------- |
| Hermes | `hermes` |
| OpenClaw | `openclaw`, `node` |
| Claude Code | `npx`, `claude` |
| Codex | `npx`, `codex` |
| Pi | `npx`, `pi` |
| Antigravity | `npx`, `agy` |

Hermes is the default for new projects when installed.

## Quick start

1. Install Open Symphony (prebuilt or from source)
2. Install at least one agent CLI and confirm it in **Settings → Platforms**
3. Create a project — pick platforms, workspace folder, and concurrency
4. Open the board, create a backlog task, and set an executor
5. The orchestrator wakes, dispatches work, and surfaces sessions on the dashboard
