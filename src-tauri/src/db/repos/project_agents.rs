use rusqlite::{params, Connection};

use crate::db::error::{DbError, DbResult};

pub struct ProjectAgentsRepo<'a> {
    conn: &'a Connection,
}

impl<'a> ProjectAgentsRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn assign(&self, project_id: &str, agent_id: &str) -> DbResult<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO project_agents (project_id, agent_id) VALUES (?1, ?2)",
            params![project_id, agent_id],
        )?;
        Ok(())
    }

    pub fn unassign(&self, project_id: &str, agent_id: &str) -> DbResult<()> {
        let changed = self.conn.execute(
            "DELETE FROM project_agents WHERE project_id = ?1 AND agent_id = ?2",
            params![project_id, agent_id],
        )?;
        if changed == 0 {
            return Err(DbError::NotFound(format!(
                "project agent assignment {project_id}/{agent_id}"
            )));
        }
        Ok(())
    }

    pub fn list_agent_ids(&self, project_id: &str) -> DbResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT agent_id FROM project_agents
             WHERE project_id = ?1
             ORDER BY created_at ASC",
        )?;
        let mut rows = stmt.query([project_id])?;
        let mut agent_ids = Vec::new();
        while let Some(row) = rows.next()? {
            agent_ids.push(row.get(0)?);
        }
        Ok(agent_ids)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repos::agent::AgentRepo;
    use crate::db::repos::project::ProjectRepo;
    use crate::db::test_helpers::open_test_db;

    #[test]
    fn assign_unassign_and_list_agent_ids() {
        let conn = open_test_db().expect("open test db");
        let project_repo = ProjectRepo::new(&conn);
        let agent_repo = AgentRepo::new(&conn);
        let repo = ProjectAgentsRepo::new(&conn);

        let project = project_repo.create("Test Project").expect("create project");
        let agent_a = agent_repo.create("Agent A", None).expect("create agent a");
        let agent_b = agent_repo.create("Agent B", None).expect("create agent b");

        repo.assign(&project.id, &agent_a.id)
            .expect("assign agent a");
        repo.assign(&project.id, &agent_b.id)
            .expect("assign agent b");
        // duplicate assign should be ignored
        repo.assign(&project.id, &agent_a.id)
            .expect("reassign agent a");

        let agent_ids = repo
            .list_agent_ids(&project.id)
            .expect("list agent ids");
        assert_eq!(agent_ids, vec![agent_a.id.clone(), agent_b.id.clone()]);

        repo.unassign(&project.id, &agent_a.id)
            .expect("unassign agent a");

        let remaining = repo
            .list_agent_ids(&project.id)
            .expect("list remaining agent ids");
        assert_eq!(remaining, vec![agent_b.id]);
    }

    #[test]
    fn unassign_missing_returns_not_found() {
        let conn = open_test_db().expect("open test db");
        let project_repo = ProjectRepo::new(&conn);
        let agent_repo = AgentRepo::new(&conn);
        let repo = ProjectAgentsRepo::new(&conn);

        let project = project_repo.create("Test Project").expect("create project");
        let agent = agent_repo.create("Agent", None).expect("create agent");

        let err = repo
            .unassign(&project.id, &agent.id)
            .expect_err("unassign missing");
        assert!(matches!(err, DbError::NotFound(_)));
    }
}
