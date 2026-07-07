"use client";
import { useBoard } from "@/hooks/use-board";

export function IpcSmoke() {
  const { board, error, isLoading, isIpcAvailable } = useBoard();
  if (!isIpcAvailable) {
    return <p className="text-sm text-muted-foreground">ipc unavailable (browser mode)</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">checking ipc…</p>;
  }

  if (error) {
    return <p className="text-sm text-muted-foreground">ipc error: {error.message}</p>;
  }

  const identifiers = board
    ? [
        ...board.backlog.issues,
        ...board.inProgress.issues,
        ...board.review.issues,
        ...board.done.issues,
      ].map((issue) => issue.identifier)
    : [];

  const message =
    identifiers.length > 0
      ? `IPC ok — board issues: ${identifiers.join(", ")}`
      : "IPC ok — board is empty";

  return <p className="text-sm text-muted-foreground">{message}</p>;
}
