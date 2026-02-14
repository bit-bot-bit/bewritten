use crate::analysis::extraction;
use crate::analysis::continuity;
use crate::ai::{MockAiProvider, AiProvider};
use crate::models::{Scene, Character};
use crate::db::DbState;
use tauri::State;
use serde::Serialize;
use std::collections::HashSet;

#[derive(Serialize)]
pub struct AnalysisResult {
    pub characters: HashSet<String>,
    pub locations: HashSet<String>,
}

#[derive(Serialize)]
pub struct ContinuityResult {
    pub local_issues: Vec<continuity::ContinuityIssue>,
    pub ai_issues: Vec<String>,
}

#[tauri::command]
pub fn analyze_text(text: String) -> AnalysisResult {
    let entities = extraction::extract_entities(&text);
    AnalysisResult {
        characters: entities.characters,
        locations: entities.locations,
    }
}

#[tauri::command]
pub fn check_continuity(scene: Scene, state: State<'_, DbState>) -> Result<ContinuityResult, String> {
    // 1. Fetch relevant characters
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or("No project loaded")?;

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

    // 2. Run local checks
    let local_issues = continuity::check_local_continuity(&scene, &characters);

    // 3. Run AI checks (mock)
    let ai_provider = MockAiProvider;
    let ai_resp = ai_provider.review_continuity(&scene.summary.clone().unwrap_or_default()).map_err(|e| e.to_string())?;

    Ok(ContinuityResult {
        local_issues,
        ai_issues: ai_resp.issues,
    })
}
