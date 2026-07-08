//! in-process pause gate trait and a no-op stub for tests.
//!//! the orchestrator creates one gate per session, injects it into
//! `acp::StartRuntimeSessionInput::pause_gate`, and drives pause/resume via
//! `pause_run` / `resume_run` ipc — not through the acp adapter.

use std::future::{ready, Future};
use std::pin::Pin;

/// in-process pause gate contract.
pub trait PauseGate: Send + Sync {
    fn is_paused(&self) -> bool;
    fn wait_if_paused(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn pause(&self);
    fn resume(&self);
}

#[derive(Debug, Default, Clone, Copy)]
pub struct NoOpPauseGate; // no-op pause gate for tests i.e mock implementation

impl PauseGate for NoOpPauseGate {
    fn is_paused(&self) -> bool {
        false
    }

    fn wait_if_paused(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(ready(()))
    }

    fn pause(&self) {}
    fn resume(&self) {}
}

#[cfg(test)]
mod tests {
    use super::NoOpPauseGate;
    use super::PauseGate;

    #[tokio::test]
    async fn no_op_pause_gate_never_blocks() {
        let gate = NoOpPauseGate;
        gate.pause();
        assert!(!gate.is_paused());
        gate.wait_if_paused().await;
        gate.resume();
    }
}
