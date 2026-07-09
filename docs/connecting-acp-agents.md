# connecting acp agents

OpenSymphony dispatches work to agents over the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/) via stdio. Each agent registered in the app has an **ACP command** — the shell command used to spawn the agent process.

Register agents on the **Agents** page, assign them to a project, then ensure the command is on your `PATH` when running the Tauri app.

## how it works

1. The orchestrator selects a backlog/in-progress issue and picks an assigned agent.
2. OpenSymphony spawns the agent using the stored ACP command.
3. The agent speaks JSON-RPC over stdin/stdout; logs should go to stderr.
4. Session events and permission requests are recorded in the local database.
5. Pending permissions are resolved on the issue detail page.

The ACP command field accepts:

- A binary name on `PATH` (e.g. `opensymphony-mock-acp-agent`)
- A full path to an executable
- An ACP agent descriptor string parsed by the official SDK (stdio transport only)

## bundled mock agent

Use this for local development without external credentials.

**ACP command:**

```text
opensymphony-mock-acp-agent
```

Build and install from the repo:

```bash
cd src-tauri
cargo build -p opensymphony-mock-acp-agent
```

Ensure the binary is on your `PATH`, or use the absolute path to `target/debug/opensymphony-mock-acp-agent`.

**Permission mock:** set `SYMPHONY_MOCK_PERMISSION=1` in the agent environment to exercise the permission queue with a "Run tests" prompt.

**Verify:**

```bash
opensymphony-mock-acp-agent
# process waits on stdio — Ctrl+C to exit
```

## hermes agent

[Hermes Agent](https://hermes-agent.nousresearch.com/) runs as an ACP server over stdio when the ACP extra is installed.

**Install:**

```bash
pip install 'hermes-agent[acp]'
```

**Configure credentials** (required before dispatch):

```bash
hermes model
```

Or set provider keys in `~/.hermes/.env` / `~/.hermes/config.yaml`.

**ACP command for OpenSymphony:**

```text
hermes acp
```

Alternatives that start the same adapter:

```text
hermes-acp
python -m acp_adapter
```

**Notes:**

- Hermes reserves stdout for ACP traffic; human-readable logs go to stderr.
- First-run setup can use `hermes acp --setup` for interactive provider configuration.
- Verify before registering: `hermes acp --version`

**Docs:** [Hermes ACP editor integration](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp)

## codex (openai)

OpenAI Codex can run as an ACP-compatible agent when using a build that exposes the ACP stdio entry point.

**Typical ACP command** (adjust to your install):

```text
codex acp
```

If your install uses a different subcommand or wrapper, use whatever spawns the Codex ACP stdio server. Confirm with your Codex CLI documentation or `codex --help`.

**Notes:**

- Ensure API credentials are configured in the environment Codex expects.
- The exact binary name may differ by install method (npm global, bundled app, etc.).

## claude code

Anthropic Claude Code integrations that speak ACP over stdio can be registered the same way.

**Typical pattern:**

```text
claude acp
```

Use the subcommand your Claude Code build documents for ACP stdio mode. If unavailable, check for a dedicated ACP wrapper script in your install.

**Notes:**

- Credentials are usually managed by the Claude Code CLI (`claude auth` or equivalent).
- stdout must remain protocol-clean.

## cursor / other acp agents

Any editor or runtime that ships an ACP stdio server can be registered if it:

1. Speaks ACP on stdin/stdout
2. Can be launched as a single shell command
3. Does not require interactive TTY on stdio

**Steps:**

1. Open **Agents** → **Add agent**
2. Set **Name** to something recognizable (e.g. "Cursor worker")
3. Set **ACP command** to the documented stdio launch command
4. Assign the agent to your project on the Agents page

## troubleshooting

| Symptom | Check |
| ------- | ----- |
| Dispatch fails immediately | Command on `PATH`? Run it manually in a terminal. |
| No session events | Agent writing logs to stdout instead of stderr. |
| Permissions never appear | Project permission mode is `autoApprove`, or agent did not emit a permission request. |
| Agent starts but hangs | Missing API keys or provider config for that agent. |

## prompt template

Project prompt templates (Settings → Prompt) support:

- `{{identifier}}` — issue identifier
- `{{title}}` — issue title
- `{{description}}` — issue description (empty string if none)

The rendered prompt is sent when a run session starts.
