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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repos::project::ProjectRepo;
    use crate::db::test_helpers::open_test_db;

    #[test]
    fn set_and_get_active_project_id() {
        let conn = open_test_db().expect("open test db");
        let project_repo = ProjectRepo::new(&conn);
        let project = project_repo.create("Active Project").expect("create project");
        let repo = AppStateRepo::new(&conn);

        repo.set_active_project_id(Some(&project.id))
            .expect("set active project id");

        let active = repo
            .get_active_project_id()
            .expect("get active project id");
        assert_eq!(active.as_deref(), Some(project.id.as_str()));
    }
}
