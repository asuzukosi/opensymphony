"use client";

import { ShieldExclamationIcon } from "@/components/ui/hero-icons";
import { useMemo, useState } from "react";

import { IssueErrorAlert } from "@/components/issue/issue-states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ACTIVE_PERMISSION_POLL_INTERVAL_MS,
  useIssuePermissions,
} from "@/hooks/use-issue-permissions";
import { formatDateTime } from "@/lib/datetime";
import { DEFAULT_IPC_POLL_INTERVAL_MS } from "@/lib/ipc/hooks";
import type { IssueDetailRunAttempt, PendingPermission, PermissionDecision } from "@/lib/ipc/types";
import { cn, wrapText } from "@/lib/utils";

type IssuePermissionsPanelProps = {
  issueId: string;
  attempts: IssueDetailRunAttempt[];
};

function truncateSessionId(sessionId: string): string {
  if (sessionId.length <= 12) {
    return sessionId;
  }
  return `${sessionId.slice(0, 8)}...${sessionId.slice(-4)}`;
}

function issueHasActiveSession(attempts: IssueDetailRunAttempt[]): boolean {
  return attempts.some((attempt) => attempt.finishedAt == null);
}

type PermissionItemProps = {
  permission: PendingPermission;
  onResolve: (id: string, decision: PermissionDecision) => Promise<void>;
  isPending: boolean;
  resolvingId: string | null;
  resolvingDecision: PermissionDecision | null;
};

function PermissionItem({
  permission,
  onResolve,
  isPending,
  resolvingId,
  resolvingDecision,
}: PermissionItemProps) {
  const isResolving = isPending && resolvingId === permission.id;

  return (
    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className={cn("text-xs font-medium", wrapText)}>{permission.summary}</p>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Awaiting decision
            </Badge>
          </div>
          <dl className={cn("grid gap-1 text-[10px] text-muted-foreground sm:grid-cols-2", wrapText)}>
            <div className="sm:col-span-2">
              <dt className="sr-only">Session</dt>
              <dd>
                Session{" "}
                <span className="font-mono text-foreground">{truncateSessionId(permission.sessionId)}</span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="sr-only">Requested at</dt>
              <dd>Requested {formatDateTime(permission.createdAt)}</dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => void onResolve(permission.id, "approve")}
          >
            {isResolving && resolvingDecision === "approve" ? "Approving..." : "Approve"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => void onResolve(permission.id, "deny")}
          >
            {isResolving && resolvingDecision === "deny" ? "Denying..." : "Deny"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function IssuePermissionsPanel({ issueId, attempts }: IssuePermissionsPanelProps) {
  const hasActiveSession = useMemo(() => issueHasActiveSession(attempts), [attempts]);
  const pollIntervalMs = hasActiveSession
    ? ACTIVE_PERMISSION_POLL_INTERVAL_MS
    : DEFAULT_IPC_POLL_INTERVAL_MS;

  const {
    permissions,
    error,
    isLoading,
    resolvePermission,
    isResolving,
    resolveError,
    resetResolve,
  } = useIssuePermissions({ issueId, pollIntervalMs });

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvingDecision, setResolvingDecision] = useState<PermissionDecision | null>(null);
  const [failedResolve, setFailedResolve] = useState(false);

  const handleResolve = async (permissionId: string, decision: PermissionDecision): Promise<void> => {
    resetResolve();
    setFailedResolve(false);
    setResolvingId(permissionId);
    setResolvingDecision(decision);

    try {
      await resolvePermission(permissionId, decision);
    } catch {
      setFailedResolve(true);
    } finally {
      setResolvingId(null);
      setResolvingDecision(null);
    }
  };

  if (error) {
    return <IssueErrorAlert error={error} />;
  }

  if (isLoading && permissions === undefined) {
    return null;
  }

  if (!permissions || permissions.length === 0) {
    return null;
  }

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5 text-xs">
      <ShieldExclamationIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-950 dark:text-amber-100">
        Pending agent permissions ({permissions.length})
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-muted-foreground">
          Agents are blocked until you approve or deny each permission request for this issue.
        </p>
        <div className="space-y-2">
          {permissions.map((permission) => (
            <PermissionItem
              key={permission.id}
              permission={permission}
              onResolve={handleResolve}
              isPending={isResolving}
              resolvingId={resolvingId}
              resolvingDecision={resolvingDecision}
            />
          ))}
        </div>
        {failedResolve && resolveError ? (
          <p className={cn("text-xs text-destructive", wrapText)}>
            Permission decision failed: {resolveError.message}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
