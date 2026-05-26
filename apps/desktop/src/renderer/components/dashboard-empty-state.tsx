import React from "react";
import { Inbox } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@symphony/ui";
import { surfaceAlertClass } from "@/renderer/lib/surface-styles";

export function DashboardEmptyState(): React.JSX.Element {
  return (
    <Alert className={surfaceAlertClass}>
      <Inbox className="h-4 w-4" />
      <AlertTitle>No orchestrator data</AlertTitle>
      <AlertDescription>
        Runtime state could not be loaded. Start the orchestrator or check your configuration in
        Settings.
      </AlertDescription>
    </Alert>
  );
}
