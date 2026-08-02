"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useOrchestratorStatus } from "@/hooks/use-orchestrator-status";

import { type BoardColumnMeta, BoardColumns } from "@/components/board/board-columns";
import { CreateTaskDialog } from "@/components/board/create-task-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import type { KanbanCommitMeta } from "@/components/ui/kanban";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BadgeCheckIcon,
  BoardIcon,
  ClockIcon,
  PlayCircleIcon,
  PlusIcon,
} from "@/components/ui/hero-icons";
import { useActiveProject } from "@/contexts/active-project-context";
import { type CreateTaskInput, useBoard } from "@/hooks/use-board";
import { findTaskColumn } from "@/lib/board-drag-utils";
import type { BoardColumnId, ProjectBoard, ProjectBoardTask, RuntimeStatus } from "@/lib/ipc/types";
import { BOARD_COLUMN_IDS } from "@/lib/ipc/types";
import { useTaskSheetParams } from "@/lib/task-sheet-params";

function formatOrchestratorStatus(status: string): string {
  return status.replace(/_/g, " ");
}

function isRuntimeStatus(status: string): status is RuntimeStatus {
  return status === "idle" || status === "running";
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

  return (
    <Badge variant="outline" className="shrink-0 font-normal capitalize">
      <ClockIcon data-icon="inline-start" />
      {label}
    </Badge>
  );
}

function boardToColumns(
  tasksByColumn: Record<BoardColumnId, ProjectBoardTask[] | undefined>,
): Record<BoardColumnId, ProjectBoardTask[]> {
  return {
    backlog: tasksByColumn.backlog ?? [],
    inProgress: tasksByColumn.inProgress ?? [],
    review: tasksByColumn.review ?? [],
    done: tasksByColumn.done ?? [],
  };
}

function columnsToBoard(columns: Record<BoardColumnId, ProjectBoardTask[]>): ProjectBoard {
  return {
    backlog: { tasks: columns.backlog },
    inProgress: { tasks: columns.inProgress },
    review: { tasks: columns.review },
    done: { tasks: columns.done },
  };
}

function countBoardTasks(columns: Record<BoardColumnId, ProjectBoardTask[]>): {
  total: number;
  done: number;
} {
  const total = BOARD_COLUMN_IDS.reduce((sum, columnId) => sum + columns[columnId].length, 0);
  return { total, done: columns.done.length };
}

function BoardDnDContent() {
  const { projectId } = useActiveProject();
  const board = useBoard();
  const syncedColumns = useMemo(() => boardToColumns(board.tasksByColumn), [board.tasksByColumn]);

  const [columns, setColumns] = useState(syncedColumns);
  const [failedTransition, setFailedTransition] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [failedCreate, setFailedCreate] = useState(false);
  const { openTaskSheet } = useTaskSheetParams();

  useEffect(() => {
    setColumns(syncedColumns);
  }, [syncedColumns]);

  const columnMeta = useMemo((): Record<BoardColumnId, BoardColumnMeta> => {
    const meta = { isLoading: board.isLoading, error: board.error };
    return {
      backlog: meta,
      inProgress: meta,
      review: meta,
      done: meta,
    };
  }, [board.error, board.isLoading]);

  const handleColumnsCommit = useCallback(
    async (
      next: Record<BoardColumnId, ProjectBoardTask[]>,
      meta: KanbanCommitMeta<ProjectBoardTask>,
    ) => {
      if (meta.kind !== "item") {
        return;
      }

      const taskId = String(meta.event.active.id);
      const targetColumn = meta.overContainer as BoardColumnId;
      const sourceColumn = findTaskColumn(
        taskId,
        columnsToBoard(meta.previousValue as Record<BoardColumnId, ProjectBoardTask[]>),
      );

      if (!sourceColumn || targetColumn === sourceColumn) {
        return;
      }

      board.resetTransition();
      setFailedTransition(false);

      try {
        await board.transitionTask(taskId, targetColumn, "operator");
      } catch {
        setColumns(meta.previousValue as Record<BoardColumnId, ProjectBoardTask[]>);
        setFailedTransition(true);
      }
    },
    [board],
  );

  const handleCreateTask = async (input: CreateTaskInput): Promise<void> => {
    board.resetCreate();
    setFailedCreate(false);

    try {
      await board.createTask(input);
    } catch (error) {
      setFailedCreate(true);
      throw error;
    }
  };

  const isMutating = board.isTransitioning || board.isCreating;
  const { total, done } = useMemo(() => countBoardTasks(columns), [columns]);

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
        <Button
          type="button"
          size="sm"
          className="gap-2"
          disabled={isMutating}
          onClick={openCreateDialog}
        >
          <PlusIcon className="size-4" />
          Add task
        </Button>
      </div>

      {failedTransition && board.transitionError ? (
        <Alert variant="destructive" className="mb-3 shrink-0">
          <AlertTitle>Task update failed</AlertTitle>
          <AlertDescription>
            {board.transitionError.message}. Your change was reverted to the last synced board
            state.
          </AlertDescription>
        </Alert>
      ) : null}

      {failedCreate && board.createError ? (
        <Alert variant="destructive" className="mb-3 shrink-0">
          <AlertTitle>Task creation failed</AlertTitle>
          <AlertDescription>{board.createError.message}</AlertDescription>
        </Alert>
      ) : null}

      <BoardColumns
        columns={columns}
        onColumnsChange={setColumns}
        onColumnsCommit={(next, meta) => void handleColumnsCommit(next, meta)}
        columnMeta={columnMeta}
        disabled={isMutating}
        onAddTask={openCreateDialog}
        onTaskOpen={(task) => {
          openTaskSheet(task.taskId);
        }}
        className="min-h-0 flex-1"
      />

      {projectId != null ? (
        <CreateTaskDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={handleCreateTask}
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
  const orchestratorStatus = useOrchestratorStatus(projectId, activeProject);

  const projectName =
    projectId == null ? "No active project" : (activeProject?.name ?? "Task board");

  return (
    <PageShell width="full" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        eyebrow="Board"
        icon={BoardIcon}
        title={projectName}
        titleClassName="text-sm"
        description={
          projectId == null
            ? "Select a project to view its task board."
            : "Drag tasks between columns to update their status."
        }
        isLoading={isProjectLoading}
        actions={
          orchestratorStatus && projectId != null ? (
            <OrchestratorStatusBadge status={orchestratorStatus} />
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
