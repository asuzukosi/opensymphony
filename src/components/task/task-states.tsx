"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QuestionMarkCircleIcon } from "@/components/ui/hero-icons";
import { cn, wrapText } from "@/lib/utils";

type TaskNotFoundStateProps = {
  taskId?: string;
};

export function TaskNotFoundState({ taskId: _taskId }: TaskNotFoundStateProps) {
  return (
    <Alert className="text-xs">
      <QuestionMarkCircleIcon className="h-4 w-4" />
      <AlertTitle>Task not found</AlertTitle>
      <AlertDescription className={cn("text-xs", wrapText)}>
        This task may have been deleted or is no longer available.
      </AlertDescription>
    </Alert>
  );
}

type TaskErrorAlertProps = {
  error: Error;
};

export function TaskErrorAlert({ error }: TaskErrorAlertProps) {
  return (
    <Alert variant="destructive" className="text-xs">
      <AlertTitle>Task unavailable</AlertTitle>
      <AlertDescription className={cn("text-xs", wrapText)}>{error.message}</AlertDescription>
    </Alert>
  );
}

export function isTaskNotFoundError(error: Error): boolean {
  return error.message.toLowerCase().includes("not found");
}
