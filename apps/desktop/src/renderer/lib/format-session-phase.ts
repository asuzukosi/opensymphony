import type { RuntimeSessionPhase } from "@/ipc";

export function formatSessionPhase(phase: RuntimeSessionPhase | null): string {
  if (!phase) {
    return "pending";
  }
  return phase.replace(/_/g, " ");
}
