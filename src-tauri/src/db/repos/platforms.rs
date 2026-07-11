use rusqlite::{params, Connection};

use crate::db::error::{DbError, DbResult};

pub struct PlatformsRepo<'a> {
    conn: &'a Connection,
}

impl<'a> PlatformsRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list(&self, project_id: &str) -> DbResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT platform
             FROM platforms
             WHERE project_id = ?1
             ORDER BY platform ASC",
        )?;
        let mut rows = stmt.query([project_id])?;
        let mut platforms = Vec::new();
        while let Some(row) = rows.next()? {
            platforms.push(row.get(0)?);
        }
        Ok(platforms)
    }

    pub fn is_connected(&self, project_id: &str, platform_id: &str) -> DbResult<bool> {
        let exists = self.conn.query_row(
            "SELECT 1 FROM platforms WHERE project_id = ?1 AND platform = ?2",
            params![project_id, platform_id],
            |_| Ok(()),
        );
        match exists {
            Ok(()) => Ok(true),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
            Err(err) => Err(DbError::from(err)),
        }
    }
}

pub fn write_platforms(conn: &Connection, project_id: &str, platforms: &[String]) -> DbResult<()> {
    conn.execute("DELETE FROM platforms WHERE project_id = ?1", [project_id])?;
    for platform_id in platforms {
        conn.execute(
            "INSERT INTO platforms (project_id, platform) VALUES (?1, ?2)",
            params![project_id, platform_id],
        )?;
    }
    Ok(())
}
