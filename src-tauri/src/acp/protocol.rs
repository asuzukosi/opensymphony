//! opensymphony defaults for acp initialize handshake.

use agent_client_protocol::schema::{
    ClientCapabilities, Implementation, InitializeRequest, ProtocolVersion,
};

pub const OPENSYMPHONY_CLIENT_NAME: &str = "opensymphony";
pub const OPENSYMPHONY_CLIENT_VERSION: &str = "0.1.0";

pub fn opensymphony_client_info() -> Implementation {
    Implementation::new(OPENSYMPHONY_CLIENT_NAME, OPENSYMPHONY_CLIENT_VERSION)
}

pub fn default_opensymphony_client_capabilities() -> ClientCapabilities {
    ClientCapabilities::default()
}

pub fn default_initialize_request() -> InitializeRequest {
    InitializeRequest::new(ProtocolVersion::LATEST)
        .client_info(opensymphony_client_info())
        .client_capabilities(default_opensymphony_client_capabilities())
}
