use crate::db::DbState;
use crate::settings_model::AppSettings;
use tauri::State;
use rusqlite::OptionalExtension;

#[tauri::command]
pub fn get_settings(state: State<'_, DbState>) -> Result<AppSettings, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or("No project loaded")?;

    let mut stmt = conn.prepare("SELECT ai_provider, ai_base_url, ai_api_key, ai_model FROM settings WHERE id = 'config'").map_err(|e| e.to_string())?;

    let settings = stmt.query_row([], |row| {
        Ok(AppSettings {
            ai_provider: row.get(0)?,
            ai_base_url: row.get(1)?,
            ai_api_key: row.get(2)?,
            ai_model: row.get(3)?,
        })
    }).optional().map_err(|e| e.to_string())?;

    Ok(settings.unwrap_or_default())
}

#[tauri::command]
pub fn save_settings(settings: AppSettings, state: State<'_, DbState>) -> Result<(), String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or("No project loaded")?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (id, ai_provider, ai_base_url, ai_api_key, ai_model) VALUES ('config', ?1, ?2, ?3, ?4)",
        (
            &settings.ai_provider,
            &settings.ai_base_url,
            &settings.ai_api_key,
            &settings.ai_model,
        ),
    ).map_err(|e| e.to_string())?;

    Ok(())
}
