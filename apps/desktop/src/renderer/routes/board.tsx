import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Kanban } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, cn } from "@symphony/ui";
import { BoardColumns } from "@/renderer/components/board-columns";
import { BoardEmptyState } from "@/renderer/components/board-empty-state";
import { BoardErrorAlert } from "@/renderer/components/board-error-alert";
import { BoardLoadingState } from "@/renderer/components/board-loading-state";
import { CreateIssueDialog } from "@/renderer/components/create-issue-dialog";
import { IssueCard } from "@/renderer/components/issue-card";
import { IssueDetailSheet } from "@/renderer/components/issue-detail-sheet";
import { PageHeader } from "@/renderer/layout/page-header";
import { PageShell } from "@/renderer/layout/page-shell";
import { surfaceAlertClass } from "@/renderer/lib/surface-styles";
import { useMutateIssue, useProjectBoard, useSettings } from "@/renderer/hooks";
import {
  findIssueById,
  findIssueColumn,
  moveIssueBetweenColumns,
  resolveDropTargetStateId,
} from "@/renderer/lib/board-drag-utils";
import { canCreateIssueInColumn } from "@/renderer/lib/board-create-utils";
import type { ProjectBoard, ProjectBoardIssue } from "@/ipc";

type CreateDialogState = {
  stateId: string;
  stateName: string;
};

export function Board(): React.JSX.Element {
  const { board, error: boardError, isLoading, refetch } = useProjectBoard();
  const { settings } = useSettings();
  const { transition, createIssue, isPending, error: mutateError, reset } = useMutateIssue();
  const [optimisticBoard, setOptimisticBoard] = useState<ProjectBoard | null>(null);
  const [activeIssue, setActiveIssue] = useState<ProjectBoardIssue | null>(null);
  const [createDialog, setCreateDialog] = useState<CreateDialogState | null>(null);
  const [sheetIssueId, setSheetIssueId] = useState<string | null>(null);
  const [failedAction, setFailedAction] = useState<"create" | "transition" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    setOptimisticBoard(null);
  }, [board]);

  const displayBoard = optimisticBoard ?? board;
  const columns = displayBoard?.columns ?? [];
  const projectId = settings?.project.id ?? "";
  const isInitialLoading = isLoading && !board;

  const createColumn = useMemo(() => {
    if (!createDialog) {
      return null;
    }
    return columns.find((column) => column.stateId === createDialog.stateId) ?? null;
  }, [columns, createDialog]);

  const handleDragStart = (event: DragStartEvent): void => {
    if (!displayBoard) {
      return;
    }
    const issue = event.active.data.current?.issue as ProjectBoardIssue | undefined;
    setActiveIssue(issue ?? findIssueById(String(event.active.id), displayBoard.columns));
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveIssue(null);
    if (!board || !event.over) {
      return;
    }

    const issueId = String(event.active.id);
    const targetStateId = resolveDropTargetStateId(String(event.over.id), board.columns);
    const sourceStateId = findIssueColumn(issueId, board.columns);

    if (!targetStateId || !sourceStateId || sourceStateId === targetStateId) {
      return;
    }

    setOptimisticBoard(moveIssueBetweenColumns(board, issueId, sourceStateId, targetStateId));
    reset();
    setFailedAction(null);

    try {
      await transition({
        issueId,
        targetStateId,
        actor: "operator",
      });
      await refetch();
    } catch {
      setOptimisticBoard(null);
      setFailedAction("transition");
    }
  };

  const handleCreateIssue = async (input: {
    projectId: string;
    title: string;
    description?: string;
    priority?: number;
    workflowStateId: string;
  }): Promise<void> => {
    reset();
    setFailedAction(null);
    try {
      await createIssue(input);
      await refetch();
    } catch {
      setFailedAction("create");
    }
  };

  if (isInitialLoading) {
    return (
      <PageShell width="full">
        <BoardLoadingState />
      </PageShell>
    );
  }

  if (boardError) {
    return (
      <PageShell>
        <PageHeader
          variant="compact"
          eyebrow="Workflow"
          icon={Kanban}
          title="Task board"
          description="Drag tasks between columns to update workflow state."
        />
        <BoardErrorAlert error={boardError} />
      </PageShell>
    );
  }

  if (!displayBoard || displayBoard.columns.length === 0) {
    return (
      <PageShell>
        <PageHeader
          variant="compact"
          eyebrow="Workflow"
          icon={Kanban}
          title="Task board"
          description="Drag tasks between columns to update workflow state."
        />
        <BoardEmptyState />
      </PageShell>
    );
  }

  return (
    <PageShell width="full" className="min-h-0 flex-1 overflow-hidden">
      <PageHeader
        eyebrow="Workflow"
        icon={Kanban}
        title="Task board"
        description="Drag tasks between columns to update workflow state."
        className="shrink-0"
      />

      {mutateError && failedAction === "transition" ? (
        <Alert variant="destructive" className={cn(surfaceAlertClass, "shrink-0")}>
          <AlertTitle>Task update failed</AlertTitle>
          <AlertDescription>
            {mutateError.message}. Your change was reverted to the last synced board state.
          </AlertDescription>
        </Alert>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <BoardColumns
            columns={displayBoard.columns}
            disabled={isPending}
            onIssueOpen={(issue) => {
              setSheetIssueId(issue.issueId);
            }}
            onAddTask={(stateId, stateName) => {
              const column = displayBoard.columns.find((entry) => entry.stateId === stateId);
              if (!column || !canCreateIssueInColumn(column)) {
                return;
              }
              reset();
              setFailedAction(null);
              setCreateDialog({
                stateId,
                stateName,
              });
            }}
          />
        </div>

        <DragOverlay>
          {activeIssue ? <IssueCard issue={activeIssue} isOverlay disabled={isPending} /> : null}
        </DragOverlay>
      </DndContext>

      {createDialog && projectId ? (
        <CreateIssueDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setCreateDialog(null);
            }
          }}
          projectId={projectId}
          workflowStateId={createDialog.stateId}
          workflowStateName={createColumn?.stateName ?? createDialog.stateName}
          isPending={isPending}
          submitError={failedAction === "create" ? mutateError : null}
          onCreate={handleCreateIssue}
        />
      ) : null}

      <IssueDetailSheet
        issueId={sheetIssueId}
        open={sheetIssueId != null}
        onOpenChange={(open) => {
          if (!open) {
            setSheetIssueId(null);
          }
        }}
      />
    </PageShell>
  );
}
