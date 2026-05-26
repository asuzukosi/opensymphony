import React from "react";

export function BoardColumnEmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-8 text-center">
      <p className="text-sm font-medium text-muted-foreground">No tasks</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Drop a task here or use + to create one
      </p>
    </div>
  );
}
