import type { IssueDetail } from "@/ipc";
import { useIpcQuery } from "./use-ipc-query";

export type UseIssueOptions = {
  issueId: string | null;
  attemptLimit?: number;
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseIssueResult = {
  issue: IssueDetail | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
};

const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_ATTEMPT_LIMIT = 20;

export function useIssue(options: UseIssueOptions): UseIssueResult {
  const {
    issueId,
    attemptLimit = DEFAULT_ATTEMPT_LIMIT,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    enabled = true,
  } = options;

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<IssueDetail>(
    `issue:${issueId ?? "none"}:${attemptLimit}`,
    (client) => client.getIssue(issueId as string, attemptLimit),
    { pollIntervalMs, enabled: enabled && issueId != null },
  );

  return {
    issue: data,
    error,
    isLoading,
    isRefreshing,
    refetch,
  };
}
