use rusqlite::Connection;

use crate::db::error::DbResult;

pub struct AppStateRepo<'a> {
    conn: &'a Connection,
}

impl<'a> AppStateRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_active_project_id(&self) -> DbResult<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT active_project_id FROM app_state WHERE id = 1")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            return Ok(row.get(0)?);
        }
        Ok(None)
    }

    pub fn set_active_project_id(&self, project_id: Option<&str>) -> DbResult<()> {
        self.conn.execute(
            "UPDATE app_state SET active_project_id = ?1 WHERE id = 1",
            [project_id],
        )?;
        Ok(())
    }
}

