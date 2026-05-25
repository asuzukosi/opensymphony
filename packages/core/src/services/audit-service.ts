import type { IAuditRepo } from "@symphony/db";

export class AuditService {
  constructor(private readonly audits: IAuditRepo) {}

  write(input: {
    id: string;
    projectId: string;
    issueId: string;
    actor?: string;
    action: string;
    payload: unknown;
  }): void {
    this.audits.insertAuditEvent({
      id: input.id,
      projectId: input.projectId,
      issueId: input.issueId,
      actor: input.actor,
      action: input.action,
      payloadJson: JSON.stringify(input.payload),
    });
  }

  list(projectId: string) {
    return this.audits.listAuditEvents(projectId);
  }
}
