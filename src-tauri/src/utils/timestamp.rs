use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};

use crate::db::error::{DbError, DbResult};

pub fn format_timestamp(value: DateTime<Utc>) -> String {
    value.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

pub fn parse_timestamp(value: &str) -> DbResult<DateTime<Utc>> {
    if let Ok(parsed) = DateTime::parse_from_rfc3339(value) {
        return Ok(parsed.with_timezone(&Utc));
    }

    if let Ok(parsed) = NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S") {
        return Ok(Utc.from_utc_datetime(&parsed));
    }

    Err(DbError::Internal(format!("invalid timestamp: {value}")))
}
