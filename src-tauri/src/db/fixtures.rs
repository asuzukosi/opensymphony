use rusqlite::Connection;

use crate::db::error::DbResult;
use crate::db::migrate;

pub struct MinimalFixtures {
    pub project_id: String,
}

const TEST_WORKSPACE_ROOT: &str = "/tmp/opensymphony-test-workspace";

pub fn open_test_db() -> DbResult<Connection> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    migrate::migrate(&conn)?;
    Ok(conn)
}

pub fn seed_minimal_project(conn: &Connection) -> DbResult<MinimalFixtures> {
    std::fs::create_dir_all(TEST_WORKSPACE_ROOT).map_err(|err| {
        crate::db::error::DbError::Internal(format!("create test workspace root: {err}"))
    })?;

    let project_id = "test-project".into();

    conn.execute(
        "INSERT INTO projects (id, name, slug, workspace_root) VALUES (?1, ?2, ?3, ?4)",
        (&project_id, "Test Project", "test-project", TEST_WORKSPACE_ROOT),
    )?;
    conn.execute(
        "INSERT INTO platforms (project_id, platform) VALUES (?1, ?2)",
        (&project_id, "hermes"),
    )?;

    Ok(MinimalFixtures { project_id })
}
