use rusqlite::Connection;
use uuid::Uuid;

use crate::db::error::DbResult;
use crate::db::migrate;

pub struct MinimalFixtures {
    pub project_id: String,
    pub agent_id: String,
    pub backlog_issue_id: String,
    pub in_progress_issue_id: String,
    pub review_issue_id: String,
    pub done_issue_id: String,
}

pub struct SessionFixtures {
    pub project_id: String,
    pub issue_id: String,
    pub run_attempt_id: String,
    pub session_id: String,
}

pub fn open_test_db() -> DbResult<Connection> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    migrate::migrate(&conn)?;
    Ok(conn)
}

pub fn seed_minimal_project(conn: &Connection) -> DbResult<MinimalFixtures> {
    let project_id = "test-project".into();
    let agent_id = "test-agent".into();
    let backlog_issue_id = "test-issue-backlog".into();
    let in_progress_issue_id = "test-issue-in-progress".into();
    let review_issue_id = "test-issue-review".into();
    let done_issue_id = "test-issue-done".into();

    conn.execute(
        "INSERT INTO projects (id, name, slug) VALUES (?1, ?2, ?3)",
        (&project_id, "Test Project", "test-project"),
    )?;
    conn.execute(
        "INSERT INTO agents (id, name, acp_command) VALUES (?1, ?2, ?3)",
        (&agent_id, "Test Agent", "echo"),
    )?;
    conn.execute(
        "INSERT INTO project_agents (project_id, agent_id) VALUES (?1, ?2)",
        (&project_id, &agent_id),
    )?;

    let issues = [
        (&backlog_issue_id, "SYM-1", "Backlog issue", "backlog"),
        (&in_progress_issue_id, "SYM-2", "In progress issue", "inProgress"),
        (&review_issue_id, "SYM-3", "Review issue", "review"),
        (&done_issue_id, "SYM-4", "Done issue", "done"),
    ];

    for (id, identifier, title, board_column) in issues {
        conn.execute(
            "INSERT INTO issues (id, project_id, identifier, title, board_column)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (id, &project_id, identifier, title, board_column),
        )?;
    }

    Ok(MinimalFixtures {
        project_id,
        agent_id,
        backlog_issue_id,
        in_progress_issue_id,
        review_issue_id,
        done_issue_id,
    })
}

pub fn seed_issue_with_session(conn: &Connection) -> DbResult<SessionFixtures> {
    let project_id = Uuid::new_v4().to_string();
    let issue_id = Uuid::new_v4().to_string();
    let run_attempt_id = Uuid::new_v4().to_string();
    let session_id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO projects (id, name, slug) VALUES (?1, ?2, ?3)",
        (&project_id, "Session Project", "session-project"),
    )?;
    conn.execute(
        "INSERT INTO issues (id, project_id, identifier, title, board_column)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        (
            &issue_id,
            &project_id,
            "SYM-SESSION-1",
            "Session issue",
            "inProgress",
        ),
    )?;
    conn.execute(
        "INSERT INTO run_attempts (id, issue_id, attempt_number, status)
         VALUES (?1, ?2, ?3, ?4)",
        (&run_attempt_id, &issue_id, 1, "running"),
    )?;
    conn.execute(
        "INSERT INTO agent_sessions (id, run_attempt_id, runtime_kind, status)
         VALUES (?1, ?2, ?3, ?4)",
        (&session_id, &run_attempt_id, "acp", "running"),
    )?;

    let events = [
        ("Prompt", r#"{"text":"start"}"#),
        ("StreamChunk", r#"{"text":"chunk"}"#),
        ("SessionUpdate", r#"{"status":"streaming"}"#),
    ];

    for (kind, payload_json) in events {
        conn.execute(
            "INSERT INTO session_events (id, session_id, kind, payload_json)
             VALUES (?1, ?2, ?3, ?4)",
            (&Uuid::new_v4().to_string(), &session_id, kind, payload_json),
        )?;
    }

    Ok(SessionFixtures {
        project_id,
        issue_id,
        run_attempt_id,
        session_id,
    })
}
