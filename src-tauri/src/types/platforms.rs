use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInstallStatus {
    pub platform: String,
    pub label: String,
    pub installed: bool,
    pub missing_binaries: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Platform {
    Hermes,
    OpenClaw,
    ClaudeCode,
    Codex,
    Pi,
    Antigravity,
}

impl Platform {
    pub const ALL: [Self; 6] = [
        Self::Hermes,
        Self::OpenClaw,
        Self::ClaudeCode,
        Self::Codex,
        Self::Pi,
        Self::Antigravity,
    ];

    pub fn display_name(self) -> &'static str {
        match self {
            Self::Hermes => "Hermes",
            Self::OpenClaw => "OpenClaw",
            Self::ClaudeCode => "Claude Code",
            Self::Codex => "Codex",
            Self::Pi => "Pi",
            Self::Antigravity => "Antigravity",
        }
    }

    pub fn acp_command(self) -> &'static str {
        match self {
            Self::Hermes => "hermes acp",
            Self::OpenClaw => "openclaw acp",
            Self::ClaudeCode => "npx claude-code-acp",
            Self::Codex => "npx -y @agentclientprotocol/codex-acp",
            Self::Pi => "npx pi-acp",
            Self::Antigravity => "sh -c 'export AGY_BIN=\"$(which agy)\" && exec npx antigravity-acp'",
        }
    }

    pub fn install_binaries(self) -> &'static [&'static str] {
        match self {
            Self::Hermes => &["hermes"],
            Self::OpenClaw => &["openclaw", "node"],
            Self::ClaudeCode => &["npx", "claude"],
            Self::Codex => &["npx", "codex"],
            Self::Pi => &["npx", "pi"],
            Self::Antigravity => &["npx", "agy"],
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Hermes => "hermes",
            Self::OpenClaw => "openclaw",
            Self::ClaudeCode => "claude_code",
            Self::Codex => "codex",
            Self::Pi => "pi",
            Self::Antigravity => "antigravity",
        }
    }
}

impl fmt::Display for Platform {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for Platform {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "hermes" => Ok(Self::Hermes),
            "openclaw" => Ok(Self::OpenClaw),
            "claude_code" => Ok(Self::ClaudeCode),
            "codex" => Ok(Self::Codex),
            "pi" => Ok(Self::Pi),
            "antigravity" => Ok(Self::Antigravity),
            other => Err(format!("unknown platform: {other}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::adapter::AcpClientConfig;

    #[test]
    fn all_platforms_resolve_to_acp_config() {
        for platform in Platform::ALL {
            AcpClientConfig::from_acp_command(platform.acp_command())
                .unwrap_or_else(|err| panic!("{} failed: {err}", platform.as_str()));
        }
    }
}
