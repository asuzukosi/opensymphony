"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TaskAddCommentFormProps = {
  onSubmit: (body: string) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function TaskAddCommentForm({
  onSubmit,
  isPending = false,
  submitError = null,
}: TaskAddCommentFormProps) {
  const [body, setBody] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setInputError("Comment cannot be empty");
      return;
    }

    setInputError(null);
    try {
      await onSubmit(trimmed);
      setBody("");
    } catch {
      // api error surfaced via submitError
    }
  };

  return (
    <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
      <div className="grid gap-2">
        <Label htmlFor="task-comment-body" className="text-xs">Add comment</Label>
        <Textarea
          id="task-comment-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a comment..."
          disabled={isPending}
          rows={3}
        />
      </div>
      {inputError ? <p className="text-xs text-destructive">{inputError}</p> : null}
      {submitError ? (
        <Alert variant="destructive">
          <AlertTitle>Comment failed</AlertTitle>
          <AlertDescription>{submitError.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adding..." : "Add comment"}
      </Button>
    </form>
  );
}
