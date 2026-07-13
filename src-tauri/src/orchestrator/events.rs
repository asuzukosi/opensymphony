//! orchestrator event channel for acp session completion.

use tokio::sync::mpsc;

use crate::acp::types::RuntimeSessionRecord;

const EVENT_CHANNEL_CAPACITY: usize = 256;

#[derive(Debug, Clone)]
pub enum OrchestratorEvent {
    SessionTerminal {
        project_id: String,
        record: RuntimeSessionRecord,
    },
}

#[derive(Clone)]
pub struct OrchestratorEventSender(mpsc::Sender<OrchestratorEvent>);

impl OrchestratorEventSender {
    pub fn send(&self, event: OrchestratorEvent) {
        if let Err(err) = self.0.try_send(event) {
            log::warn!("orchestrator event send failed: {err}");
        }
    }
}

pub fn orchestrator_event_channel() -> (OrchestratorEventSender, mpsc::Receiver<OrchestratorEvent>) {
    let (tx, rx) = mpsc::channel(EVENT_CHANNEL_CAPACITY);
    (OrchestratorEventSender(tx), rx)
}
