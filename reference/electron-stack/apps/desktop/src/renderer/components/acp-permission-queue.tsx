import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  cn,
} from "@symphony/ui";
import type { PendingPermission, PermissionDecision } from "@/ipc";

type ACPPermissionQueueProps = {
  permissions: PendingPermission[];
  onResolve: (id: string, decision: PermissionDecision) => Promise<void>;
  isPending?: boolean;
  resolvingId?: string | null;
  submitError?: Error | null;
  className?: string;
};

function formatCreatedAt(createdAt: string): string {
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) {
    return createdAt;
  }
  return new Date(parsed).toLocaleString();
}

function truncateSessionId(sessionId: string): string {
  if (sessionId.length <= 12) {
    return sessionId;
  }
  return `${sessionId.slice(0, 8)}...${sessionId.slice(-4)}`;
}

type PermissionQueueItemProps = {
  permission: PendingPermission;
  onResolve: (id: string, decision: PermissionDecision) => Promise<void>;
  isPending: boolean;
  resolvingId: string | null;
};

function PermissionQueueItem({
  permission,
  onResolve,
  isPending,
  resolvingId,
}: PermissionQueueItemProps): React.JSX.Element {
  const isResolving = isPending && resolvingId === permission.id;

  return (
    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{permission.summary}</p>
            <Badge variant="outline">Awaiting decision</Badge>
          </div>
          <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="sr-only">Issue</dt>
              <dd>
                Issue{" "}
                <Link
                  to={`/issues/${permission.issueId}`}
                  className="font-mono text-foreground hover:text-primary hover:underline"
                >
                  {permission.issueId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="sr-only">Session</dt>
              <dd>
                Session{" "}
                <span className="font-mono text-foreground">
                  {truncateSessionId(permission.sessionId)}
                </span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="sr-only">Requested at</dt>
              <dd>Requested {formatCreatedAt(permission.createdAt)}</dd>
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
            {isResolving ? "Approving..." : "Approve"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => void onResolve(permission.id, "deny")}
          >
            Deny
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ACPPermissionQueue({
  permissions,
  onResolve,
  isPending = false,
  resolvingId = null,
  submitError = null,
  className,
}: ACPPermissionQueueProps): React.JSX.Element | null {
  if (permissions.length === 0) {
    return null;
  }

  return (
    <Alert className={cn("border-amber-500/40 bg-amber-500/5", className)}>
      <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-950 dark:text-amber-100">
        Pending agent permissions ({permissions.length})
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-muted-foreground">
          Agents are blocked until you approve or deny each ACP permission request.
        </p>
        <div className="space-y-2">
          {permissions.map((permission) => (
            <PermissionQueueItem
              key={permission.id}
              permission={permission}
              onResolve={onResolve}
              isPending={isPending}
              resolvingId={resolvingId}
            />
          ))}
        </div>
        {submitError ? (
          <p className="text-sm text-destructive">Permission decision failed: {submitError.message}</p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
