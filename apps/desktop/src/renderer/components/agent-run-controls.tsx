import React from "react";
import { Ban, Pause, Play } from "lucide-react";
import { Button, cn } from "@symphony/ui";

type AgentRunControlsProps = {
  runAttemptId: string;
  paused: boolean;
  disabled?: boolean;
  className?: string;
  onPause: (runAttemptId: string) => Promise<void>;
  onResume: (runAttemptId: string) => Promise<void>;
  onCancel: (runAttemptId: string) => Promise<void>;
};

export function AgentRunControls({
  runAttemptId,
  paused,
  disabled = false,
  className,
  onPause,
  onResume,
  onCancel,
}: AgentRunControlsProps): React.JSX.Element {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {paused ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => void onResume(runAttemptId)}
        >
          <Play className="size-4" />
          Resume
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => void onPause(runAttemptId)}
        >
          <Pause className="size-4" />
          Pause
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={disabled}
        onClick={() => void onCancel(runAttemptId)}
      >
        <Ban className="size-4" />
        Cancel
      </Button>
    </div>
  );
}
