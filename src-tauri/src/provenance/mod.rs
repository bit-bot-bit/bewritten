use crate::models::ProvenanceEntry;
use rusqlite::Connection;
use chrono::Utc;
use uuid::Uuid;

pub struct ProvenanceManager;

impl ProvenanceManager {
    pub fn log_edit(
        conn: &Connection,
        file_path: &str,
        range_start: usize,
        range_end: usize,
        author_action: &str,
        ai_involved: bool,
        suggestion_id: Option<String>,
        diff_hash: &str,
    ) -> Result<(), String> {
        let entry = ProvenanceEntry {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().to_rfc3339(),
            file_path: file_path.to_string(),
            range_start,
            range_end,
            author_action: author_action.to_string(),
            ai_involved,
            suggestion_id,
            diff_hash: diff_hash.to_string(),
        };

        conn.execute(
            "INSERT INTO provenance (id, timestamp, file_path, range_start, range_end, author_action, ai_involved, suggestion_id, diff_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            (
                &entry.id,
                &entry.timestamp,
                &entry.file_path,
                &entry.range_start,
                &entry.range_end,
                &entry.author_action,
                entry.ai_involved as i32,
                &entry.suggestion_id,
                &entry.diff_hash,
            ),
        ).map_err(|e| e.to_string())?;

        Ok(())
    }
}
