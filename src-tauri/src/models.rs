use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub aliases: Vec<String>,
    pub traits: Vec<String>,
    pub voice_notes: Option<String>,
    pub goals: Option<String>,
    pub secrets: Option<String>,
    pub current_state: HashMap<String, String>, // e.g., "location": "Forest", "status": "Injured"
    pub first_appearance: Option<String>, // chapter_id
    pub last_seen: Option<String>, // chapter_id
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Location {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub rules: Option<String>,
    pub adjacency: Vec<String>, // list of location_ids
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Scene {
    pub id: String,
    pub title: String,
    pub order: i32,
    pub summary: Option<String>,
    pub pov: Option<String>, // character_id
    pub time_marker: Option<String>,
    pub location_ids: Vec<String>,
    pub participants: Vec<String>, // character_ids
    pub extracted_facts: Vec<String>, // fact_ids
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Fact {
    pub id: String,
    pub content: String,
    pub source_ref: String, // "chapter_id:line_number"
    pub confidence: f32, // 0.0 to 1.0
    pub active: bool,
    pub retconned_by: Option<String>, // fact_id
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Relationship {
    pub from_id: String,
    pub to_id: String,
    pub relation_type: String, // ally, rival, etc.
    pub strength: i32, // -100 to 100
    pub since_chapter: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineEvent {
    pub id: String,
    pub time_index: i32, // relative order
    pub description: String,
    pub participants: Vec<String>,
    pub location_id: Option<String>,
    pub dependencies: Vec<String>, // event_ids that must happen before
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProvenanceEntry {
    pub id: String,
    pub timestamp: String, // ISO8601
    pub file_path: String,
    pub range_start: usize,
    pub range_end: usize,
    pub author_action: String, // typed, paste, apply_suggestion
    pub ai_involved: bool,
    pub suggestion_id: Option<String>,
    pub diff_hash: String,
}
