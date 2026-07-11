use chrono::{DateTime, Utc};

use crate::db::error::{DbError, DbResult};
use crate::types::ActivityTimeRange;
use crate::utils::timestamp::{format_timestamp, parse_timestamp};

pub fn parse_activity_time_range(
    time_range: &ActivityTimeRange,
) -> DbResult<(DateTime<Utc>, DateTime<Utc>, u64)> {
    if time_range.bucket_ms == 0 {
        return Err(DbError::Internal("bucket_ms must be greater than zero".into()));
    }

    let start = parse_timestamp(&time_range.start_at)?;
    let end = parse_timestamp(&time_range.end_at)?;
    if start >= end {
        return Err(DbError::Internal("start_at must be before end_at".into()));
    }

    Ok((start, end, time_range.bucket_ms))
}

pub fn build_bucket_starts(
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    bucket_ms: u64,
) -> Vec<DateTime<Utc>> {
    let bucket_duration = chrono::Duration::milliseconds(bucket_ms as i64);
    let mut bucket_starts = Vec::new();
    let mut cursor = start;

    while cursor < end {
        bucket_starts.push(cursor);
        cursor += bucket_duration;
    }

    bucket_starts
}

pub fn bucket_index(start: DateTime<Utc>, event_time: DateTime<Utc>, bucket_ms: u64) -> usize {
    let offset_ms = (event_time - start).num_milliseconds().max(0) as u64;
    (offset_ms / bucket_ms) as usize
}

pub fn format_bucket_start(value: DateTime<Utc>) -> String {
    format_timestamp(value)
}
