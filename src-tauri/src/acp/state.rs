use std::sync::Arc;
use tauri::async_runtime::RuntimeHandle;

pub struct AcpClientAdapter;
pub struct PermissionStore;
pub struct PermissionRouter;

pub struct AcpState {
    pub runtime_handle: RuntimeHandle,
    pub adapter: Arc<AcpClientAdapter>,
    pub permission_store: Arc<PermissionStore>,
    pub permission_router: Arc<PermissionRouter>,
}

impl AcpState {
    pub fn new(runtime_handle: RuntimeHandle) -> Self {
        Self {
            runtime_handle,
            adapter: Arc::new(AcpClientAdapter),
            permission_store: Arc::new(PermissionStore),
            permission_router: Arc::new(PermissionRouter),
        }
    }
}
