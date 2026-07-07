use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::types::{AgentPatch, Agent, AgentSummary};

pub struct AgentRepo<'a> {
    conn: &'a Connection,
}

impl<'a> AgentRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create(&self, name: &str, acp_command: Option<&str>) -> DbResult<Agent> {
        let id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO agents (id, name, acp_command) VALUES (?1, ?2, ?3)",
            params![id, name, acp_command],
        )?;
        self.get(&id)?.ok_or_else(|| DbError::Internal("agent missing after create".into()))
    }

    pub fn get(&self, id: &str) -> DbResult<Option<Agent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, acp_command, created_at, updated_at
             FROM agents WHERE id = ?1",
        )?;

        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_agent(row)?));
        }
        Ok(None)
    }

    pub fn list_summaries(&self) -> DbResult<Vec<AgentSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name FROM agents ORDER BY name ASC",
        )?;
        let mut rows = stmt.query([])?;
        let mut summaries = Vec::new();
        while let Some(row) = rows.next()? {
            summaries.push(AgentSummary {
                id: row.get(0)?,
                name: row.get(1)?,
            });
        }
        Ok(summaries)
    }

    pub fn update(&self, id: &str, patch: &AgentPatch) -> DbResult<Agent> {
        let mut sets = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(name) = &patch.name {
            sets.push("name = ?");
            values.push(Box::new(name.clone()));
        }
        if let Some(acp_command) = &patch.acp_command {
            sets.push("acp_command = ?");
            values.push(Box::new(acp_command.as_str()));
        }

        if sets.is_empty() {
            return self
                .get(id)?
                .ok_or_else(|| DbError::NotFound(format!("agent {id}")));
        }

        sets.push("updated_at = datetime('now')");
        values.push(Box::new(id.to_string()));

        let sql = format!("UPDATE agents SET {} WHERE id = ?", sets.join(", "));
        let params: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|value| value.as_ref()).collect();

        let changed = self.conn.execute(&sql, params.as_slice())?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("agent {id}")));
        }

        self.get(id)?.ok_or_else(|| DbError::NotFound(format!("agent {id}")))
    }

    pub fn delete(&self, id: &str) -> DbResult<()> {
        let changed = self.conn.execute("DELETE FROM agents WHERE id = ?1", [id])?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("agent {id}")));
        }
        Ok(())
    }
}

fn map_agent(row: &Row<'_>) -> rusqlite::Result<Agent> {
    Ok(Agent {
        id: row.get(0)?,
        name: row.get(1)?,
        acp_command: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::open_test_db;

    #[test]
    fn create_and_get_agent() {
        let conn = open_test_db().expect("open test db");
        let repo = AgentRepo::new(&conn);
        let agent = repo
            .create("Test Agent", Some("echo"))
            .expect("create agent");

        let fetched = repo.get(&agent.id).expect("get agent").expect("agent exists");
        assert_eq!(fetched.name, "Test Agent");
    }
}
