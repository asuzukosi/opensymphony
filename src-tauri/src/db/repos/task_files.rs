use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::types::TaskFile;

pub struct TaskFilesRepo<'a> {
    conn: &'a Connection,
}

impl<'a> TaskFilesRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list(&self, task_id: &str) -> DbResult<Vec<TaskFile>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, task_id, file_name, mime_type, size_bytes, created_at
             FROM task_files
             WHERE task_id = ?1
             ORDER BY created_at ASC",
        )?;
        let mut rows = stmt.query([task_id])?;
        let mut files = Vec::new();
        while let Some(row) = rows.next()? {
            files.push(map_task_file(row)?);
        }
        Ok(files)
    }

    pub fn attach(
        &self,
        app_data_dir: &Path,
        task_id: &str,
        source_paths: &[String],
    ) -> DbResult<Vec<TaskFile>> {
        if source_paths.is_empty() {
            return Ok(Vec::new());
        }

        let dest_dir = task_files_dir(app_data_dir, task_id);
        fs::create_dir_all(&dest_dir).map_err(|err| DbError::Internal(err.to_string()))?;

        let mut attached = Vec::new();
        for source_path in source_paths {
            let source = PathBuf::from(source_path);
            if !source.is_file() {
                return Err(DbError::Internal(format!(
                    "file not found: {source_path}"
                )));
            }

            let file_name = source
                .file_name()
                .and_then(|name| name.to_str())
                .ok_or_else(|| DbError::Internal("invalid file name".into()))?
                .to_string();
            let file_id = Uuid::new_v4().to_string();
            let stored_path = dest_dir.join(format!("{file_id}_{file_name}"));
            fs::copy(&source, &stored_path).map_err(|err| DbError::Internal(err.to_string()))?;

            let size_bytes = fs::metadata(&stored_path)
                .map_err(|err| DbError::Internal(err.to_string()))?
                .len() as i64;
            let mime_type = mime_type_for_name(&file_name);

            self.conn.execute(
                "INSERT INTO task_files (id, task_id, file_name, stored_path, mime_type, size_bytes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    file_id,
                    task_id,
                    file_name,
                    stored_path.to_string_lossy().as_ref(),
                    mime_type,
                    size_bytes,
                ],
            )?;

            attached.push(
                self.get(&file_id)?
                    .ok_or_else(|| DbError::Internal("file missing after insert".into()))?,
            );
        }

        Ok(attached)
    }

    fn get(&self, file_id: &str) -> DbResult<Option<TaskFile>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, task_id, file_name, mime_type, size_bytes, created_at
             FROM task_files WHERE id = ?1",
        )?;
        let mut rows = stmt.query([file_id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_task_file(row)?));
        }
        Ok(None)
    }
}

fn task_files_dir(app_data_dir: &Path, task_id: &str) -> PathBuf {
    app_data_dir.join("tasks").join(task_id).join("files")
}

fn mime_type_for_name(file_name: &str) -> Option<String> {
    let extension = file_name.rsplit('.').next()?.to_ascii_lowercase();
    Some(match extension.as_str() {
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "json" => "application/json",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
    .into())
}

fn map_task_file(row: &Row<'_>) -> rusqlite::Result<TaskFile> {
    Ok(TaskFile {
        file_id: row.get(0)?,
        task_id: row.get(1)?,
        file_name: row.get(2)?,
        mime_type: row.get(3)?,
        size_bytes: row.get(4)?,
        created_at: row.get(5)?,
    })
}
