//! dispatch helpers: resolve project agent acp command for session start.

use rusqlite::Connection;

use crate::db::error::DbResult;
use crate::db::repos::agent::AgentRepo;
use crate::db::repos::project_agents::ProjectAgentsRepo;

pub struct DispatchAgent {
    pub name: String,
    pub acp_command: String,
}

pub fn resolve_dispatch_agent(
    conn: &Connection,
    project_id: &str,
) -> DbResult<Option<DispatchAgent>> {
    for agent_id in ProjectAgentsRepo::new(conn).list_agent_ids(project_id)? {
        let Some(agent) = AgentRepo::new(conn).get(&agent_id)? else {
            continue;
        };
        if let Some(command) = agent
            .acp_command
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Ok(Some(DispatchAgent {
                name: agent.name,
                acp_command: command.into(),
            }));
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repos::agent::AgentRepo;
    use crate::db::test_helpers::{open_test_db, seed_minimal_project};

    #[test]
    fn resolve_returns_first_assigned_agent_with_command() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        AgentRepo::new(&conn)
            .update(
                &fixtures.agent_id,
                &crate::types::AgentPatch {
                    acp_command: Some("opensymphony-mock-acp-agent".into()),
                    ..Default::default()
                },
            )
            .expect("set command");

        let agent = resolve_dispatch_agent(&conn, &fixtures.project_id)
            .expect("resolve")
            .expect("dispatch agent");
        assert_eq!(agent.acp_command, "opensymphony-mock-acp-agent");
    }
}
