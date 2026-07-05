import type { SqliteDatabase } from "@db/client";
import type { ICommentRepo } from "@db/types/repo";
import type { IssueCommentRow } from "@db/types/domain";

export class CommentRepo implements ICommentRepo {
  constructor(private readonly db: SqliteDatabase) {}

  addComment(input: IssueCommentRow): void {
    this.db
      .prepare(
        `INSERT INTO issue_comments (id, issue_id, body, author_id) VALUES (@id, @issueId, @body, @authorId)`,
      )
      .run(input);
  }

  listComments(issueId: string): IssueCommentRow[] {
    return this.db
      .prepare(
        `SELECT id, issue_id as issueId, body, author_id as authorId
         FROM issue_comments
         WHERE issue_id = ?
         ORDER BY created_at ASC`,
      )
      .all(issueId) as IssueCommentRow[];
  }
}
