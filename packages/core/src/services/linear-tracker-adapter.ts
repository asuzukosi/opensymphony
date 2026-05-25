import type { TrackerAdapter, TrackerIssueSnapshot } from "@core/types/tracker-adapter";

export interface LinearTrackerAdapterOptions {
  apiUrl: string;
  tokenEnvVar: string;
  teamId: string;
}

export class LinearTrackerAdapter implements TrackerAdapter {
  constructor(private readonly options: LinearTrackerAdapterOptions) {}

  listCandidateIssues(_projectId: string, _categories: string[]): TrackerIssueSnapshot[] {
    throw new Error(
      `Linear tracker adapter is configured but not wired in this runtime yet (teamId=${this.options.teamId})`,
    );
  }

  getIssueStateCategories(_issueIds: string[]): Record<string, string> {
    throw new Error("Linear tracker adapter state read is not wired yet");
  }

  transitionIssue(_issueId: string, _targetStateId: string, _actor?: string): void {
    throw new Error("Linear tracker adapter transition is not wired yet");
  }

  addIssueComment(_issueId: string, _body: string, _authorId?: string): void {
    throw new Error("Linear tracker adapter comment write is not wired yet");
  }
}
