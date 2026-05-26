import React from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@symphony/ui";
import { surfaceAlertClass } from "@/renderer/lib/surface-styles";

type DashboardErrorAlertProps = {
  error: Error;
};

export function DashboardErrorAlert({ error }: DashboardErrorAlertProps): React.JSX.Element {
  return (
    <Alert variant="destructive" className={surfaceAlertClass}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Orchestrator unavailable</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}
