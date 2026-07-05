import { randomUUID } from "node:crypto";
import type { SqliteDatabase } from "@db/client";
import type { AppendSessionEventInput, SessionEventRow } from "@db/types/domain";
import type { ISessionEventRepo } from "@db/types/repo";

export const SESSION_EVENT_TAIL_CAP = 500;

export class SessionEventRepo implements ISessionEventRepo {
  constructor(private readonly db: SqliteDatabase) {}

  append(input: AppendSessionEventInput): SessionEventRow {
    const row: SessionEventRow = {
      id: input.id ?? randomUUID(),
      sessionId: input.sessionId,
      kind: input.kind,
      payloadJson: JSON.stringify(input.payload ?? null),
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO session_events (id, session_id, kind, payload_json, created_at)
           VALUES (@id, @sessionId, @kind, @payloadJson, @createdAt)`,
        )
        .run(row);

      this.db
        .prepare(
          `DELETE FROM session_events
           WHERE session_id = @sessionId
             AND id NOT IN (
               SELECT id FROM session_events
               WHERE session_id = @sessionId
               ORDER BY created_at DESC, rowid DESC
               LIMIT @tailCap
             )`,
        )
        .run({ sessionId: row.sessionId, tailCap: SESSION_EVENT_TAIL_CAP });
    });

    tx();
    return row;
  }

  listBySessionId(sessionId: string): SessionEventRow[] {
    return this.db
      .prepare(
        `SELECT id, session_id as sessionId, kind, payload_json as payloadJson, created_at as createdAt
         FROM session_events
         WHERE session_id = ?
         ORDER BY created_at ASC, rowid ASC`,
      )
      .all(sessionId) as SessionEventRow[];
  }
}
