use std::collections::HashMap;
use std::str::FromStr;

use rusqlite::{params, Connection, Row};

use crate::db::error::DbResult;
use crate::types::{
    ActivityTimeRange, AgentActivityOverTimeBucket, AgentActivityOverTimeResponse,
    AgentActivitySummary, SessionEventKind,
};
use crate::utils::{
    bucket_index, build_bucket_starts, format_bucket_start, format_timestamp, parse_activity_time_range,
    parse_timestamp,
};

pub struct AnalyticsRepo<'a> {
    conn: &'a Connection,
}

impl<'a> AnalyticsRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list_agent_activity_over_time(
        &self,
        time_range: &ActivityTimeRange,
        project_id: Option<&str>,
    ) -> DbResult<AgentActivityOverTimeResponse> {
        let (start, end, bucket_ms) = parse_activity_time_range(time_range)?;
        let bucket_starts = build_bucket_starts(start, end, bucket_ms);
        let summary = self.activity_summary(start, end, project_id)?;

        if bucket_starts.is_empty() {
            return Ok(AgentActivityOverTimeResponse {
                buckets: Vec::new(),
                summary: Some(summary),
            });
        }

        let buckets = match project_id {
            Some(project_id) => {
                self.buckets_for_project(project_id, start, end, bucket_ms, &bucket_starts)?
            }
            None => self.buckets_global(start, end, bucket_ms, &bucket_starts)?,
        };

        Ok(AgentActivityOverTimeResponse {
            buckets,
            summary: Some(summary),
        })
    }

    fn buckets_for_project(
        &self,
        project_id: &str,
        start: chrono::DateTime<chrono::Utc>,
        end: chrono::DateTime<chrono::Utc>,
        bucket_ms: u64,
        bucket_starts: &[chrono::DateTime<chrono::Utc>],
    ) -> DbResult<Vec<AgentActivityOverTimeBucket>> {
        let project_name = self.project_name(project_id)?;
        let mut buckets: Vec<AgentActivityOverTimeBucket> = bucket_starts
            .iter()
            .map(|bucket_start| AgentActivityOverTimeBucket {
                bucket_start: format_bucket_start(*bucket_start),
                total_events: 0,
                by_kind: HashMap::new(),
                project_id: Some(project_id.to_string()),
                project_name: project_name.clone(),
            })
            .collect();

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
                crate::db::error::DbError::Internal(format!("unknown session event kind: {kind}"))
            })?;
            bucket.total_events += 1;
            *bucket.by_kind.entry(kind).or_insert(0) += 1;
        }

        Ok(buckets)
    }

    fn buckets_global(
        &self,
        start: chrono::DateTime<chrono::Utc>,
        end: chrono::DateTime<chrono::Utc>,
        bucket_ms: u64,
        bucket_starts: &[chrono::DateTime<chrono::Utc>],
    ) -> DbResult<Vec<AgentActivityOverTimeBucket>> {
        let mut buckets: HashMap<(usize, String), AgentActivityOverTimeBucket> = HashMap::new();

        let mut stmt = self.conn.prepare(
            "SELECT se.kind, se.created_at, i.project_id, p.name
             FROM session_events se
             JOIN agent_sessions s ON s.id = se.session_id
             JOIN run_attempts ra ON ra.id = s.run_attempt_id
             JOIN issues i ON i.id = ra.issue_id
             JOIN projects p ON p.id = i.project_id
             WHERE se.kind != 'StreamChunk'
               AND se.created_at >= ?1
               AND se.created_at < ?2
             ORDER BY se.created_at ASC",
        )?;
        let mut rows = stmt.query(params![format_timestamp(start), format_timestamp(end)])?;

        while let Some(row) = rows.next()? {
            let kind: String = row.get(0)?;
            let created_at: String = row.get(1)?;
            let project_id: String = row.get(2)?;
            let project_name: String = row.get(3)?;
            let event_time = parse_timestamp(&created_at)?;
            if event_time < start || event_time >= end {
                continue;
            }

            let bucket_index = bucket_index(start, event_time, bucket_ms);
            if bucket_index >= bucket_starts.len() {
                continue;
            }

            let kind = SessionEventKind::from_str(&kind).map_err(|()| {
                crate::db::error::DbError::Internal(format!("unknown session event kind: {kind}"))
            })?;

            let bucket = buckets
                .entry((bucket_index, project_id.clone()))
                .or_insert_with(|| AgentActivityOverTimeBucket {
                    bucket_start: format_bucket_start(bucket_starts[bucket_index]),
                    total_events: 0,
                    by_kind: HashMap::new(),
                    project_id: Some(project_id),
                    project_name: Some(project_name),
                });
            bucket.total_events += 1;
            *bucket.by_kind.entry(kind).or_insert(0) += 1;
        }

        let mut result: Vec<_> = buckets.into_values().collect();
        result.sort_by(|left, right| {
            left.bucket_start
                .cmp(&right.bucket_start)
                .then_with(|| left.project_name.cmp(&right.project_name))
        });
        Ok(result)
    }

    fn activity_summary(
        &self,
        start: chrono::DateTime<chrono::Utc>,
        end: chrono::DateTime<chrono::Utc>,
        project_id: Option<&str>,
    ) -> DbResult<AgentActivitySummary> {
        let start_at = format_timestamp(start);
        let end_at = format_timestamp(end);

        let (total_events, run_attempt_count, session_count) = match project_id {
            Some(project_id) => {
                let mut stmt = self.conn.prepare(
                    "SELECT
                       (SELECT COUNT(*)
                        FROM session_events se
                        JOIN agent_sessions s ON s.id = se.session_id
                        JOIN run_attempts ra ON ra.id = s.run_attempt_id
                        JOIN issues i ON i.id = ra.issue_id
                        WHERE i.project_id = ?1
                          AND se.kind != 'StreamChunk'
                          AND se.created_at >= ?2
                          AND se.created_at < ?3) AS total_events,
                       (SELECT COUNT(DISTINCT ra.id)
                        FROM run_attempts ra
                        JOIN issues i ON i.id = ra.issue_id
                        WHERE i.project_id = ?1
                          AND ra.started_at >= ?2
                          AND ra.started_at < ?3) AS run_attempt_count,
                       (SELECT COUNT(DISTINCT s.id)
                        FROM agent_sessions s
                        JOIN run_attempts ra ON ra.id = s.run_attempt_id
                        JOIN issues i ON i.id = ra.issue_id
                        WHERE i.project_id = ?1
                          AND s.started_at >= ?2
                          AND s.started_at < ?3) AS session_count",
                )?;
                let row = stmt.query_row(params![project_id, start_at, end_at], map_summary_row)?;
                row
            }
            None => {
                let mut stmt = self.conn.prepare(
                    "SELECT
                       (SELECT COUNT(*)
                        FROM session_events se
                        WHERE se.kind != 'StreamChunk'
                          AND se.created_at >= ?1
                          AND se.created_at < ?2) AS total_events,
                       (SELECT COUNT(DISTINCT ra.id)
                        FROM run_attempts ra
                        WHERE ra.started_at >= ?1
                          AND ra.started_at < ?2) AS run_attempt_count,
                       (SELECT COUNT(DISTINCT s.id)
                        FROM agent_sessions s
                        WHERE s.started_at >= ?1
                          AND s.started_at < ?2) AS session_count",
                )?;
                let row = stmt.query_row(params![start_at, end_at], map_summary_row)?;
                row
            }
        };

        Ok(AgentActivitySummary {
            total_events,
            run_attempt_count,
            session_count,
        })
    }

    fn project_name(&self, project_id: &str) -> DbResult<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT name FROM projects WHERE id = ?1")?;
        let mut rows = stmt.query([project_id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(row.get(0)?));
        }
        Ok(None)
    }
}

