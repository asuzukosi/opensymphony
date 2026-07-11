use crate::types::{Platform, PlatformInstallStatus};

use super::install_check::binary_on_path;

pub fn install_status(platform: Platform) -> PlatformInstallStatus {
    let missing_binaries: Vec<String> = platform
        .install_binaries()
        .iter()
        .filter(|binary| !binary_on_path(binary))
        .map(|binary| (*binary).to_string())
        .collect();

    PlatformInstallStatus {
        platform: platform.as_str().into(),
        label: platform.display_name().into(),
        installed: missing_binaries.is_empty(),
        missing_binaries,
    }
}

pub fn list_install_statuses() -> Vec<PlatformInstallStatus> {
    Platform::ALL
        .into_iter()
        .map(install_status)
        .collect()
}
