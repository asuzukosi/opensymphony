//! ipc and domain types — single source of truth for repos and tauri commands.
//! split into submodules; all public items re-exported here for `crate::types::*` compatibility.

mod agent;
mod platforms;
mod analytics;
mod audit;
mod board;
mod comment;
mod issue;
mod permission;
mod project;
mod retry;
mod runtime;
mod session;

pub use agent::*;
pub use platforms::*;
pub use analytics::*;
pub use audit::*;
pub use board::*;
pub use comment::*;
pub use issue::*;
pub use permission::*;
pub use project::*;
pub use retry::*;
pub use runtime::*;
pub use session::*;
