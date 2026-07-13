"use client";

import { useEffect, useState } from "react";

import type { ProjectSummary } from "@/lib/ipc/types";
import { listenRuntimeEvents } from "@/lib/runtime-events";

export function useOrchestratorStatus(
  projectId: string | null | undefined,
  activeProject: ProjectSummary | undefined,
): string | undefined {
  const [status, setStatus] = useState<string | undefined>(activeProject?.orchestratorStatus);

  useEffect(() => {
    setStatus(activeProject?.orchestratorStatus);
  }, [activeProject?.orchestratorStatus, projectId]);

  useEffect(() => {
    if (projectId == null) {
      return;
    }

    let unlisten: (() => void) | undefined;

    void listenRuntimeEvents(projectId, {
      onOrchestratorStatus: (nextStatus) => {
        setStatus(nextStatus);
      },
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => {
      unlisten?.();
    };
  }, [projectId]);

  return status;
}
