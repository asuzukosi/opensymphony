use std::process::Command;
use std::sync::OnceLock;

/// gui apps on macos/linux often inherit a minimal path. resolve the user's shell path once.
fn user_path() -> &'static str {
    static PATH: OnceLock<String> = OnceLock::new();
    PATH.get_or_init(|| {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        Command::new(&shell)
            .arg("-ilc")
            .arg("echo -n $PATH")
            .output()
            .ok()
            .filter(|output| output.status.success())
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .filter(|path| !path.is_empty())
            .unwrap_or_else(|| std::env::var("PATH").unwrap_or_default())
    })
}

pub fn user_path_for_spawn() -> &'static str {
    user_path()
}

pub fn binary_on_path(name: &str) -> bool {
    binary_path(name).is_some()
}

pub fn binary_path(name: &str) -> Option<String> {
    if cfg!(windows) {
        Command::new("where")
            .arg(name)
            .output()
            .ok()
            .filter(|output| output.status.success())
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .and_then(|output| output.lines().next().map(str::trim).filter(|line| !line.is_empty()).map(str::to_string))
    } else {
        Command::new("sh")
            .env("PATH", user_path())
            .arg("-c")
            .arg(format!("command -v {name}"))
            .output()
            .ok()
            .filter(|output| output.status.success())
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|output| output.trim().to_string())
            .filter(|path| !path.is_empty())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_binary_is_not_on_path() {
        assert!(!binary_on_path("opensymphony-definitely-missing-binary"));
    }

    #[test]
    fn sh_is_on_path() {
        assert!(binary_on_path("sh"));
    }

    #[test]
    fn binary_path_resolves_sh() {
        let path = binary_path("sh").expect("sh path");
        assert!(!path.is_empty());
    }
}
