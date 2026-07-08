# Connecting ACP agents

OpenSymphony runs agent sessions over the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/) using the Rust SDK [`agent-client-protocol`](https://github.com/agentclientprotocol/rust-sdk). The Tauri backend owns the runtime in `src-tauri/src/acp/`.

## Agent command configuration

Each agent row stores an optional `acp_command` string (stdio transport URI). Configure it via IPC:

- `opensymphony:set-agent-acp-command` — set or clear the command for an agent
- `opensymphony:create-agent` — optional `acpCommand` on create

Example command values:

```text
opensymphony-mock-acp-agent
/path/to/your-agent --flag value
```

The adapter parses stdio commands with `AcpClientConfig::from_acp_command`. Non-stdio transports are rejected.

**Note:** `AcpState` currently uses the mock agent as a dev default until Lane 3 dispatch wires project/agent config into `start_session`.

## Mock agent (local development)

The workspace crate `src-tauri/mock-acp-agent/` exposes a stdio mock process:

```bash
cd src-tauri
cargo run -p opensymphony-mock-acp-agent
```

Happy-path behavior:

1. `initialize` → accept client capabilities
2. `session/new` → return a session id
3. `session/prompt` → stream message chunks, a demo tool call, and a final message (`demo acp agent: done`)
4. `session/cancel` notification → mark session cancelled; prompt returns `Cancelled` stop reason

### Environment variables

| Variable | Effect |
| -------- | ------ |
| `SYMPHONY_MOCK_PERMISSION=1` | Mock sends a `RequestPermission` during prompt instead of streaming updates |
| `SYMPHONY_RUN_ATTEMPT_ID` | Passed to spawned agent subprocess (set by adapter) |
| `SYMPHONY_ISSUE_ID` | Passed to spawned agent subprocess |
| `SYMPHONY_ATTEMPT_NUMBER` | Passed to spawned agent subprocess |
| `SYMPHONY_WORKSPACE_PATH` | Workspace directory for the session |

## Permission modes

Project `permission_mode` controls how tool permission requests are handled:

| Mode | Behavior |
| ---- | -------- |
| `autoApprove` | Adapter approves immediately; no pending row |
| `requiresApproval` | Row inserted in `pending_permissions`; agent blocks until resolve |

When approval is required:

1. Agent sends `RequestPermission` → adapter persists `PermissionRequest` session event and enqueues DB row
2. UI reads pending rows via `opensymphony:list-issue-pending-permissions`
3. User resolves via `opensymphony:resolve-session-permission` with `approve` or `deny`
4. Resolve order: `PermissionGate::resolve` unblocks the agent handler first, then the DB row is deleted

Pause/resume during a run is orchestrator-owned (`PauseGate` injected at dispatch), not on the adapter trait.

## Client identity

Initialize handshake uses OpenSymphony defaults from `src-tauri/src/acp/protocol.rs`:

- Client name: `opensymphony`
- Client version: `0.1.0`

## Further reading

- [ACP protocol specification](https://agentclientprotocol.com/)
- [Rust SDK repository](https://github.com/agentclientprotocol/rust-sdk)
- OpenSymphony implementation: `src-tauri/src/acp/adapter.rs`, `client.rs`, `permissions.rs`
