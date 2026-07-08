"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CreateIssueInput } from "@/hooks/use-board";
import { validateCreateIssueForm } from "@/lib/create-issue-form";

type CreateIssueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnLabel: string;
  onCreate: (input: CreateIssueInput) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function CreateIssueDialog({
  open,
  onOpenChange,
  columnLabel,
  onCreate,
  isPending = false,
  submitError = null,
}: CreateIssueDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priorityInput, setPriorityInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const resetForm = (): void => {
    setTitle("");
    setDescription("");
    setPriorityInput("");
    setInputError(null);
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setInputError(null);

    const validation = validateCreateIssueForm({ title, description, priorityInput });
    if (!validation.valid) {
      setInputError(validation.error);
      return;
    }

    try {
      await onCreate({
        title: validation.value.title,
        description: validation.value.description ?? null,
        ...(validation.value.priority !== undefined
          ? { priority: validation.value.priority }
          : {}),
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // api error surfaced by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
            <DialogDescription>Add a new task to {columnLabel}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="issue-title">Title</Label>
              <Input
                id="issue-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs to be done?"
                disabled={isPending}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issue-description">Description</Label>
              <Textarea
                id="issue-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional details"
                disabled={isPending}
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issue-priority">Priority</Label>
              <Input
                id="issue-priority"
                type="number"
                min={0}
                step={1}
                value={priorityInput}
                onChange={(event) => setPriorityInput(event.target.value)}
                placeholder="Optional, e.g. 1"
                disabled={isPending}
              />
            </div>
            {inputError ? <p className="text-sm text-destructive">{inputError}</p> : null}
            {submitError ? <p className="text-sm text-destructive">{submitError.message}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
