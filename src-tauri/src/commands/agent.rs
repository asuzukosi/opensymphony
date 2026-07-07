use tauri::State;

use crate::db::error::DbError;
use crate::db::repos::agent::AgentRepo;
use crate::db::repos::project_agents::ProjectAgentsRepo;
use crate::db::Db;
use crate::types::{Agent, AgentPatch, AgentSummary};

// reads

#[tauri::command(rename = "opensymphony:list-agent-summaries")]
pub fn list_agent_summaries(db: State<Db>) -> Result<Vec<AgentSummary>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    AgentRepo::new(&conn)
        .list_summaries()
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:get-agent")]
pub fn get_agent(db: State<Db>, agent_id: String) -> Result<Agent, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    AgentRepo::new(&conn)
        .get(&agent_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| DbError::NotFound(format!("agent {agent_id}")).to_string())
}

#[tauri::command(rename = "opensymphony:list-project-agent-ids")]
pub fn list_project_agent_ids(
    db: State<Db>,
    project_id: String,
) -> Result<Vec<String>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    ProjectAgentsRepo::new(&conn)
        .list_agent_ids(&project_id)
        .map_err(|err| err.to_string())
}

// writes

#[tauri::command(rename = "opensymphony:create-agent")]
pub fn create_agent(
    db: State<Db>,
    name: String,
    acp_command: Option<String>,
) -> Result<Agent, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    AgentRepo::new(&conn)
        .create(&name, acp_command.as_deref())
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:delete-agent")]
pub fn delete_agent(db: State<Db>, agent_id: String) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    AgentRepo::new(&conn)
        .delete(&agent_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:set-agent-name")]
pub fn set_agent_name(db: State<Db>, agent_id: String, name: String) -> Result<String, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let agent = AgentRepo::new(&conn)
        .update(
            &agent_id,
            &AgentPatch {
                name: Some(name),
                ..AgentPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;
    Ok(agent.name)
}

#[tauri::command(rename = "opensymphony:set-agent-acp-command")]
pub fn set_agent_acp_command(
    db: State<Db>,
    agent_id: String,
    acp_command: Option<String>,
) -> Result<Option<String>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let agent = AgentRepo::new(&conn)
        .update(
            &agent_id,
            &AgentPatch {
                acp_command: acp_command.clone(),
                ..AgentPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;
    Ok(agent.acp_command)
}

#[tauri::command(rename = "opensymphony:assign-agent-to-project")]
pub fn assign_agent_to_project(
    db: State<Db>,
    project_id: String,
    agent_id: String,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    ProjectAgentsRepo::new(&conn)
        .assign(&project_id, &agent_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:unassign-agent-from-project")]
pub fn unassign_agent_from_project(
    db: State<Db>,
    project_id: String,
    agent_id: String,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    ProjectAgentsRepo::new(&conn)
        .unassign(&project_id, &agent_id)
        .map_err(|err| err.to_string())
}
