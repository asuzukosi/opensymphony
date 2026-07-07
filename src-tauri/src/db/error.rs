use rusqlite::Error as RusqliteError;
use rusqlite::ErrorCode;
use thiserror::Error;

pub type DbResult<T> = Result<T, DbError>;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("not found: {0}")]
    NotFound(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("constraint violation: {0}")]
    Constraint(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl From<DbError> for String {
    fn from(err: DbError) -> String {
        err.to_string()
    }
}

impl From<RusqliteError> for DbError {
    fn from(err: RusqliteError) -> Self {
        if matches!(err, RusqliteError::QueryReturnedNoRows) {
            return DbError::NotFound("row not found".into());
        }

        if let RusqliteError::SqliteFailure(sqlite_err, msg) = &err {
            let message = msg.clone().unwrap_or_else(|| err.to_string());
            if sqlite_err.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE {
                return DbError::Conflict(message);
            }
            if sqlite_err.code == ErrorCode::ConstraintViolation {
                return DbError::Constraint(message);
            }
        }

        DbError::Internal(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_found_converts_to_string() {
        let message: String = DbError::NotFound("issue".into()).into();
        assert_eq!(message, "not found: issue");
    }

    #[test]
    fn rusqlite_no_rows_maps_to_not_found() {
        let err = DbError::from(RusqliteError::QueryReturnedNoRows);
        assert!(matches!(err, DbError::NotFound(_)));
    }
}
