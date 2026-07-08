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

