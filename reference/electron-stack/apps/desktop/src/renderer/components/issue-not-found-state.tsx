import React from "react";
import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@symphony/ui";
import { surfaceAlertClass } from "@/renderer/lib/surface-styles";

type IssueNotFoundStateProps = {
  issueId: string;
};

export function IssueNotFoundState({ issueId }: IssueNotFoundStateProps): React.JSX.Element {
  return (
    <Alert className={surfaceAlertClass}>
      <FileQuestion className="h-4 w-4" />
      <AlertTitle>Issue not found</AlertTitle>
      <AlertDescription>
        No issue exists for id <span className="font-mono">{issueId}</span>.{" "}
        <Link to="/board" className="font-medium text-primary hover:underline">
          Return to board
        </Link>
      </AlertDescription>
    </Alert>
  );
}
