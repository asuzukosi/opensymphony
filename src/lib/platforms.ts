export type PlatformId =
  | "hermes"
  | "openclaw"
  | "claude_code"
  | "codex"
  | "pi"
  | "gemini_cli";

export interface PlatformDefinition {
  id: PlatformId;
  label: string;
  logoPath: string;
  acpCommand: string;
  /** all binaries that must be on path for this platform to be usable */
  installBinaries: readonly string[];
}

export const DEFAULT_PLATFORM: PlatformId = "hermes";

const HERMES: PlatformDefinition = {
  id: "hermes",
  label: "Hermes",
  logoPath: "/images/agents/hermes-logo.png",
  acpCommand: "hermes acp",
  installBinaries: ["hermes"],
};

const OPENCLAW: PlatformDefinition = {
  id: "openclaw",
  label: "OpenClaw",
  logoPath: "/images/agents/openclaw-logo.png",
  acpCommand: "openclaw acp",
  installBinaries: ["openclaw"],
};

const CLAUDE_CODE: PlatformDefinition = {
  id: "claude_code",
  label: "Claude Code",
  logoPath: "/images/agents/claude-logo.png",
  acpCommand: "npx claude-code-acp",
  installBinaries: ["npx", "claude"],
};

const CODEX: PlatformDefinition = {
  id: "codex",
  label: "Codex",
  logoPath: "/images/agents/codex-logo.png",
  acpCommand: "npx -y @agentclientprotocol/codex-acp",
  installBinaries: ["npx", "codex"],
};

const PI: PlatformDefinition = {
  id: "pi",
  label: "Pi",
  logoPath: "/images/agents/pi-logo.png",
  acpCommand: "npx pi-acp",
  installBinaries: ["npx", "pi"],
};

const GEMINI_CLI: PlatformDefinition = {
  id: "gemini_cli",
  label: "Gemini CLI",
  logoPath: "/images/agents/gemini-logo.png",
  acpCommand: "gemini --acp",
  installBinaries: ["gemini"],
};

/** fixed catalog — hermes first for default selection and e2e paths */
export const PLATFORMS: readonly PlatformDefinition[] = [
  HERMES,
  OPENCLAW,
  CLAUDE_CODE,
  CODEX,
  PI,
  GEMINI_CLI,
] as const;

export function getPlatform(id: PlatformId): PlatformDefinition {
  const platform = PLATFORMS.find((entry) => entry.id === id);
  if (platform == null) {
    throw new Error(`unknown platform: ${id}`);
  }
  return platform;
}

export function isPlatformId(value: string): value is PlatformId {
  return PLATFORMS.some((entry) => entry.id === value);
}
