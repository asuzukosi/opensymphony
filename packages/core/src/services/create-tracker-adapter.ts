import type { ITrackerStore } from "@symphony/db";
import { DbTrackerAdapter } from "@core/services/db-tracker-adapter";
import { LinearTrackerAdapter } from "@core/services/linear-tracker-adapter";
import type { TrackerAdapter } from "@core/types/tracker-adapter";
import type { RuntimeConfig } from "@core/types/workflow";

export function createTrackerAdapter(store: ITrackerStore, config: RuntimeConfig): TrackerAdapter {
  if (config.tracker.kind === "linear") {
    return new LinearTrackerAdapter({
      apiUrl: config.tracker.linearApiUrl,
      tokenEnvVar: config.tracker.linearTokenEnvVar,
      teamId: config.tracker.linearTeamId,
    });
  }

  return new DbTrackerAdapter(store);
}
