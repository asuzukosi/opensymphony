# @symphony/db

SQLite persistence layer for Symphony.

## Contents

- Migration files (`migrations/`).
- Database client and migration runner.
- Repository interfaces + implementations for domain entities.
- Aggregated `createTrackerStore(...)` composition.

## Domain Coverage

- Projects, workflow states, issues.
- Dependencies, comments, labels, assignments.
- Run attempts, agent sessions, retry queue.
- Audit events.

## Notes

- Uses `better-sqlite3`.
- Core and desktop runtime interact through repository/store interfaces, not ad hoc SQL.