fn map_summary_row(row: &Row<'_>) -> rusqlite::Result<(u32, u32, u32)> {
    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::fixtures::open_test_db;
    use chrono::{Duration, TimeZone, Utc};
    use rusqlite::params;
    use uuid::Uuid;

    fn seed_project(conn: &Connection, id: &str, name: &str) {
        conn.execute(
            "INSERT INTO projects (id, name, slug, workspace_root) VALUES (?1, ?2, ?3, '/tmp/test')",
            params![id, name, id],
        )
        .expect("seed project");
    }

    fn seed_activity_chain(
        conn: &Connection,
        project_id: &str,
        started_at: &str,
    ) -> (String, String) {
        let issue_id = Uuid::new_v4().to_string();
        let attempt_id = Uuid::new_v4().to_string();
        let session_id = Uuid::new_v4().to_string();
        let identifier = format!("ISS-{}", &issue_id[..8]);

        conn.execute(
            "INSERT INTO issues (id, project_id, identifier, title, executor)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![issue_id, project_id, identifier, "Test issue", "hermes"],
        )
        .expect("seed issue");
        conn.execute(
            "INSERT INTO run_attempts (id, issue_id, attempt_number, status, started_at)
             VALUES (?1, ?2, 1, 'running', ?3)",
            params![attempt_id, issue_id, started_at],
        )
        .expect("seed run attempt");
        conn.execute(
            "INSERT INTO agent_sessions (id, run_attempt_id, runtime_kind, status, started_at)
             VALUES (?1, ?2, 'acp', 'running', ?3)",
            params![session_id, attempt_id, started_at],
        )
        .expect("seed agent session");

        (session_id, attempt_id)
    }

    fn append_session_event(
        conn: &Connection,
        session_id: &str,
        created_at: &str,
        kind: &str,
    ) {
        let event_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO session_events (id, session_id, kind, payload_json, created_at)
             VALUES (?1, ?2, ?3, '{}', ?4)",
            params![event_id, session_id, kind, created_at],
        )
        .expect("seed session event");
    }

    fn test_time_range(start: chrono::DateTime<Utc>, hours: i64) -> ActivityTimeRange {
        ActivityTimeRange {
            start_at: format_timestamp(start),
            end_at: format_timestamp(start + Duration::hours(hours)),
            bucket_ms: 3_600_000,
        }
    }

    #[test]
    fn list_agent_activity_over_time_global_combines_projects() {
        let conn = open_test_db().expect("open test db");
        seed_project(&conn, "project-a", "Alpha");
        seed_project(&conn, "project-b", "Beta");

        let range_start = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();
        let event_time = format_timestamp(range_start + Duration::minutes(30));

        let (session_a, _) = seed_activity_chain(&conn, "project-a", &event_time);
        let (session_b, _) = seed_activity_chain(&conn, "project-b", &event_time);
        append_session_event(&conn, &session_a, &event_time, "Prompt");
        append_session_event(&conn, &session_b, &event_time, "ToolCall");

        let repo = AnalyticsRepo::new(&conn);
        let response = repo
            .list_agent_activity_over_time(&test_time_range(range_start, 2), None)
            .expect("global activity query");

        assert_eq!(response.buckets.len(), 2);
        assert_eq!(
            response.summary,
            Some(AgentActivitySummary {
                total_events: 2,
                run_attempt_count: 2,
                session_count: 2,
            })
        );

        let project_ids: Vec<_> = response
            .buckets
            .iter()
            .filter_map(|bucket| bucket.project_id.clone())
            .collect();
        assert!(project_ids.contains(&"project-a".to_string()));
        assert!(project_ids.contains(&"project-b".to_string()));
    }

    #[test]
    fn list_agent_activity_over_time_filtered_matches_single_project() {
        let conn = open_test_db().expect("open test db");
        seed_project(&conn, "project-a", "Alpha");
        seed_project(&conn, "project-b", "Beta");

        let range_start = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();
        let event_time = format_timestamp(range_start + Duration::minutes(30));

        let (session_a, _) = seed_activity_chain(&conn, "project-a", &event_time);
        let (session_b, _) = seed_activity_chain(&conn, "project-b", &event_time);
        append_session_event(&conn, &session_a, &event_time, "Prompt");
        append_session_event(&conn, &session_a, &event_time, "Error");
        append_session_event(&conn, &session_b, &event_time, "ToolCall");

        let repo = AnalyticsRepo::new(&conn);
        let time_range = test_time_range(range_start, 2);

        let filtered = repo
            .list_agent_activity_over_time(&time_range, Some("project-a"))
            .expect("filtered activity query");

        assert_eq!(
            filtered.summary,
            Some(AgentActivitySummary {
                total_events: 2,
                run_attempt_count: 1,
                session_count: 1,
            })
        );
        assert_eq!(
            filtered.buckets[0].project_id.as_deref(),
            Some("project-a")
        );
        assert_eq!(
            filtered.buckets[0].project_name.as_deref(),
            Some("Alpha")
        );
        assert_eq!(filtered.buckets[0].total_events, 2);
    }
}
