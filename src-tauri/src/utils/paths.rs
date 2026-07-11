use std::path::{Path, PathBuf};

pub fn project_data_dir(app_data_dir: &Path, project_id: &str) -> PathBuf {
    app_data_dir.join("projects").join(project_id)
}
