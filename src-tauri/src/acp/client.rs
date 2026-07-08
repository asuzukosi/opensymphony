//! connect to an acp agent with opensymphony client handlers.

use std::sync::Arc;

use agent_client_protocol::schema::{
    RequestPermissionRequest, RequestPermissionResponse, SessionNotification,
};
use agent_client_protocol::{Agent, Client, ConnectTo, ConnectionTo, Error, Responder, Result};

use super::permissions::RequestPermissionFn;
use super::protocol::OPENSYMPHONY_CLIENT_NAME;

pub async fn connect(
    transport: impl ConnectTo<Client>,
    on_session_update: Arc<dyn Fn(SessionNotification) + Send + Sync>,
    on_request_permission: RequestPermissionFn,
    run: impl AsyncFnOnce(ConnectionTo<Agent>) -> Result<(), Error>,
) -> Result<(), Error> {
    Client
        .builder()
        .name(OPENSYMPHONY_CLIENT_NAME)
        .on_receive_notification(
            move |notification: SessionNotification, _cx| {
                let on_session_update = Arc::clone(&on_session_update);
                async move {
                    on_session_update(notification);
                    Ok(())
                }
            },
            agent_client_protocol::on_receive_notification!(),
        )
        .on_receive_request(
            move |request: RequestPermissionRequest,
                  responder: Responder<RequestPermissionResponse>,
                  _connection| {
                let on_request_permission = Arc::clone(&on_request_permission);
                async move {
                    let response = on_request_permission(request).await;
                    responder.respond(response)
                }
            },
            agent_client_protocol::on_receive_request!(),
        )
        .connect_with(transport, run)
        .await
}
