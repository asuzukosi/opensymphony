"use client";

import Editor from "@monaco-editor/react";
import { loader } from "@monaco-editor/react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type MonacoEditorFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  height?: number | string;
  language?: string;
};

export function MonacoEditorField({
  id,
  value,
  onChange,
  disabled = false,
  className,
  height = 360,
  language = "plaintext",
}: MonacoEditorFieldProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void import("monaco-editor").then((monaco) => {
      loader.config({ monaco });
      return loader.init();
    }).then(() => {
      if (!cancelled) {
        setIsReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isReady) {
    return (
      <Skeleton
        className={cn("w-full rounded-md", className)}
        style={{ height: typeof height === "number" ? `${height}px` : height }}
      />
    );
  }

  return (
    <div
      id={id}
      className={cn(
        "overflow-hidden rounded-md border border-zinc-800 bg-[#1e1e1e] shadow-sm",
        className,
      )}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{
          readOnly: disabled,
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          wrappingStrategy: "advanced",
          fontSize: 13,
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          lineHeight: 20,
          padding: { top: 12, bottom: 12 },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          renderLineHighlight: "gutter",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          tabSize: 2,
        }}
        theme="vs-dark"
      />
    </div>
  );
}
