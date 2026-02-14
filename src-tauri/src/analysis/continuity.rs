use crate::models::{Character, Scene};
use serde::Serialize;

#[derive(Serialize)]
pub struct ContinuityIssue {
    pub severity: String,
    pub message: String,
    pub entity_id: Option<String>,
}

pub fn check_local_continuity(scene: &Scene, characters: &[Character]) -> Vec<ContinuityIssue> {
    let mut issues = Vec::new();

    for participant_name in &scene.participants {
        if let Some(character) = characters.iter().find(|c| &c.name == participant_name) {
             if let Some(state) = character.current_state.get("status") {
                 if state == "dead" {
                     issues.push(ContinuityIssue {
                         severity: "error".to_string(),
                         message: format!("Character {} is dead but appears in this scene.", character.name),
                         entity_id: Some(character.id.clone()),
                     });
                 }
             }
        }
    }

    issues
}
