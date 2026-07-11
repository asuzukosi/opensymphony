//! pause gate contract injected into agent sessions by the orchestrator.

use std::future::Future;
use std::pin::Pin;

pub trait PauseGate: Send + Sync {
    fn is_paused(&self) -> bool;
    fn wait_if_paused(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn pause(&self);
    fn resume(&self);
}
