"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn, wrapText, wrapTextPreserve } from "@/lib/utils";

type TaskCommentBodyProps = {
  body: string;
  compact?: boolean;
};

function createMarkdownComponents(compact: boolean): Components {
  const textClass = compact ? "text-[10px]" : "text-xs";
  const headingClass = compact ? "text-[10px]" : "text-xs";
  const smallHeadingClass = compact ? "text-[10px]" : "text-sm";
  const codeClass = compact ? "text-[9px]" : "text-[10px]";

  return {
  p: ({ children }) => (
    <p className={cn(textClass, "leading-relaxed text-foreground", wrapTextPreserve)}>{children}</p>
  ),
  strong: ({ children }) => <strong className="font-medium text-foreground">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  h1: ({ children }) => (
    <h3 className={cn(smallHeadingClass, "font-medium text-foreground", wrapText)}>{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className={cn(headingClass, "font-medium text-foreground", wrapText)}>{children}</h4>
  ),
  h3: ({ children }) => (
    <h5 className={cn(headingClass, "font-medium text-foreground", wrapText)}>{children}</h5>
  ),
  h4: ({ children }) => (
    <h6 className={cn(headingClass, "font-medium text-foreground", wrapText)}>{children}</h6>
  ),
  ul: ({ children }) => (
    <ul className={cn("list-disc space-y-1 pl-4 text-foreground", textClass, wrapText)}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className={cn("list-decimal space-y-1 pl-4 text-foreground", textClass, wrapText)}>
      {children}
    </ol>
  ),
  li: ({ children }) => <li className={wrapTextPreserve}>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote
      className={cn(
        "border-l-2 border-border/60 pl-3 italic text-muted-foreground",
        textClass,
        wrapTextPreserve,
      )}
    >
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("break-all text-foreground underline underline-offset-2", textClass)}
    >
      {children}
    </a>
  ),
  hr: () => <hr className="border-border/60" />,
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");

    if (isBlock) {
      return (
        <code
          className={cn(
            "block font-mono leading-relaxed text-foreground",
            codeClass,
            wrapTextPreserve,
          )}
        >
          {children}
        </code>
      );
    }

    return (
      <code className={cn("rounded bg-muted px-1 py-0.5 font-mono text-foreground", codeClass)}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre
      className={cn(
        "overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-2",
        wrapTextPreserve,
      )}
    >
      {children}
    </pre>
  ),
  };
}

export function TaskCommentBody({ body, compact = false }: TaskCommentBodyProps) {
  const markdownComponents = createMarkdownComponents(compact);

  return (
    <div className={cn("min-w-0 space-y-2", wrapText)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
