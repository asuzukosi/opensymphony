use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};

pub struct Agent {
    pub id: String,
    pub name: String,
    pub acp_command: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub struct AgentSummary {
    pub id: String,
    pub name: String,
}

#[derive(Default)]
pub struct AgentPatch {
    pub name: Option<String>,
    pub acp_command: Option<String>,
}

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

        assert_eq!(agent.name, "Test Agent");
        assert_eq!(agent.acp_command.as_deref(), Some("echo"));
        assert!(!agent.created_at.is_empty());
        assert!(!agent.updated_at.is_empty());

        let fetched = repo.get(&agent.id).expect("get agent").expect("agent exists");
        assert_eq!(fetched.id, agent.id);
        assert_eq!(fetched.name, "Test Agent");
    }

    #[test]
    fn list_summaries_returns_agents() {
        let conn = open_test_db().expect("open test db");
        let repo = AgentRepo::new(&conn);
        repo.create("Alpha Agent", None).expect("create alpha");
        repo.create("Beta Agent", None).expect("create beta");

        let summaries = repo.list_summaries().expect("list summaries");
        assert_eq!(summaries.len(), 2);
        assert_eq!(summaries[0].name, "Alpha Agent");
        assert_eq!(summaries[1].name, "Beta Agent");
    }

    #[test]
    fn update_applies_patch_fields() {
        let conn = open_test_db().expect("open test db");
        let repo = AgentRepo::new(&conn);
        let agent = repo.create("Original", Some("echo")).expect("create agent");

        let updated = repo
            .update(
                &agent.id,
                &AgentPatch {
                    name: Some("Renamed".into()),
                    acp_command: Some("node agent.js".into()),
                },
            )
            .expect("update agent");

        assert_eq!(updated.name, "Renamed");
        assert_eq!(updated.acp_command.as_deref(), Some("node agent.js"));
    }

    #[test]
    fn delete_removes_agent() {
        let conn = open_test_db().expect("open test db");
        let repo = AgentRepo::new(&conn);
        let agent = repo.create("Delete Me", None).expect("create agent");

        repo.delete(&agent.id).expect("delete agent");
        assert!(repo.get(&agent.id).expect("get agent").is_none());
    }

    #[test]
    fn delete_missing_agent_returns_not_found() {
        let conn = open_test_db().expect("open test db");
        let repo = AgentRepo::new(&conn);
        let err = repo.delete("missing-agent").expect_err("delete missing");
        assert!(matches!(err, DbError::NotFound(_)));
    }
}
