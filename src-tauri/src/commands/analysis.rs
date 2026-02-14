use crate::analysis::extraction;
use crate::analysis::continuity;
use crate::ai::{MockAiProvider, AiProvider, OpenAiProvider, AiResponse};
use crate::models::{Scene, Character};
use crate::db::DbState;
use crate::settings_model::AppSettings;
use tauri::State;
use serde::Serialize;
use std::collections::{HashSet, HashMap};
use rusqlite::OptionalExtension;

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

    // 3. Run AI checks (configurable)

    // Fetch settings from DB
    let mut settings_stmt = conn.prepare("SELECT ai_provider, ai_base_url, ai_api_key, ai_model FROM settings WHERE id = 'config'").map_err(|e| e.to_string())?;
    let settings_res = settings_stmt.query_row([], |row| {
        Ok(AppSettings {
            ai_provider: row.get(0)?,
            ai_base_url: row.get(1)?,
            ai_api_key: row.get(2)?,
            ai_model: row.get(3)?,
        })
    }).optional().map_err(|e| e.to_string())?;

    let settings = settings_res.unwrap_or_default();

    let ai_resp = match settings.ai_provider.as_str() {
        "openai" | "ollama" => {
            let provider = OpenAiProvider {
                api_key: settings.ai_api_key.unwrap_or_default(),
                base_url: settings.ai_base_url.unwrap_or("https://api.openai.com/v1".to_string()),
                model: settings.ai_model.unwrap_or("gpt-3.5-turbo".to_string()),
            };
            provider.review_continuity(&scene.summary.clone().unwrap_or_default()).map_err(|e| e.to_string())?
        },
        "none" => AiResponse { issues: vec![] },
        _ => {
            // Default to mock if provider unknown or not configured
            // Actually, if settings.ai_provider is "none", return empty
            // If it's empty string or "mock", use mock.
            let provider = MockAiProvider;
            provider.review_continuity(&scene.summary.clone().unwrap_or_default()).map_err(|e| e.to_string())?
        }
    };

    Ok(ContinuityResult {
        local_issues,
        ai_issues: ai_resp.issues,
    })
}

#[tauri::command]
pub fn recalculate_relationships(state: State<'_, DbState>) -> Result<(), String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or("No project loaded")?;

    // 1. Fetch all scenes and their participants
    let mut stmt = conn.prepare("SELECT participants FROM scenes").map_err(|e| e.to_string())?;
    let participants_iter = stmt.query_map([], |row| {
        let p_str: String = row.get(0)?;
        let p_vec: Vec<String> = serde_json::from_str(&p_str).unwrap_or_default();
        Ok(p_vec)
    }).map_err(|e| e.to_string())?;

    let mut co_occurrences: HashMap<(String, String), i32> = HashMap::new();

    for p_result in participants_iter {
        let participants = p_result.map_err(|e| e.to_string())?;
        // Generate pairs
        for i in 0..participants.len() {
            for j in (i + 1)..participants.len() {
                let mut pair = vec![participants[i].clone(), participants[j].clone()];
                pair.sort(); // Ensure consistent ordering
                let key = (pair[0].clone(), pair[1].clone());
                *co_occurrences.entry(key).or_insert(0) += 1;
            }
        }
    }

    // 2. Update DB
    for ((p1, p2), count) in co_occurrences {
        let strength = count * 10;

        // Check if exists
        let exists: i32 = conn.query_row(
            "SELECT count(*) FROM relationships WHERE from_id = ?1 AND to_id = ?2",
            [&p1, &p2],
            |row| row.get(0)
        ).unwrap_or(0);

        if exists > 0 {
            // Update strength
            conn.execute(
                "UPDATE relationships SET strength = ?1 WHERE from_id = ?2 AND to_id = ?3",
                (strength, &p1, &p2),
            ).map_err(|e| e.to_string())?;
        } else {
            // Insert new
            conn.execute(
                "INSERT INTO relationships (from_id, to_id, relation_type, strength, since_chapter, notes) VALUES (?1, ?2, 'co-occurrence', ?3, NULL, 'Auto-generated')",
                (&p1, &p2, strength),
            ).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
