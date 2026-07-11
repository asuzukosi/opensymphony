use std::sync::Arc;
use tauri::async_runtime::RuntimeHandle;

use crate::db::Db;

use super::adapter::AcpClientAdapter;
use super::permissions::PermissionGate;

pub struct AcpState {
    pub permission_gate: Arc<PermissionGate>,
}

impl AcpState {
    pub fn new(
        runtime_handle: RuntimeHandle,
        db: Arc<Db>,
    ) -> (Self, Arc<dyn super::types::AcpAdapter>) {
        let permission_gate = Arc::new(PermissionGate::new());
        let adapter: Arc<dyn super::types::AcpAdapter> = Arc::new(AcpClientAdapter::new(
            Arc::clone(&db),
            Arc::clone(&permission_gate),
            runtime_handle,
        ));
        let state = Self { permission_gate };
        (state, adapter)
    }
}
