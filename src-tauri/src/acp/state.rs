use std::sync::Arc;
use tauri::async_runtime::RuntimeHandle;

use crate::db::Db;

use super::adapter::{AcpClientAdapter, AcpClientConfig};
use super::permissions::PermissionGate;

pub struct AcpState {
    pub runtime_handle: RuntimeHandle,
    pub db: Arc<Db>,
    pub adapter: Arc<AcpClientAdapter>,
    pub permission_gate: Arc<PermissionGate>,
}

impl AcpState {
    pub fn new(runtime_handle: RuntimeHandle, db: Arc<Db>) -> Self {
        let permission_gate = Arc::new(PermissionGate::new(Arc::clone(&db)));
        Self {
            runtime_handle: runtime_handle.clone(),
            db: Arc::clone(&db),
            adapter: Arc::new(AcpClientAdapter::new(
                AcpClientConfig::dev_default(),
                db,
                Arc::clone(&permission_gate),
                runtime_handle,
            )),
            permission_gate,
        }
    }
}
