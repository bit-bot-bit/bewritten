pub mod extraction;
pub mod continuity;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Character, Scene};
    use std::collections::HashMap;

    #[test]
    fn test_extraction() {
        let text = "Hello @Alice, meet me at #ThePark.";
        let entities = extraction::extract_entities(text);
        assert!(entities.characters.contains("Alice"));
        assert!(entities.locations.contains("ThePark"));
    }

    #[test]
    fn test_continuity_dead_character() {
        let mut state = HashMap::new();
        state.insert("status".to_string(), "dead".to_string());

        let character = Character {
            id: "1".to_string(),
            name: "Bob".to_string(),
            aliases: vec![],
            traits: vec![],
            voice_notes: None,
            goals: None,
            secrets: None,
            current_state: state,
            first_appearance: None,
            last_seen: None,
        };

        let scene = Scene {
            id: "s1".to_string(),
            title: "Scene 1".to_string(),
            order: 1,
            summary: None,
            pov: None,
            time_marker: None,
            location_ids: vec![],
            participants: vec!["Bob".to_string()],
            extracted_facts: vec![],
        };

        let issues = continuity::check_local_continuity(&scene, &[character]);
        assert!(!issues.is_empty());
        assert_eq!(issues[0].severity, "error");
    }
}
