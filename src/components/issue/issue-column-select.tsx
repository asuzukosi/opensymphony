"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOARD_COLUMN_LABELS } from "@/components/board/board-states";
import { BOARD_COLUMN_IDS, type BoardColumnId } from "@/lib/ipc/types";

type IssueColumnSelectProps = {
  currentColumn: BoardColumnId;
  onColumnChange: (column: BoardColumnId) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function IssueColumnSelect({
  currentColumn,
  onColumnChange,
  isPending = false,
  submitError = null,
}: IssueColumnSelectProps) {
  const currentLabel = BOARD_COLUMN_LABELS[currentColumn];

  return (
    <div className="space-y-2">
      <Select
        value={currentColumn}
        onValueChange={(value) => {
          if (value !== currentColumn) {
            void onColumnChange(value as BoardColumnId);
          }
        }}
        disabled={isPending}
      >
        <SelectTrigger className="h-8 w-[180px]" aria-label="Change board column">
          <SelectValue placeholder={currentLabel} />
        </SelectTrigger>
        <SelectContent>
          {BOARD_COLUMN_IDS.map((columnId) => (
            <SelectItem key={columnId} value={columnId}>
              {BOARD_COLUMN_LABELS[columnId]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {submitError ? (
        <Alert variant="destructive">
          <AlertTitle>Column change failed</AlertTitle>
          <AlertDescription>{submitError.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
