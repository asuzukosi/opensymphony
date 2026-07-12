"use client";

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
import { useCallback, useEffect, useMemo, useState } from "react";

import { BoardColumns, type BoardColumnMeta } from "@/components/board/board-columns";
import { CreateIssueDialog } from "@/components/board/create-issue-dialog";
import { IssueCard } from "@/components/board/issue-card";
import { BoardIcon, BadgeCheckIcon, ClockIcon, PlayCircleIcon, PlusIcon, StopCircleIcon } from "@/components/ui/hero-icons";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActiveProject } from "@/contexts/active-project-context";
import { useIssueSheet } from "@/contexts/issue-sheet-context";
import { useBoard, type CreateIssueInput } from "@/hooks/use-board";
import {
  findIssueById,
  findIssueColumn,
  moveIssueBetweenColumns,
  resolveDropTargetColumnId,
} from "@/lib/board-drag-utils";
import { DEFAULT_IPC_POLL_INTERVAL_MS, useIpcQuery } from "@/lib/ipc/hooks";
import {
  type BoardColumnId,
  type ProjectBoard,
  type ProjectBoardIssue,
  type RuntimeStatus,
} from "@/lib/ipc/types";

function formatOrchestratorStatus(status: string): string {
  return status.replace(/_/g, " ");
}

function isRuntimeStatus(status: string): status is RuntimeStatus {
  return status === "idle" || status === "running" || status === "stopped";
}

