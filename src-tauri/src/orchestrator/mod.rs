pub(crate) mod events;
mod manager;
mod pause;
mod poll;
pub(crate) mod runtime_events;
pub(crate) mod workspace;

/// fixed watchdog interval for orphan detection and safety sweeps (not user-configurable)
pub(crate) const WATCHDOG_INTERVAL_MS: u32 = 30_000;

pub use manager::Manager;
