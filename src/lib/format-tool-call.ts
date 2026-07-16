import { summarizeText } from "@/lib/utils";

type ToolCallUpdatePayload = Record<string, unknown>;

export type FormattedToolCall = {
  summary: string;
  detail: string | null;
  kind: string;
  status: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function formatToolLabel(value: string): string {
  return value
    .split(/[_-]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toolNameFromTitle(title: string): string {
  const colon = title.indexOf(":");
  if (colon <= 0) {
    return "";
  }
  const name = title.slice(0, colon).trim();
  if (/^[\w.-]+$/.test(name)) {
    return name;
  }
  return "";
}

function parsePathsFromLocations(update: ToolCallUpdatePayload): string[] {
  const locations = update.locations;
  if (!Array.isArray(locations)) {
    return [];
  }
  return locations
    .map((location) => {
      const record = asRecord(location);
      return typeof record?.path === "string" ? record.path : null;
    })
    .filter((path): path is string => path != null);
}

function parsePathsFromContent(update: ToolCallUpdatePayload): string[] {
  const content = update.content;
  if (!Array.isArray(content)) {
    return [];
  }
  const paths: string[] = [];
  for (const item of content) {
    const record = asRecord(item);
    if (record == null) {
      continue;
    }
    if (record.type === "diff" && typeof record.path === "string") {
      paths.push(record.path);
    }
  }
  return paths;
}

function parsePathsFromChanges(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((change) => {
      const record = asRecord(change);
      return typeof record?.path === "string" ? record.path : null;
    })
    .filter((path): path is string => path != null);
}

function parsePathsFromTitle(title: string): string[] {
  const changesMatch = title.match(/changes:\s*(\[.*\])\s*$/s);
  if (changesMatch != null) {
    try {
      return parsePathsFromChanges(JSON.parse(changesMatch[1]) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

function parsePathsFromRawInput(rawInput: unknown): string[] {
  const record = asRecord(rawInput);
  if (record == null) {
    return [];
  }
  const paths = [
    ...parsePathsFromChanges(record.changes),
    typeof record.path === "string" ? record.path : null,
    typeof record.file_path === "string" ? record.file_path : null,
    typeof record.filePath === "string" ? record.filePath : null,
  ].filter((path): path is string => path != null);
  return paths;
}

function collectToolPaths(update: ToolCallUpdatePayload, title: string): string[] {
  return [
    ...new Set([
      ...parsePathsFromLocations(update),
      ...parsePathsFromContent(update),
      ...parsePathsFromTitle(title),
      ...parsePathsFromRawInput(update.rawInput),
    ]),
  ];
}

function formatPathList(paths: string[], verb: string): { summary: string; detail: string | null } {
  if (paths.length === 0) {
    return { summary: verb, detail: null };
  }
  if (paths.length === 1) {
    return {
      summary: `${verb} ${basename(paths[0])}`,
      detail: paths[0],
    };
  }
  if (paths.length <= 3) {
    return {
      summary: `${verb} ${paths.map(basename).join(", ")}`,
      detail: paths.join(", "),
    };
  }
  return {
    summary: `${verb} ${paths.length} files`,
    detail: paths.map(basename).join(", "),
  };
}

function parseBashFields(
  title: string,
  rawInput: unknown,
): { command: string | null; cwd: string | null } {
  const record = asRecord(rawInput);
  const commandFromInput =
    typeof record?.command === "string"
      ? record.command
      : typeof record?.cmd === "string"
        ? record.cmd
        : null;
  const cwdFromInput =
    typeof record?.cwd === "string"
      ? record.cwd
      : typeof record?.working_directory === "string"
        ? record.working_directory
        : null;

  const commandMatch = title.match(/command:\s*(.+?)(?:,\s*cwd:|$)/s);
  const cwdMatch = title.match(/cwd:\s*(.+)$/);

  return {
    command: commandFromInput ?? commandMatch?.[1]?.trim() ?? null,
    cwd: cwdFromInput ?? cwdMatch?.[1]?.trim() ?? null,
  };
}

function shortenCommand(command: string): string {
  const unwrapped =
    command.match(/-lc\s+"([^"]+)"/)?.[1] ??
    command.match(/-lc\s+'([^']+)'/)?.[1] ??
    command;
  return summarizeText(unwrapped.replace(/\\/g, ""), 96);
}

function formatExecuteSummary(
  title: string,
  rawInput: unknown,
): { summary: string; detail: string | null } {
  const { command, cwd } = parseBashFields(title, rawInput);
  if (command == null) {
    return { summary: "Ran shell command", detail: null };
  }
  const shortCommand = shortenCommand(command);
  if (cwd != null) {
    return {
      summary: `Ran ${shortCommand}`,
      detail: cwd,
    };
  }
  return { summary: `Ran ${shortCommand}`, detail: command };
}

function changeVerbForPath(path: string, changeKind: unknown): string {
  const record = asRecord(changeKind);
  const type = typeof record?.type === "string" ? record.type : null;
  if (type === "delete") {
    return "Deleted";
  }
  if (type === "add" || type === "create") {
    return "Created";
  }
  if (type === "move" && typeof record?.move_path === "string") {
    return "Moved";
  }
  return "Edited";
}

function formatPatchSummary(
  update: ToolCallUpdatePayload,
  title: string,
): { summary: string; detail: string | null } {
  const changesMatch = title.match(/changes:\s*(\[.*\])\s*$/s);
  if (changesMatch != null) {
    try {
      const changes = JSON.parse(changesMatch[1]) as unknown;
      if (Array.isArray(changes) && changes.length === 1) {
        const change = asRecord(changes[0]);
        const path = typeof change?.path === "string" ? change.path : null;
        if (path != null) {
          const verb = changeVerbForPath(path, change?.kind);
          return { summary: `${verb} ${basename(path)}`, detail: path };
        }
      }
    } catch {
      // fall through
    }
  }

  const paths = collectToolPaths(update, title);
  return formatPathList(paths, "Edited");
}

const KIND_VERBS: Record<string, string> = {
  read: "Read",
  edit: "Edited",
  delete: "Deleted",
  move: "Moved",
  search: "Searched",
  execute: "Ran",
  fetch: "Fetched",
  think: "Reasoned",
};

export function formatToolCallUpdate(update: ToolCallUpdatePayload): FormattedToolCall | null {
  const title = typeof update.title === "string" ? update.title.trim() : "";
  if (title.length === 0) {
    return null;
  }

  const kind = typeof update.kind === "string" ? update.kind : "other";
  const status = typeof update.status === "string" ? update.status : "pending";
  const toolName = toolNameFromTitle(title);
  const paths = collectToolPaths(update, title);

  let summary = "Tool call";
  let detail: string | null = null;

  if (toolName === "apply_patch" || (toolName === "patch" && paths.length > 0)) {
    ({ summary, detail } = formatPatchSummary(update, title));
  } else if (toolName === "bash" || toolName === "shell" || kind === "execute") {
    ({ summary, detail } = formatExecuteSummary(title, update.rawInput));
  } else if (toolName === "read" || kind === "read") {
    ({ summary, detail } = formatPathList(paths, "Read"));
  } else if (toolName === "write" || toolName === "create") {
    ({ summary, detail } = formatPathList(paths, "Created"));
  } else if (toolName === "delete" || kind === "delete") {
    ({ summary, detail } = formatPathList(paths, "Deleted"));
  } else if (toolName === "grep" || toolName === "search" || toolName === "rg" || kind === "search") {
    const query =
      typeof asRecord(update.rawInput)?.pattern === "string"
        ? asRecord(update.rawInput)?.pattern
        : typeof asRecord(update.rawInput)?.query === "string"
          ? asRecord(update.rawInput)?.query
          : null;
    summary = query != null ? `Searched for "${summarizeText(query, 48)}"` : "Searched codebase";
  } else if (paths.length > 0) {
    const verb = KIND_VERBS[kind] ?? (toolName ? formatToolLabel(toolName) : "Updated");
    ({ summary, detail } = formatPathList(paths, verb));
  } else if (toolName) {
    summary = formatToolLabel(toolName);
  } else {
    summary = summarizeText(title, 96);
  }

  return { summary, detail, kind, status };
}

export function formatToolCallPayload(payload: unknown): FormattedToolCall | null {
  const record = asRecord(payload);
  const update = asRecord(record?.update);
  if (update == null) {
    return null;
  }

  const sessionUpdate = update.sessionUpdate;
  if (sessionUpdate !== "tool_call" && sessionUpdate !== "tool_call_update") {
    return null;
  }

  return formatToolCallUpdate(update);
}

export function extractToolCallUpdate(payload: unknown): ToolCallUpdatePayload | null {
  const record = asRecord(payload);
  const update = asRecord(record?.update);
  if (update == null) {
    return null;
  }

  const sessionUpdate = update.sessionUpdate;
  if (sessionUpdate !== "tool_call" && sessionUpdate !== "tool_call_update") {
    return null;
  }

  return update;
}

function stringifyJsonBlock(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function appendStructuredSection(lines: string[], heading: string, bodyLines: string[]): void {
  if (bodyLines.length === 0) {
    return;
  }
  lines.push(`### ${heading}`, "", ...bodyLines, "");
}

function formatScalarValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function formatToolInputLines(rawInput: unknown, title: string): string[] {
  if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    return trimmed.length > 0 ? [`- ${summarizeText(trimmed, 240)}`] : [];
  }

  const record = asRecord(rawInput);
  if (record == null) {
    return [];
  }

  const { command, cwd } = parseBashFields(title, rawInput);
  if (command != null) {
    const lines = [`- **Command:** \`${shortenCommand(command)}\``];
    if (cwd != null) {
      lines.push(`- **Working directory:** \`${cwd}\``);
    }
    return lines;
  }

  if (Array.isArray(record.changes)) {
    const lines = [`- **Changes:** ${record.changes.length} file${record.changes.length === 1 ? "" : "s"}`];
    for (const change of record.changes) {
      const changeRecord = asRecord(change);
      if (changeRecord == null) {
        continue;
      }
      const path = typeof changeRecord.path === "string" ? changeRecord.path : "unknown";
      const verb = changeVerbForPath(path, changeRecord.kind);
      lines.push(`  - ${verb} \`${basename(path)}\``);
    }
    return lines;
  }

  const path =
    typeof record.path === "string"
      ? record.path
      : typeof record.file_path === "string"
        ? record.file_path
        : typeof record.filePath === "string"
          ? record.filePath
          : null;
  if (path != null) {
    return [`- **Path:** \`${path}\``];
  }

  const query =
    typeof record.pattern === "string"
      ? record.pattern
      : typeof record.query === "string"
        ? record.query
        : null;
  if (query != null) {
    return [`- **Query:** \`${summarizeText(query, 120)}\``];
  }

  const simpleEntries = Object.entries(record).flatMap(([key, value]) => {
    const formatted = formatScalarValue(value);
    return formatted != null ? [[`${key}`, formatted] as const] : [];
  });

  if (simpleEntries.length > 0 && simpleEntries.length <= 8) {
    return simpleEntries.map(
      ([key, value]) => `- **${formatToolLabel(key)}:** \`${summarizeText(value, 160)}\``,
    );
  }

  const fallback = stringifyJsonBlock(rawInput);
  return fallback != null ? ["```", fallback, "```"] : [];
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function appendTextBlock(lines: string[], heading: string, text: string): void {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return;
  }
  lines.push(`**${heading}**`, "", "```", trimmed, "```", "");
}

function formatToolOutputLines(rawOutput: unknown): string[] {
  if (typeof rawOutput === "string") {
    const trimmed = rawOutput.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  const record = asRecord(rawOutput);
  if (record == null) {
    return [];
  }

  const lines: string[] = [];

  const status = formatScalarValue(record.status);
  if (status != null) {
    lines.push(`- **Status:** ${formatToolLabel(status)}`);
  }

  if (typeof record.exitCode === "number") {
    lines.push(`- **Exit code:** ${record.exitCode}`);
  }

  if (typeof record.durationMs === "number") {
    lines.push(`- **Duration:** ${formatDuration(record.durationMs)}`);
  }

  const error = formatScalarValue(record.error ?? record.errorMessage ?? record.message);
  if (error != null && record.status === "failed") {
    lines.push(`- **Error:** ${summarizeText(error, 200)}`);
  }

  for (const key of ["stdout", "stderr", "text", "output", "result"] as const) {
    const value = formatScalarValue(record[key]);
    if (value != null) {
      appendTextBlock(lines, formatToolLabel(key), value);
    }
  }

  if (lines.length === 0) {
    const simpleEntries = Object.entries(record).flatMap(([key, value]) => {
      const formatted = formatScalarValue(value);
      return formatted != null ? [[`${key}`, formatted] as const] : [];
    });
    if (simpleEntries.length > 0 && simpleEntries.length <= 8) {
      return simpleEntries.map(
        ([key, value]) => `- **${formatToolLabel(key)}:** \`${summarizeText(value, 160)}\``,
      );
    }

    const fallback = stringifyJsonBlock(rawOutput);
    return fallback != null ? ["```", fallback, "```"] : [];
  }

  return lines;
}

function extractToolContentText(update: ToolCallUpdatePayload): string | null {
  const content = update.content;
  if (!Array.isArray(content)) {
    return null;
  }

  const parts: string[] = [];
  for (const item of content) {
    const record = asRecord(item);
    if (record == null) {
      continue;
    }
    if (record.type === "content") {
      const nested = asRecord(record.content);
      if (typeof nested?.text === "string" && nested.text.trim().length > 0) {
        parts.push(nested.text.trim());
      }
    }
    if (record.type === "diff" && typeof record.path === "string") {
      const oldText = typeof record.oldText === "string" ? record.oldText : "";
      const newText = typeof record.newText === "string" ? record.newText : "";
      parts.push(`diff ${record.path}\n---\n${oldText}\n+++\n${newText}`);
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function appendMarkdownSection(lines: string[], heading: string, body: string | null): void {
  if (body == null || body.trim().length === 0) {
    return;
  }
  lines.push(`### ${heading}`, "", "```", body.trim(), "```", "");
}

export function formatToolCallMarkdown(
  update: ToolCallUpdatePayload,
  formatted: FormattedToolCall,
): string {
  const lines = [`**${formatted.summary}**`, ""];

  lines.push(`- **Status:** ${formatToolLabel(formatted.status)}`);
  lines.push(`- **Kind:** ${formatToolLabel(formatted.kind)}`);

  if (formatted.detail != null) {
    lines.push(`- **Detail:** \`${formatted.detail}\``);
  }

  const locations = parsePathsFromLocations(update);
  if (locations.length > 0) {
    lines.push("", "**Locations**", "");
    for (const path of locations) {
      lines.push(`- \`${path}\``);
    }
  }

  const title = typeof update.title === "string" ? update.title.trim() : "";
  if (title.length > 0 && title !== formatted.summary) {
    appendMarkdownSection(lines, "Title", title);
  }

  appendStructuredSection(lines, "Input", formatToolInputLines(update.rawInput, title));
  appendStructuredSection(lines, "Output", formatToolOutputLines(update.rawOutput));
  appendMarkdownSection(lines, "Content", extractToolContentText(update));

  return lines.join("\n").trim();
}
