import React from "react";
import { useParams } from "react-router-dom";

export function Issue(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();

  return (
    <p className="text-sm text-muted-foreground">
      Issue detail for {id ?? "unknown"} coming soon.
    </p>
  );
}
