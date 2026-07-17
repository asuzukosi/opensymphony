//! ipc and domain types — single source of truth for repos and tauri commands.
//! split into submodules; all public items re-exported here for `crate::types::*` compatibility.

mod platforms;
mod analytics;
mod board;
mod comment;
mod task;
mod permission;
mod project;
mod retry;
mod runtime;
mod session;

pub use platforms::*;
pub use analytics::*;
pub use board::*;
pub use comment::*;
pub use task::*;
pub use permission::*;
pub use project::*;
pub use retry::*;
pub use runtime::*;
pub use session::*;