function OrchestratorStatusBadge({ status }: { status: string }) {
  const normalizedStatus = isRuntimeStatus(status) ? status : "idle";
  const label = formatOrchestratorStatus(normalizedStatus);

  if (normalizedStatus === "running") {
    return (
      <Badge variant="default" className="shrink-0 font-normal capitalize">
        <PlayCircleIcon data-icon="inline-start" />
        {label}
      </Badge>
    );
  }

  if (normalizedStatus === "stopped") {
    return (
      <Badge variant="secondary" className="shrink-0 font-normal capitalize">
        <StopCircleIcon data-icon="inline-start" />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="shrink-0 font-normal capitalize">
      <ClockIcon data-icon="inline-start" />
      {label}
    </Badge>
  );
}

function buildSyncedBoard(
  issuesByColumn: Record<BoardColumnId, ProjectBoardIssue[] | undefined>,
): ProjectBoard {
  return {
    backlog: { issues: issuesByColumn.backlog ?? [] },
    inProgress: { issues: issuesByColumn.inProgress ?? [] },
    review: { issues: issuesByColumn.review ?? [] },
    done: { issues: issuesByColumn.done ?? [] },
  };
}

function countBoardIssues(board: ProjectBoard): { total: number; done: number } {
  const columns = [board.backlog, board.inProgress, board.review, board.done];
  const total = columns.reduce((sum, column) => sum + column.issues.length, 0);
  return { total, done: board.done.issues.length };
}

function BoardDnDContent() {
  const { projectId } = useActiveProject();
  const board = useBoard();

  const syncedBoard = useMemo(
    () => buildSyncedBoard(board.issuesByColumn),
    [board.issuesByColumn],
  );

  const [optimisticBoard, setOptimisticBoard] = useState<ProjectBoard | null>(null);
  const [activeIssue, setActiveIssue] = useState<ProjectBoardIssue | null>(null);
  const [failedTransition, setFailedTransition] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [failedCreate, setFailedCreate] = useState(false);
  const { openIssueSheet } = useIssueSheet();

  useEffect(() => {
    setOptimisticBoard(null);
  }, [
    board.issuesByColumn.backlog,
    board.issuesByColumn.inProgress,
    board.issuesByColumn.review,
    board.issuesByColumn.done,
  ]);

  const displayBoard = optimisticBoard ?? syncedBoard;

  const columnMeta = useMemo((): Record<BoardColumnId, BoardColumnMeta> => {
    const meta = { isLoading: board.isLoading, error: board.error };
    return {
      backlog: meta,
      inProgress: meta,
      review: meta,
      done: meta,
    };
  }, [board.error, board.isLoading]);

  const getColumnIssues = useCallback(
    (columnId: BoardColumnId): ProjectBoardIssue[] | undefined => {
      if (optimisticBoard) {
        return optimisticBoard[columnId].issues;
      }
      return board.issuesByColumn[columnId];
    },
    [board.issuesByColumn, optimisticBoard],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = (event: DragStartEvent): void => {
    const issue = event.active.data.current?.issue as ProjectBoardIssue | undefined;
    setActiveIssue(issue ?? findIssueById(String(event.active.id), displayBoard));
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveIssue(null);

    if (!event.over) {
      return;
    }

    const issueId = String(event.active.id);
    const targetColumn = resolveDropTargetColumnId(String(event.over.id), syncedBoard);
    const sourceColumn = findIssueColumn(issueId, syncedBoard);

    if (!targetColumn || !sourceColumn || targetColumn === sourceColumn) {
      return;
    }

    setOptimisticBoard(
      moveIssueBetweenColumns(syncedBoard, issueId, sourceColumn, targetColumn),
    );
    board.resetTransition();
    setFailedTransition(false);

    try {
      await board.transitionIssue(issueId, targetColumn, "operator");
      setOptimisticBoard(null);
    } catch {
      setOptimisticBoard(null);
      setFailedTransition(true);
    }
  };

  const handleCreateIssue = async (input: CreateIssueInput): Promise<void> => {
    board.resetCreate();
    setFailedCreate(false);

    try {
      await board.createIssue(input);
    } catch (error) {
      setFailedCreate(true);
      throw error;
    }
  };

  const isMutating = board.isTransitioning || board.isCreating;
  const { total, done } = useMemo(() => countBoardIssues(displayBoard), [displayBoard]);

  const openCreateDialog = (): void => {
    board.resetCreate();
    setFailedCreate(false);
    setCreateDialogOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="shrink-0 font-normal">
            <BoardIcon data-icon="inline-start" />
            Total: {total}
          </Badge>
          <Badge variant="outline" className="shrink-0 font-normal">
            Done: {done}
            <BadgeCheckIcon data-icon="inline-end" />
          </Badge>
        </div>
        <Button type="button" size="sm" className="gap-2" disabled={isMutating} onClick={openCreateDialog}>
          <PlusIcon className="size-4" />
          Add task
        </Button>
      </div>

      {failedTransition && board.transitionError ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>Task update failed</AlertTitle>
          <AlertDescription>
            {board.transitionError.message}. Your change was reverted to the last synced board state.
          </AlertDescription>
        </Alert>
      ) : null}

      {failedCreate && board.createError ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>Task creation failed</AlertTitle>
          <AlertDescription>{board.createError.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={(event) => void handleDragEnd(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <BoardColumns
              columnMeta={columnMeta}
              getColumnIssues={getColumnIssues}
              dragEnabled
              disabled={isMutating}
              onAddTask={() => {
                openCreateDialog();
              }}
              onIssueOpen={(issue) => {
                openIssueSheet(issue.issueId);
              }}
              className="min-h-0 flex-1"
            />
          </div>

          <DragOverlay>
            {activeIssue ? (
              <IssueCard issue={activeIssue} isOverlay disabled={isMutating} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {projectId != null ? (
        <CreateIssueDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={handleCreateIssue}
          isPending={board.isCreating}
          submitError={failedCreate ? board.createError : null}
        />
      ) : null}
    </div>
  );
}

export default function BoardPage() {
  const { projectId, projects, isLoading: isProjectLoading } = useActiveProject();
  const activeProject = projects?.find((project) => project.id === projectId);

  const { data: orchestratorStatus, isLoading: isOrchestratorLoading } = useIpcQuery<string>(
    `project-orchestrator-status:${projectId ?? "none"}`,
    async (client) => client.getProjectOrchestratorStatus(projectId as string),
    { pollIntervalMs: DEFAULT_IPC_POLL_INTERVAL_MS, enabled: projectId != null },
  );

  const isHeaderLoading =
    isProjectLoading ||
    (projectId != null && orchestratorStatus === undefined && isOrchestratorLoading);

  const projectName =
    projectId == null ? "No active project" : (activeProject?.name ?? "Task board");

  const statusLabel = orchestratorStatus ?? activeProject?.orchestratorStatus;

  return (
    <PageShell width="full" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        eyebrow="Board"
        icon={BoardIcon}
        title={projectName}
        description={
          projectId == null
            ? "Select a project to view its task board."
            : "Drag tasks between columns to update their status."
        }
        isLoading={isHeaderLoading}
        actions={
          statusLabel && projectId != null ? (
            <OrchestratorStatusBadge status={statusLabel} />
          ) : null
        }
        className="mb-2 shrink-0"
      />

      {projectId != null ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <BoardDnDContent />
        </div>
      ) : null}
    </PageShell>
  );
}
