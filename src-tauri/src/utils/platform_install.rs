use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

use crate::types::{Platform, PlatformInstallStatus};

use super::install_check::binary_on_path;

const OPENCLAW_GATEWAY_ADDR: &str = "127.0.0.1:18789";

pub fn install_status(platform: Platform) -> PlatformInstallStatus {
    let mut missing_binaries: Vec<String> = platform
        .install_binaries()
        .iter()
        .filter(|binary| !binary_on_path(binary))
        .map(|binary| (*binary).to_string())
        .collect();

    if platform == Platform::OpenClaw && missing_binaries.is_empty() && !openclaw_gateway_running() {
        missing_binaries.push("openclaw gateway (run: openclaw gateway)".into());
    }

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

fn openclaw_gateway_running() -> bool {
    let Ok(addr) = OPENCLAW_GATEWAY_ADDR.parse::<SocketAddr>() else {
        return false;
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openclaw_install_status_includes_gateway_requirement() {
        let status = install_status(Platform::OpenClaw);
        if status.installed {
            assert!(openclaw_gateway_running());
            return;
        }
        assert!(!status.missing_binaries.is_empty());
    }
}
