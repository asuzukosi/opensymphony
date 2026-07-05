import React from "react";
import { Kanban } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@symphony/ui";
import { surfaceAlertClass } from "@/renderer/lib/surface-styles";

export function BoardEmptyState(): React.JSX.Element {
  return (
    <Alert className={surfaceAlertClass}>
      <Kanban className="h-4 w-4" />
      <AlertTitle>No workflow columns</AlertTitle>
      <AlertDescription>
        The project board could not be loaded. Check your WORKFLOW.md configuration and try again.
      </AlertDescription>
    </Alert>
  );
}
