use rusqlite::{Connection, Result};
use std::sync::Mutex;
use std::path::PathBuf;

pub struct DbState {
    pub conn: Mutex<Option<Connection>>,
    pub project_path: Mutex<Option<PathBuf>>,
}

pub fn create_tables(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS characters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            aliases TEXT, -- JSON array
            traits TEXT, -- JSON array
            voice_notes TEXT,
            goals TEXT,
            secrets TEXT,
            current_state TEXT, -- JSON map
            first_appearance TEXT,
            last_seen TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS locations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            rules TEXT,
            adjacency TEXT -- JSON array of IDs
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS scenes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            scene_order INTEGER,
            summary TEXT,
            pov TEXT,
            time_marker TEXT,
            location_ids TEXT, -- JSON array
            participants TEXT, -- JSON array
            extracted_facts TEXT -- JSON array
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS facts (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            source_ref TEXT,
            confidence REAL,
            active INTEGER, -- boolean
            retconned_by TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS relationships (
            from_id TEXT,
            to_id TEXT,
            relation_type TEXT,
            strength INTEGER,
            since_chapter TEXT,
            notes TEXT,
            PRIMARY KEY (from_id, to_id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS timeline_events (
            id TEXT PRIMARY KEY,
            time_index INTEGER,
            description TEXT,
            participants TEXT, -- JSON array
            location_id TEXT,
            dependencies TEXT -- JSON array
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS provenance (
            id TEXT PRIMARY KEY,
            timestamp TEXT,
            file_path TEXT,
            range_start INTEGER,
            range_end INTEGER,
            author_action TEXT,
            ai_involved INTEGER,
            suggestion_id TEXT,
            diff_hash TEXT
        )",
        [],
    )?;

    Ok(())
}
