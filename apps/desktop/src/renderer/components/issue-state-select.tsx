import React from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@symphony/ui";

export type WorkflowStateOption = {
  stateId: string;
  stateName: string;
};

type IssueStateSelectProps = {
  currentStateId: string;
  currentStateName: string;
  states: WorkflowStateOption[];
  onStateChange: (targetStateId: string) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function IssueStateSelect({
  currentStateId,
  currentStateName,
  states,
  onStateChange,
  isPending = false,
  submitError = null,
}: IssueStateSelectProps): React.JSX.Element {
  const disabled = isPending || states.length === 0;

  return (
    <div className="space-y-2">
      <Select
        value={currentStateId}
        onValueChange={(value) => {
          if (value !== currentStateId) {
            void onStateChange(value);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-[180px]" aria-label="Change workflow state">
          <SelectValue placeholder={currentStateName} />
        </SelectTrigger>
        <SelectContent>
          {states.map((state) => (
            <SelectItem key={state.stateId} value={state.stateId}>
              {state.stateName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {submitError ? (
        <Alert variant="destructive">
          <AlertTitle>State change failed</AlertTitle>
          <AlertDescription>{submitError.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
