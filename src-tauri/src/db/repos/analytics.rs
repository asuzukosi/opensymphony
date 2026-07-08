use std::collections::HashMap;
use std::str::FromStr;

use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use rusqlite::{params, Connection};

use crate::db::error::{DbError, DbResult};
use crate::orchestrator::audit;
use crate::types::{
    ActivityTimeRange, AgentActivityOverTimeBucket, AgentActivityOverTimeResponse,
    PermissionActivityOverTimeBucket, PermissionActivityOverTimeResponse, SessionEventKind,
};

pub struct AnalyticsRepo<'a> {
    conn: &'a Connection,
}

impl<'a> AnalyticsRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn agent_activity_over_time(
        &self,
        project_id: &str,
        time_range: &ActivityTimeRange,
    ) -> DbResult<AgentActivityOverTimeResponse> {
        let (start, end, bucket_ms) = parse_time_range(time_range)?;
        let bucket_starts = build_bucket_starts(start, end, bucket_ms);
        let mut buckets: Vec<AgentActivityOverTimeBucket> = bucket_starts
            .iter()
            .map(|bucket_start| AgentActivityOverTimeBucket {
                bucket_start: format_timestamp(*bucket_start),
                total_events: 0,
                by_kind: HashMap::new(),
            })
            .collect();

        if buckets.is_empty() {
            return Ok(AgentActivityOverTimeResponse { buckets });
        }

        let mut stmt = self.conn.prepare(
            "SELECT se.kind, se.created_at
             FROM session_events se
             JOIN agent_sessions s ON s.id = se.session_id
             JOIN run_attempts ra ON ra.id = s.run_attempt_id
             JOIN issues i ON i.id = ra.issue_id
             WHERE i.project_id = ?1
               AND se.kind != 'StreamChunk'
               AND se.created_at >= ?2
               AND se.created_at < ?3
             ORDER BY se.created_at ASC",
        )?;
        let mut rows = stmt.query(params![
            project_id,
            format_timestamp(start),
            format_timestamp(end),
        ])?;

        while let Some(row) = rows.next()? {
            let kind: String = row.get(0)?;
            let created_at: String = row.get(1)?;
            let event_time = parse_timestamp(&created_at)?;
            if event_time < start || event_time >= end {
                continue;
            }

            let bucket_index = bucket_index(start, event_time, bucket_ms);
            let Some(bucket) = buckets.get_mut(bucket_index) else {
                continue;
            };

            let kind = SessionEventKind::from_str(&kind).map_err(|()| {
                DbError::Internal(format!("unknown session event kind: {kind}"))
            })?;
            bucket.total_events += 1;
            *bucket.by_kind.entry(kind).or_insert(0) += 1;
        }

        Ok(AgentActivityOverTimeResponse { buckets })
    }

    pub fn permission_activity_over_time(
        &self,
        project_id: &str,
        time_range: &ActivityTimeRange,
    ) -> DbResult<PermissionActivityOverTimeResponse> {
        let (start, end, bucket_ms) = parse_time_range(time_range)?;
        let bucket_starts = build_bucket_starts(start, end, bucket_ms);
        let mut buckets: Vec<PermissionActivityOverTimeBucket> = bucket_starts
            .iter()
            .map(|bucket_start| PermissionActivityOverTimeBucket {
                bucket_start: format_timestamp(*bucket_start),
                active_pending: 0,
                requests_opened: 0,
                requests_resolved: 0,
            })
            .collect();

        if buckets.is_empty() {
            return Ok(PermissionActivityOverTimeResponse { buckets });
        }

        let opened_events = self.list_permission_request_times(project_id, start, end)?;
        let resolved_events = self.list_permission_resolved_times(project_id, start, end)?;

        for bucket in &mut buckets {
            let bucket_start = parse_timestamp(&bucket.bucket_start)?;
            let bucket_end = bucket_start + chrono::Duration::milliseconds(bucket_ms as i64);

            bucket.requests_opened = opened_events
                .iter()
                .filter(|timestamp| **timestamp >= bucket_start && **timestamp < bucket_end)
                .count() as u32;

            bucket.requests_resolved = resolved_events
                .iter()
                .filter(|timestamp| **timestamp >= bucket_start && **timestamp < bucket_end)
                .count() as u32;

            let opened_before_end = opened_events
                .iter()
                .filter(|timestamp| **timestamp < bucket_end)
                .count() as u32;
            let resolved_before_end = resolved_events
                .iter()
                .filter(|timestamp| **timestamp < bucket_end)
                .count() as u32;

            bucket.active_pending = opened_before_end.saturating_sub(resolved_before_end);
        }

        Ok(PermissionActivityOverTimeResponse { buckets })
    }

    fn list_permission_request_times(
        &self,
        project_id: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> DbResult<Vec<DateTime<Utc>>> {
        let mut stmt = self.conn.prepare(
            "SELECT se.created_at
             FROM session_events se
             JOIN agent_sessions s ON s.id = se.session_id
             JOIN run_attempts ra ON ra.id = s.run_attempt_id
             JOIN issues i ON i.id = ra.issue_id
             WHERE i.project_id = ?1
               AND se.kind = 'PermissionRequest'
               AND se.created_at >= ?2
               AND se.created_at < ?3
             ORDER BY se.created_at ASC",
        )?;
        self.collect_timestamps(&mut stmt, project_id, start, end)
    }

    fn list_permission_resolved_times(
        &self,
        project_id: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> DbResult<Vec<DateTime<Utc>>> {
        let mut stmt = self.conn.prepare(
            "SELECT created_at
             FROM audit_events
             WHERE project_id = ?1
               AND action = ?2
               AND created_at >= ?3
               AND created_at < ?4
             ORDER BY created_at ASC",
        )?;
        let mut rows = stmt.query(params![
            project_id,
            audit::action::PERMISSION_RESOLVED,
            format_timestamp(start),
            format_timestamp(end),
        ])?;
        let mut timestamps = Vec::new();
        while let Some(row) = rows.next()? {
            timestamps.push(parse_timestamp(&row.get::<_, String>(0)?)?);
        }
        Ok(timestamps)
    }

    fn collect_timestamps(
        &self,
        stmt: &mut rusqlite::Statement<'_>,
        project_id: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> DbResult<Vec<DateTime<Utc>>> {
        let mut rows = stmt.query(params![
            project_id,
            format_timestamp(start),
            format_timestamp(end),
        ])?;
        let mut timestamps = Vec::new();
        while let Some(row) = rows.next()? {
            timestamps.push(parse_timestamp(&row.get::<_, String>(0)?)?);
        }
        Ok(timestamps)
    }
}

fn parse_time_range(
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

fn build_bucket_starts(start: DateTime<Utc>, end: DateTime<Utc>, bucket_ms: u64) -> Vec<DateTime<Utc>> {
    let bucket_duration = chrono::Duration::milliseconds(bucket_ms as i64);
    let mut bucket_starts = Vec::new();
    let mut cursor = start;

    while cursor < end {
        bucket_starts.push(cursor);
        cursor += bucket_duration;
    }

    bucket_starts
}

fn bucket_index(start: DateTime<Utc>, event_time: DateTime<Utc>, bucket_ms: u64) -> usize {
    let offset_ms = (event_time - start).num_milliseconds().max(0) as u64;
    (offset_ms / bucket_ms) as usize
}

fn format_timestamp(value: DateTime<Utc>) -> String {
    value.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn parse_timestamp(value: &str) -> DbResult<DateTime<Utc>> {
    if let Ok(parsed) = DateTime::parse_from_rfc3339(value) {
        return Ok(parsed.with_timezone(&Utc));
    }

    if let Ok(parsed) = NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S") {
        return Ok(Utc.from_utc_datetime(&parsed));
    }

    Err(DbError::Internal(format!("invalid timestamp: {value}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::{open_test_db, seed_issue_with_session};
    use uuid::Uuid;

    #[test]
    fn agent_activity_excludes_stream_chunk_and_buckets_events() -> DbResult<()> {
        let conn = open_test_db()?;
        let fixtures = seed_issue_with_session(&conn)?;

        conn.execute(
            "DELETE FROM session_events WHERE session_id = ?1",
            params![fixtures.session_id],
        )?;

        let events = [
            ("Prompt", r#"{"text":"start"}"#, "2020-01-01T00:05:00Z"),
            ("StreamChunk", r#"{"text":"chunk"}"#, "2020-01-01T00:10:00Z"),
            (
                "SessionUpdate",
                r#"{"status":"streaming"}"#,
                "2020-01-01T00:20:00Z",
            ),
        ];

        for (kind, payload_json, created_at) in events {
            conn.execute(
                "INSERT INTO session_events (id, session_id, kind, payload_json, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    Uuid::new_v4().to_string(),
                    fixtures.session_id,
                    kind,
                    payload_json,
                    created_at,
                ],
            )?;
        }

        let start = Utc.with_ymd_and_hms(2020, 1, 1, 0, 0, 0).unwrap();
        let end = start + chrono::Duration::hours(1);
        let response = AnalyticsRepo::new(&conn).agent_activity_over_time(
            &fixtures.project_id,
            &ActivityTimeRange {
                start_at: format_timestamp(start),
                end_at: format_timestamp(end),
                bucket_ms: 15 * 60 * 1000,
            },
        )?;

        assert_eq!(response.buckets.len(), 4);
        let total_events: u32 = response.buckets.iter().map(|bucket| bucket.total_events).sum();
        assert_eq!(total_events, 2);
        assert!(response
            .buckets
            .iter()
            .flat_map(|bucket| bucket.by_kind.keys())
            .all(|kind| *kind != SessionEventKind::StreamChunk));

        Ok(())
    }

    #[test]
    fn permission_activity_tracks_open_resolve_and_active_pending() -> DbResult<()> {
        let conn = open_test_db()?;
        let fixtures = seed_issue_with_session(&conn)?;

        conn.execute(
            "INSERT INTO session_events (id, session_id, kind, payload_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                Uuid::new_v4().to_string(),
                fixtures.session_id,
                "PermissionRequest",
                r#"{"summary":"approve tool"}"#,
                "2020-01-01T00:10:00Z",
            ],
        )?;
        conn.execute(
            "INSERT INTO audit_events (id, project_id, issue_id, action, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                Uuid::new_v4().to_string(),
                fixtures.project_id,
                fixtures.issue_id,
                audit::action::PERMISSION_RESOLVED,
                "2020-01-01T00:40:00Z",
            ],
        )?;

        let response = AnalyticsRepo::new(&conn).permission_activity_over_time(
            &fixtures.project_id,
            &ActivityTimeRange {
                start_at: "2020-01-01T00:00:00Z".into(),
                end_at: "2020-01-01T01:00:00Z".into(),
                bucket_ms: 15 * 60 * 1000,
            },
        )?;

        assert_eq!(response.buckets.len(), 4);
        assert_eq!(response.buckets[0].requests_opened, 1);
        assert_eq!(response.buckets[1].requests_opened, 0);
        assert_eq!(response.buckets[2].requests_resolved, 1);
        assert_eq!(response.buckets[0].active_pending, 1);
        assert_eq!(response.buckets[1].active_pending, 1);
        assert_eq!(response.buckets[2].active_pending, 0);
        assert_eq!(response.buckets[3].active_pending, 0);

        Ok(())
    }
}
