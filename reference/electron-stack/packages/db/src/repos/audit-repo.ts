import type { SqliteDatabase } from "@db/client";
import type { IAuditRepo } from "@db/types/repo";
import type { AuditEventInput } from "@db/types/domain";

export class AuditRepo implements IAuditRepo {
  constructor(private readonly db: SqliteDatabase) {}

  insertAuditEvent(input: AuditEventInput): void {
    this.db
      .prepare(
        `INSERT INTO audit_events (id, project_id, issue_id, actor, action, payload_json)
         VALUES (@id, @projectId, @issueId, @actor, @action, @payloadJson)`,
      )
      .run({
        id: input.id,
        projectId: input.projectId ?? null,
        issueId: input.issueId ?? null,
        actor: input.actor ?? null,
        action: input.action,
        payloadJson: input.payloadJson ?? null,
      });
  }

  listAuditEvents(
    projectId: string,
  ): Array<{
    action: string;
    issueId: string | null;
    payloadJson: string | null;
    createdAt: string;
  }> {
    return this.db
      .prepare(
        `SELECT action, issue_id as issueId, payload_json as payloadJson, created_at as createdAt
         FROM audit_events
         WHERE project_id = ?
         ORDER BY created_at DESC`,
      )
      .all(projectId) as Array<{
      action: string;
      issueId: string | null;
      payloadJson: string | null;
      createdAt: string;
    }>;
  }
}
