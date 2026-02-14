use crate::models::{Character, Scene, ProvenanceEntry, Relationship, Location};
use crate::db::{self, DbState};
use crate::analysis::extraction;
use crate::provenance::ProvenanceManager;
use tauri::State;
use std::path::{Path, PathBuf};
use std::fs;
use rusqlite::Connection;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

#[tauri::command]
pub fn create_project(path: String) -> Result<(), String> {
    let root = Path::new(&path);
    if root.exists() {
        return Err("Directory already exists".to_string());
    }

    fs::create_dir_all(root.join("manuscript")).map_err(|e| e.to_string())?;
    fs::create_dir_all(root.join("context")).map_err(|e| e.to_string())?;
    fs::create_dir_all(root.join("provenance")).map_err(|e| e.to_string())?;
    fs::create_dir_all(root.join("ai")).map_err(|e| e.to_string())?;

    // Create initial empty files
    fs::write(root.join("context/characters.yaml"), "---\n[]").map_err(|e| e.to_string())?;
    fs::write(root.join("context/locations.yaml"), "---\n[]").map_err(|e| e.to_string())?;
    fs::write(root.join("context/timeline.yaml"), "---\n[]").map_err(|e| e.to_string())?;
    fs::write(root.join("context/relationships.graph.json"), "[]").map_err(|e| e.to_string())?;

    // Create DB
    let db_path = root.join("app.db");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::create_tables(&conn).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn load_project(path: String, state: State<'_, DbState>) -> Result<(), String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err("Project directory not found".to_string());
    }

    let db_path = root.join("app.db");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::create_tables(&conn).map_err(|e| e.to_string())?; // Ensure tables exist

    // Check if characters table is empty
    let count: i32 = conn.query_row("SELECT count(*) FROM characters", [], |row| row.get(0)).unwrap_or(0);
    if count == 0 {
        // Try loading from YAML
        if let Ok(content) = fs::read_to_string(root.join("context/characters.yaml")) {
             if let Ok(chars) = serde_yaml::from_str::<Vec<Character>>(&content) {
                 for c in chars {
                     // Insert into DB
                     conn.execute(
                        "INSERT OR REPLACE INTO characters (id, name, aliases, traits, voice_notes, goals, secrets, current_state, first_appearance, last_seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                        (
                            &c.id,
                            &c.name,
                            serde_json::to_string(&c.aliases).unwrap(),
                            serde_json::to_string(&c.traits).unwrap(),
                            &c.voice_notes,
                            &c.goals,
                            &c.secrets,
                            serde_json::to_string(&c.current_state).unwrap(),
                            &c.first_appearance,
                            &c.last_seen,
                        ),
                    ).map_err(|e| e.to_string())?;
                 }
             }
        }
    }

    {
        let mut db_conn = state.conn.lock().unwrap();
        *db_conn = Some(conn);
        let mut proj_path = state.project_path.lock().unwrap();
        *proj_path = Some(root.to_path_buf());
    }

    Ok(())
}

