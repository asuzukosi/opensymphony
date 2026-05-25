export type LogLevel = "info" | "warn" | "error";

export interface StructuredLogEvent {
  level: LogLevel;
  event: string;
  message: string;
  projectId?: string;
  issueId?: string;
  issueIdentifier?: string;
  runAttemptId?: string;
  sessionId?: string;
  runtimeKind?: string;
  error?: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export class StructuredLoggerService {
  info(event: Omit<StructuredLogEvent, "timestamp" | "level">): void {
    this.write({ ...event, level: "info", timestamp: new Date().toISOString() });
  }

  warn(event: Omit<StructuredLogEvent, "timestamp" | "level">): void {
    this.write({ ...event, level: "warn", timestamp: new Date().toISOString() });
  }

  error(event: Omit<StructuredLogEvent, "timestamp" | "level">): void {
    this.write({ ...event, level: "error", timestamp: new Date().toISOString() });
  }

  private write(event: StructuredLogEvent): void {
    // JSON-line logs for reliable parsing by external observability pipelines.
    const line = JSON.stringify(event);
    if (event.level === "error") {
      console.error(line);
      return;
    }
    if (event.level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }
}
