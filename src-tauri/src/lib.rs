pub mod models;
pub mod db;
pub mod commands;
pub mod analysis;
pub mod provenance;
pub mod ai;
pub mod settings_model;

use tauri::Manager;
use std::sync::Mutex;
use rusqlite::Connection;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize empty database state
            app.manage(db::DbState {
                conn: Mutex::new(None),
                project_path: Mutex::new(None),
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::project::create_project,
            commands::project::load_project,
            commands::project::get_characters,
            commands::project::get_locations,
            commands::project::get_relationships,
            commands::project::save_character,
            commands::project::save_scene,
            commands::project::get_provenance,
            commands::analysis::analyze_text,
            commands::analysis::check_continuity,
            commands::analysis::recalculate_relationships, // Added new command
            commands::settings::get_settings,
            commands::settings::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
