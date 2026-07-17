"use client";

import { useState } from "react";

import { XMarkIcon } from "@/components/ui/hero-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(trimmed);
  }
  return normalized.sort((a, b) => a.localeCompare(b));
}

type TaskTagsFieldProps = {
  value: readonly string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  id?: string;
};

export function TaskTagsField({
  value,
  onChange,
  disabled = false,
  id = "task-tags",
}: TaskTagsFieldProps) {
  const [input, setInput] = useState("");

  const addTag = (): void => {
    const next = normalizeTags([...value, input]);
    if (next.length === value.length) {
      setInput("");
      return;
    }
    onChange(next);
    setInput("");
  };

  const removeTag = (tag: string): void => {
    onChange(value.filter((entry) => entry !== tag));
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Tags</Label>
      <p className="text-xs text-muted-foreground">
        Add labels to group and filter tasks later.
      </p>
      <div className="flex gap-2">
        <Input
          id={id}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder="Add a tag"
          disabled={disabled}
        />
        <Button type="button" variant="outline" disabled={disabled || !input.trim()} onClick={addTag}>
          Add
        </Button>
      </div>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1 font-normal">
              {tag}
              <button
                type="button"
                className={cn(
                  "rounded-sm p-0.5 hover:bg-muted",
                  disabled && "pointer-events-none opacity-50",
                )}
                aria-label={`Remove ${tag}`}
                disabled={disabled}
                onClick={() => removeTag(tag)}
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No tags yet.</p>
      )}
    </div>
  );
}
