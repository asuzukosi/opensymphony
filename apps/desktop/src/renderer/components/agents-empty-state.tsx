import React from "react";
import { Bot } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@symphony/ui";
import { surfaceAlertClass } from "@/renderer/lib/surface-styles";

export function AgentsEmptyState(): React.JSX.Element {
  return (
    <Alert className={surfaceAlertClass}>
      <Bot className="h-4 w-4" />
      <AlertTitle>No agent runtime data</AlertTitle>
      <AlertDescription>Runtime state could not be loaded.</AlertDescription>
    </Alert>
  );
}
