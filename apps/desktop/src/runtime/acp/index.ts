import type { ACPConfig } from "@symphony/core";
import type { AppendSessionEventInput } from "@symphony/db";
import { createACPClientAdapter } from "@/runtime/acp/acp-client-adapter";
import type { PermissionRouter } from "@/runtime/acp/permission-router";
import type { ACPAdapter } from "@/runtime/acp/types";

export type { ACPAdapter, StartRuntimeSessionInput } from "@/runtime/acp/types";

export interface CreateACPAdapterDependencies {
  getPermissionRouter: () => PermissionRouter;
  appendSessionEvent?: (input: AppendSessionEventInput) => void;
}

export function createACPAdapter(
  config: ACPConfig,
  deps?: CreateACPAdapterDependencies,
): ACPAdapter {
  if (!deps) {
    throw new Error("ACP client adapter requires permission router dependencies");
  }

  return createACPClientAdapter(config, deps);
}
