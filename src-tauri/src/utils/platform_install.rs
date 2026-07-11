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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hermes_install_status_matches_binary_probe() {
        let status = install_status(Platform::Hermes);
        assert_eq!(status.platform, "hermes");
        assert_eq!(status.label, "Hermes");
        assert_eq!(status.installed, binary_on_path("hermes"));
        if status.installed {
            assert!(status.missing_binaries.is_empty());
        } else {
            assert_eq!(status.missing_binaries, vec!["hermes"]);
        }
    }

    #[test]
    fn list_install_statuses_covers_all_platforms() {
        let statuses = list_install_statuses();
        assert_eq!(statuses.len(), Platform::ALL.len());
        for platform in Platform::ALL {
            assert!(statuses.iter().any(|status| status.platform == platform.as_str()));
        }
    }
}