fn fetch_characters(conn: &Connection) -> Result<Vec<Character>, String> {
    let mut stmt = conn.prepare("SELECT id, name, aliases, traits, voice_notes, goals, secrets, current_state, first_appearance, last_seen FROM characters").map_err(|e| e.to_string())?;

    let character_iter = stmt.query_map([], |row| {
        Ok(Character {
            id: row.get(0)?,
            name: row.get(1)?,
            aliases: serde_json::from_str(&row.get::<_, String>(2)?).unwrap_or_default(),
            traits: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or_default(),
            voice_notes: row.get(4)?,
            goals: row.get(5)?,
            secrets: row.get(6)?,
            current_state: serde_json::from_str(&row.get::<_, String>(7)?).unwrap_or_default(),
            first_appearance: row.get(8)?,
            last_seen: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut characters = Vec::new();
    for char in character_iter {
        characters.push(char.map_err(|e| e.to_string())?);
    }
    Ok(characters)
}

#[tauri::command]
pub fn get_characters(state: State<'_, DbState>) -> Result<Vec<Character>, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or("No project loaded")?;
    fetch_characters(conn)
}

#[tauri::command]
pub fn get_locations(state: State<'_, DbState>) -> Result<Vec<Location>, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or("No project loaded")?;

    let mut stmt = conn.prepare("SELECT id, name, description, rules, adjacency FROM locations").map_err(|e| e.to_string())?;

    let iter = stmt.query_map([], |row| {
        Ok(Location {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            rules: row.get(3)?,
            adjacency: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
        })
    }).map_err(|e| e.to_string())?;

    let mut locations = Vec::new();
    for loc in iter {
        locations.push(loc.map_err(|e| e.to_string())?);
    }
    Ok(locations)
}

#[tauri::command]
pub fn get_relationships(state: State<'_, DbState>) -> Result<Vec<Relationship>, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or("No project loaded")?;

    let mut stmt = conn.prepare("SELECT from_id, to_id, relation_type, strength, since_chapter, notes FROM relationships").map_err(|e| e.to_string())?;

    let iter = stmt.query_map([], |row| {
        Ok(Relationship {
            from_id: row.get(0)?,
            to_id: row.get(1)?,
            relation_type: row.get(2)?,
            strength: row.get(3)?,
            since_chapter: row.get(4)?,
            notes: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut relationships = Vec::new();
    for rel in iter {
        relationships.push(rel.map_err(|e| e.to_string())?);
    }
    Ok(relationships)
}

fn export_characters(conn: &Connection, root: &Path) -> Result<(), String> {
    let characters = fetch_characters(conn)?;
    let yaml_content = serde_yaml::to_string(&characters).map_err(|e| e.to_string())?;
    fs::write(root.join("context/characters.yaml"), yaml_content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_character(character: Character, state: State<'_, DbState>) -> Result<(), String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or("No project loaded")?;

    conn.execute(
        "INSERT OR REPLACE INTO characters (id, name, aliases, traits, voice_notes, goals, secrets, current_state, first_appearance, last_seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        (
            &character.id,
            &character.name,
            serde_json::to_string(&character.aliases).unwrap(),
            serde_json::to_string(&character.traits).unwrap(),
            &character.voice_notes,
            &character.goals,
            &character.secrets,
            serde_json::to_string(&character.current_state).unwrap(),
            &character.first_appearance,
            &character.last_seen,
        ),
    ).map_err(|e| e.to_string())?;

    let project_path_guard = state.project_path.lock().unwrap();
    if let Some(root) = project_path_guard.as_ref() {
        export_characters(conn, root)?;
    }

    Ok(())
}

#[tauri::command]
pub fn save_scene(scene: Scene, content: String, state: State<'_, DbState>) -> Result<(), String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or("No project loaded")?;

    // extract entities
    let entities = extraction::extract_entities(&content);
    let participants: Vec<String> = entities.characters.into_iter().collect();
    let locations: Vec<String> = entities.locations.into_iter().collect();

    conn.execute(
        "INSERT OR REPLACE INTO scenes (id, title, scene_order, summary, pov, time_marker, location_ids, participants, extracted_facts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        (
            &scene.id,
            &scene.title,
            &scene.order,
            &scene.summary,
            &scene.pov,
            &scene.time_marker,
            serde_json::to_string(&locations).unwrap(),
            serde_json::to_string(&participants).unwrap(),
            serde_json::to_string(&scene.extracted_facts).unwrap(),
        ),
    ).map_err(|e| e.to_string())?;

    // Write to file
    let project_path_guard = state.project_path.lock().unwrap();
    if let Some(root) = project_path_guard.as_ref() {
        let filename = format!("chapter-{:03}.md", scene.order);
        let file_path = root.join("manuscript").join(&filename);

        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        let hash = format!("{:x}", hasher.finish());

        ProvenanceManager::log_edit(
            conn,
            &filename,
            0,
            content.len(),
            "save",
            false,
            None,
            &hash,
        )?;

        fs::write(file_path, &content).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_provenance(file_path: String, state: State<'_, DbState>) -> Result<Vec<ProvenanceEntry>, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or("No project loaded")?;

    let mut stmt = conn.prepare("SELECT id, timestamp, file_path, range_start, range_end, author_action, ai_involved, suggestion_id, diff_hash FROM provenance WHERE file_path = ?1 ORDER BY timestamp DESC").map_err(|e| e.to_string())?;

    let iter = stmt.query_map([&file_path], |row| {
        Ok(ProvenanceEntry {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            file_path: row.get(2)?,
            range_start: row.get(3)?,
            range_end: row.get(4)?,
            author_action: row.get(5)?,
            ai_involved: row.get(6)?,
            suggestion_id: row.get(7)?,
            diff_hash: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for entry in iter {
        entries.push(entry.map_err(|e| e.to_string())?);
    }
    Ok(entries)
}
