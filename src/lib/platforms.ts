export type PlatformId =
  | "hermes"
  | "openclaw"
  | "claude_code"
  | "codex"
  | "pi"
  | "antigravity";

export interface PlatformDefinition {
  id: PlatformId;
  label: string;
  logoPath: string;
  acpCommand: string;
  /** all binaries that must be on path for this platform to be usable */
  installBinaries: readonly string[];
  /** optional note shown in settings when extra runtime setup is required */
  runtimeNote?: string;
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
  installBinaries: ["openclaw", "node"],
  runtimeNote: "Requires the OpenClaw gateway on 127.0.0.1:18789 (run: openclaw gateway).",
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

const ANTIGRAVITY: PlatformDefinition = {
  id: "antigravity",
  label: "Antigravity",
  logoPath: "/images/agents/antigravity-logo.png",
  acpCommand: 'sh -c \'export AGY_BIN="$(which agy)" && exec npx antigravity-acp\'',
  installBinaries: ["npx", "agy"],
};

/** fixed catalog — hermes first for default selection and e2e paths */
export const PLATFORMS: readonly PlatformDefinition[] = [
  HERMES,
  OPENCLAW,
  CLAUDE_CODE,
  CODEX,
  PI,
  ANTIGRAVITY,
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

export function resolvePlatformInstalled(
  platformId: PlatformId,
  isPlatformInstalled: ((id: PlatformId) => boolean) | undefined,
  statusesLoading: boolean,
): boolean {
  if (statusesLoading || isPlatformInstalled == null) {
    return true;
  }
  return isPlatformInstalled(platformId);
}
