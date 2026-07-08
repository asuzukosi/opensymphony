"use client";

import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Agent } from "@/lib/ipc/types";

export type AgentFormInput = {
  name: string;
  acpCommand: string | null;
};

type AgentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  agentId?: string | null;
  onFetchAgent?: (agentId: string) => Promise<Agent>;
  onCreate: (input: AgentFormInput) => Promise<void>;
  onUpdate: (agentId: string, input: AgentFormInput) => Promise<void>;
  onDelete?: (agentId: string) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

function normalizeAcpCommand(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function AgentFormDialog({
  open,
  onOpenChange,
  mode,
  agentId = null,
  onFetchAgent,
  onCreate,
  onUpdate,
  onDelete,
  isPending = false,
  submitError = null,
}: AgentFormDialogProps) {
  const [name, setName] = useState("");
  const [acpCommand, setAcpCommand] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);

  const resetForm = (): void => {
    setName("");
    setAcpCommand("");
    setInputError(null);
    setLoadError(null);
    setIsLoadingAgent(false);
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open || mode !== "edit" || agentId == null || onFetchAgent == null) {
      return;
    }

    let cancelled = false;
    setIsLoadingAgent(true);
    setLoadError(null);

    void onFetchAgent(agentId)
      .then((agent) => {
        if (cancelled) {
          return;
        }
        setName(agent.name);
        setAcpCommand(agent.acpCommand ?? "");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAgent(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, mode, onFetchAgent, open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setInputError("Agent name cannot be empty");
      return;
    }

    setInputError(null);
    const input: AgentFormInput = {
      name: trimmedName,
      acpCommand: normalizeAcpCommand(acpCommand),
    };

    try {
      if (mode === "create") {
        await onCreate(input);
      } else if (agentId != null) {
        await onUpdate(agentId, input);
      }
      resetForm();
      onOpenChange(false);
    } catch {
      // api error surfaced by parent
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (mode !== "edit" || agentId == null || onDelete == null) {
      return;
    }

    try {
      await onDelete(agentId);
      resetForm();
      onOpenChange(false);
    } catch {
      // api error surfaced by parent
    }
  };

  const isEdit = mode === "edit";
  const formDisabled = isPending || isLoadingAgent || loadError != null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit agent" : "Add agent"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the agent name and ACP command."
                : "Register a new agent in the local registry."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {isLoadingAgent ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="agent-name">Name</Label>
                  <Input
                    id="agent-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Codex worker"
                    disabled={formDisabled}
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="agent-acp-command">ACP command</Label>
                  <Textarea
                    id="agent-acp-command"
                    value={acpCommand}
                    onChange={(event) => setAcpCommand(event.target.value)}
                    placeholder="Optional shell command to spawn the agent"
                    disabled={formDisabled}
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>
              </>
            )}
            {inputError ? <p className="text-sm text-destructive">{inputError}</p> : null}
            {loadError ? (
              <Alert variant="destructive">
                <AlertTitle>Agent unavailable</AlertTitle>
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            ) : null}
            {submitError ? (
              <Alert variant="destructive">
                <AlertTitle>{isEdit ? "Update failed" : "Create failed"}</AlertTitle>
                <AlertDescription>{submitError.message}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                disabled={formDisabled}
                onClick={() => void handleDelete()}
              >
                {isPending ? "Deleting..." : "Delete agent"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={formDisabled}>
                {isPending ? "Saving..." : isEdit ? "Save changes" : "Add agent"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
