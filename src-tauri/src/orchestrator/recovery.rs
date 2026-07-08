use chrono::Utc;

use crate::db::error::DbResult;
use crate::db::repos::agent_session::AgentSessionRepo;
use crate::db::repos::retry_queue::RetryQueueRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::types::Project;

use super::poll::schedule_retry;

const RECOVERED_ERROR: &str = "recovered_after_restart";

pub(crate) fn recover_stale_runs(
    attempts: &RunAttemptRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    project: &Project,
) -> DbResult<u32> {
    let now_iso = Utc::now()
        .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
    let mut recovered = 0u32;

    for attempt in attempts.list_running(&project.id)? {
        for session in sessions.list_by_run_attempt(&attempt.id)? {
            if session.status == "running" {
                sessions.finish(&session.id, "failed", &now_iso)?;
            }
        }

        attempts.finish(&attempt.id, "failed", Some(RECOVERED_ERROR))?;
        schedule_retry(
            retries,
            project,
            &attempt.issue_id,
            attempt.attempt_number + 1,
            Some(RECOVERED_ERROR),
        )?;
        recovered = recovered.saturating_add(1);
    }

    Ok(recovered)
}
