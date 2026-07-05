import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { IssueCommentsSection } from "@/renderer/components/issue-comments-section";
import { IssueDetailHeader } from "@/renderer/components/issue-detail-header";
import { IssueErrorAlert } from "@/renderer/components/issue-error-alert";
import { IssueLoadingState } from "@/renderer/components/issue-loading-state";
import { IssueMetadata } from "@/renderer/components/issue-metadata";
import { IssueNotFoundState } from "@/renderer/components/issue-not-found-state";
import { IssueRunHistoryTable } from "@/renderer/components/issue-run-history-table";
import { AgentRunControls } from "@/renderer/components/agent-run-controls";
import { PageShell } from "@/renderer/layout/page-shell";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import { useIssue, useMutateIssue, useProjectBoard, useRuntimeControls, useRuntimeState } from "@/renderer/hooks";
import { doneWorkflowStateId } from "@/lib/issue-review-status";
import type { SessionEvent } from "@/ipc";

function sortSessionEvents(events: SessionEvent[]): SessionEvent[] {
  return [...events].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return left.createdAt.localeCompare(right.createdAt);
    }
    return rightTime - leftTime;
  });
}

function collectSessionEvents(
  attempts: Array<{ sessions: Array<{ events: SessionEvent[] }> }>,
): SessionEvent[] {
  return sortSessionEvents(
    attempts.flatMap((attempt) => attempt.sessions.flatMap((session) => session.events)),
  );
}

function isIssueNotFoundError(error: Error): boolean {
  return error.message.includes("issue not found");
}

export function Issue(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const issueId = id ?? null;
  const { issue, error, isLoading, refetch } = useIssue({ issueId });
  const { board } = useProjectBoard({ enabled: issueId != null });
  const { snapshot, refetch: refetchRuntime } = useRuntimeState({ enabled: issueId != null });
  const {
    pauseRun,
    resumeRun,
    cancelRun,
    isPending: isRunControlPending,
    reset: resetRunControl,
  } = useRuntimeControls();
  const {
    addComment,
    transition,
    isPending: isMutatePending,
    error: mutateError,
    reset: resetMutate,
  } = useMutateIssue();
  const [failedAction, setFailedAction] = useState<"comment" | "transition" | null>(null);
  const isInitialLoading = isLoading && !issue;

  const workflowStates = useMemo(
    () =>
      board?.columns.map((column) => ({
        stateId: column.stateId,
        stateName: column.stateName,
      })) ?? [],
    [board],
  );
  const sessionEvents = useMemo(
    () => collectSessionEvents(issue?.attempts ?? []),
    [issue?.attempts],
  );
  const runningEntry = useMemo(
    () => snapshot?.running.find((entry) => entry.issueId === issue?.issueId) ?? null,
    [issue?.issueId, snapshot?.running],
  );

  const handleRunControl = async (
    action: (runAttemptId: string) => Promise<unknown>,
    runAttemptId: string,
  ): Promise<void> => {
    resetRunControl();
    try {
      await action(runAttemptId);
      await Promise.all([refetch(), refetchRuntime()]);
    } catch {
      // surfaced by runtime controls hook where wired
    }
  };

  const handleAddComment = async (body: string): Promise<void> => {
    if (!issue) {
      return;
    }

    resetMutate();
    setFailedAction(null);
    try {
      await addComment({
        issueId: issue.issueId,
        body,
      });
      await refetch();
    } catch {
      setFailedAction("comment");
    }
  };

  const handleStateChange = async (targetStateId: string): Promise<void> => {
    if (!issue || targetStateId === issue.workflowStateId) {
      return;
    }

    resetMutate();
    setFailedAction(null);
    try {
      await transition({
        issueId: issue.issueId,
        targetStateId,
      });
      await refetch();
    } catch {
      setFailedAction("transition");
    }
  };

  const handleApprove = async (): Promise<void> => {
    if (!issue) {
      return;
    }

    await handleStateChange(doneWorkflowStateId(issue.projectId));
  };

  if (!issueId) {
    return (
      <PageShell>
        <IssueNotFoundState issueId="unknown" />
      </PageShell>
    );
  }

  if (isInitialLoading) {
    return (
      <PageShell>
        <IssueLoadingState />
      </PageShell>
    );
  }

  if (!issue) {
    if (error && isIssueNotFoundError(error)) {
      return (
        <PageShell>
          <IssueNotFoundState issueId={issueId} />
        </PageShell>
      );
    }

    return (
      <PageShell>
        <IssueNotFoundState issueId={issueId} />
        {error ? <IssueErrorAlert error={error} /> : null}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <IssueDetailHeader
        issue={issue}
        workflowStates={workflowStates}
        onStateChange={handleStateChange}
        onApprove={handleApprove}
        isTransitionPending={isMutatePending}
        transitionError={failedAction === "transition" ? mutateError : null}
      />
      {error ? <IssueErrorAlert error={error} /> : null}
      {runningEntry ? (
        <SurfaceCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Agent run in progress</p>
              <p className="text-sm text-muted-foreground">
                Attempt {runningEntry.attemptNumber}
                {runningEntry.paused ? " · paused" : ""}
              </p>
            </div>
            <AgentRunControls
              runAttemptId={runningEntry.runAttemptId}
              paused={runningEntry.paused}
              disabled={isRunControlPending || isMutatePending}
              onPause={(runAttemptId) => handleRunControl(pauseRun, runAttemptId)}
              onResume={(runAttemptId) => handleRunControl(resumeRun, runAttemptId)}
              onCancel={(runAttemptId) => handleRunControl(cancelRun, runAttemptId)}
            />
          </div>
        </SurfaceCard>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <IssueMetadata issue={issue} />
          <IssueCommentsSection
            comments={issue.comments}
            onAddComment={handleAddComment}
            isPending={isMutatePending}
            submitError={failedAction === "comment" ? mutateError : null}
          />
        </div>
        <div className="lg:col-span-1">
          <IssueRunHistoryTable
            attempts={issue.attempts}
            sessionEvents={sessionEvents}
            isLoading={isLoading}
          />
        </div>
      </div>
    </PageShell>
  );
}
