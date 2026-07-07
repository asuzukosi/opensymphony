use std::future::Future;
use std::pin::Pin;

/// in-process pause gate contract.
pub trait PauseGate: Send + Sync {
    fn is_paused(&self) -> bool;
    fn wait_if_paused(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn pause(&self);
    fn resume(&self);
}
