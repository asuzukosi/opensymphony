import React from "react";
import { CardDescription, CardHeader, CardTitle, ScrollArea } from "@symphony/ui";
import { SurfaceCard } from "@/renderer/layout/surface-card";

type AgentsColumnProps = {
  title: string;
  description: string;
  count: number;
  emptyMessage: string;
  children: React.ReactNode;
};

export function AgentsColumn({
  title,
  description,
  count,
  emptyMessage,
  children,
}: AgentsColumnProps): React.JSX.Element {
  const isEmpty = count === 0;

  return (
    <SurfaceCard className="flex max-h-[calc(100vh-12rem)] min-h-[28rem] flex-col">
      <CardHeader className="shrink-0 space-y-1 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <ScrollArea className="min-h-0 flex-1 px-3 pb-3">
        <div className="min-h-[20rem] space-y-2 rounded-lg border border-dashed border-border/70 bg-muted/20 p-2">
          {isEmpty ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            children
          )}
        </div>
      </ScrollArea>
    </SurfaceCard>
  );
}
