import type { SqliteDatabase } from "@db/client";
import type { IAgentSessionRepo } from "@db/types/repo";
import type { AgentSessionRow } from "@db/types/domain";

export class AgentSessionRepo implements IAgentSessionRepo {
  constructor(private readonly db: SqliteDatabase) {}

  createSession(input: {
    id: string;
    runAttemptId: string;
    runtimeKind: string;
    sessionRef?: string | null;
    status: "running" | "succeeded" | "failed" | "cancelled";
  }): void {
    this.db
      .prepare(
        `INSERT INTO agent_sessions (id, run_attempt_id, runtime_kind, session_ref, status)
         VALUES (@id, @runAttemptId, @runtimeKind, @sessionRef, @status)`,
      )
      .run({ ...input, sessionRef: input.sessionRef ?? null });
  }

  updateSessionStatus(
    sessionId: string,
    status: "running" | "succeeded" | "failed" | "cancelled",
  ): void {
    this.db
      .prepare(
        `UPDATE agent_sessions
         SET status = ?, finished_at = CASE WHEN ? = 'running' THEN NULL ELSE datetime('now') END
         WHERE id = ?`,
      )
      .run(status, status, sessionId);
  }

  listSessionsByRunAttempt(runAttemptId: string): AgentSessionRow[] {
    return this.db
      .prepare(
        `SELECT id, run_attempt_id as runAttemptId, runtime_kind as runtimeKind,
                session_ref as sessionRef, status, started_at as startedAt, finished_at as finishedAt
         FROM agent_sessions
         WHERE run_attempt_id = ?
         ORDER BY started_at ASC`,
      )
      .all(runAttemptId) as AgentSessionRow[];
  }
}
