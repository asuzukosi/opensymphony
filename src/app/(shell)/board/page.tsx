"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useOrchestratorStatus } from "@/hooks/use-orchestrator-status";

import { type BoardColumnMeta, BoardColumns } from "@/components/board/board-columns";
import { CreateTaskDialog } from "@/components/board/create-task-dialog";
import { TaskCard } from "@/components/board/task-card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
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
import {
  findTaskById,
  findTaskColumn,
  moveTaskBetweenColumns,
  resolveDropTargetColumnId,
} from "@/lib/board-drag-utils";
import type {
  BoardColumnId,
  ProjectBoard,
  ProjectBoardTask,
  RuntimeStatus,
} from "@/lib/ipc/types";
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

function buildSyncedBoard(
  tasksByColumn: Record<BoardColumnId, ProjectBoardTask[] | undefined>,
): ProjectBoard {
  return {
    backlog: { tasks: tasksByColumn.backlog ?? [] },
    inProgress: { tasks: tasksByColumn.inProgress ?? [] },
    review: { tasks: tasksByColumn.review ?? [] },
    done: { tasks: tasksByColumn.done ?? [] },
  };
}

function countBoardTasks(board: ProjectBoard): { total: number; done: number } {
  const columns = [board.backlog, board.inProgress, board.review, board.done];
  const total = columns.reduce((sum, column) => sum + column.tasks.length, 0);
  return { total, done: board.done.tasks.length };
}

function BoardDnDContent() {
  const { projectId } = useActiveProject();
  const board = useBoard();

  const syncedBoard = useMemo(() => buildSyncedBoard(board.tasksByColumn), [board.tasksByColumn]);

  const [optimisticBoard, setOptimisticBoard] = useState<ProjectBoard | null>(null);
  const [activeTask, setActiveTask] = useState<ProjectBoardTask | null>(null);
  const [failedTransition, setFailedTransition] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [failedCreate, setFailedCreate] = useState(false);
  const { openTaskSheet } = useTaskSheetParams();

  useEffect(() => {
    setOptimisticBoard(null);
  }, [
    board.tasksByColumn.backlog,
    board.tasksByColumn.inProgress,
    board.tasksByColumn.review,
    board.tasksByColumn.done,
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

  const getColumnTasks = useCallback(
    (columnId: BoardColumnId): ProjectBoardTask[] | undefined => {
      if (optimisticBoard) {
        return optimisticBoard[columnId].tasks;
      }
      return board.tasksByColumn[columnId];
    },
    [board.tasksByColumn, optimisticBoard],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = (event: DragStartEvent): void => {
    const task = event.active.data.current?.task as ProjectBoardTask | undefined;
    setActiveTask(task ?? findTaskById(String(event.active.id), displayBoard));
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveTask(null);

    if (!event.over) {
      return;
    }

    const taskId = String(event.active.id);
    const targetColumn = resolveDropTargetColumnId(String(event.over.id), syncedBoard);
    const sourceColumn = findTaskColumn(taskId, syncedBoard);

    if (!targetColumn || !sourceColumn || targetColumn === sourceColumn) {
      return;
    }

    setOptimisticBoard(moveTaskBetweenColumns(syncedBoard, taskId, sourceColumn, targetColumn));
    board.resetTransition();
    setFailedTransition(false);

    try {
      await board.transitionTask(taskId, targetColumn, "operator");
      setOptimisticBoard(null);
    } catch {
      setOptimisticBoard(null);
      setFailedTransition(true);
    }
  };

  const handleCreateTask = async (input: CreateTaskInput): Promise<void> => {
    board.resetCreate();
    setFailedCreate(false);
    console.log("handleCreateTask", input);

    try {
      await board.createTask(input);
    } catch (error) {
      setFailedCreate(true);
      throw error;
    }
  };

  const isMutating = board.isTransitioning || board.isCreating;
  const { total, done } = useMemo(() => countBoardTasks(displayBoard), [displayBoard]);

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
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>Task update failed</AlertTitle>
          <AlertDescription>
            {board.transitionError.message}. Your change was reverted to the last synced board
            state.
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
              getColumnTasks={getColumnTasks}
              dragEnabled
              disabled={isMutating}
              onAddTask={() => {
                openCreateDialog();
              }}
              onTaskOpen={(task) => {
                openTaskSheet(task.taskId);
              }}
              className="min-h-0 flex-1"
            />
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} isOverlay disabled={isMutating} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

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
