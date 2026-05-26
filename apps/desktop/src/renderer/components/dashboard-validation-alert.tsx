import React from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@symphony/ui";
import { surfaceAlertClass } from "@/renderer/lib/surface-styles";

type DashboardValidationAlertProps = {
  validationError?: string | null;
};

function splitValidationMessages(validationError: string): string[] {
  return validationError
    .split(";")
    .map((message) => message.trim())
    .filter((message) => message.length > 0);
}

export function DashboardValidationAlert({
  validationError,
}: DashboardValidationAlertProps): React.JSX.Element | null {
  const trimmed = validationError?.trim();
  if (!trimmed) {
    return null;
  }

  const messages = splitValidationMessages(trimmed);

  return (
    <Alert variant="destructive" className={surfaceAlertClass}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Workflow configuration invalid</AlertTitle>
      <AlertDescription>
        {messages.length === 1 ? (
          messages[0]
        ) : (
          <ul className="m-0 list-disc pl-5">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
