import type { RuntimeAdapterConfig } from "@symphony/core";
import type { AgentRuntimeAdapter } from "@/runtime/agent-runtime-adapter";
import { MockAcpRuntimeAdapter } from "@/runtime/mock-acp-runtime-adapter";
import { AcpCliRuntimeAdapter } from "@/runtime/acp-cli-runtime-adapter";

export function createRuntimeAdapter(config: RuntimeAdapterConfig): AgentRuntimeAdapter {
  if (config.kind === "acp-cli") {
    return new AcpCliRuntimeAdapter({
      command: config.acpCliCommand,
      args: config.acpCliArgs,
    });
  }

  return new MockAcpRuntimeAdapter(config.completionDelayMs);
}
