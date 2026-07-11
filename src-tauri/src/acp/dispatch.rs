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
    #[test]
    #[ignore = "agent registry removed in V1d; rewrite in V4 dispatch resolver"]
    fn resolve_returns_first_assigned_agent_with_command() {}
}
