//!
//! orchestrator responsibilities:
//! - create one gate per dispatched session
//! - store `session_id -> Arc<SessionPauseGate>` for lookup
//! - wire `pause_run` / `resume_run` ipc to `gate.pause()` / `gate.resume()`
//! - pass `Arc<dyn PauseGate>` into `acp::StartRuntimeSessionInput` at dispatch
//!
//! see `crate::runtime::PauseGate` for the trait contract and `NoOpPauseGate` for tests.
