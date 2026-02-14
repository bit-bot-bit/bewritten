use regex::Regex;
use lazy_static::lazy_static;
use std::collections::HashSet;

lazy_static! {
    static ref CHARACTER_REGEX: Regex = Regex::new(r"@([A-Za-z0-9_]+)").unwrap();
    static ref LOCATION_REGEX: Regex = Regex::new(r"#([A-Za-z0-9_]+)").unwrap();
}

pub struct ExtractedEntities {
    pub characters: HashSet<String>,
    pub locations: HashSet<String>,
}

pub fn extract_entities(text: &str) -> ExtractedEntities {
    let mut characters = HashSet::new();
    let mut locations = HashSet::new();

    for cap in CHARACTER_REGEX.captures_iter(text) {
        if let Some(m) = cap.get(1) {
            characters.insert(m.as_str().to_string());
        }
    }

    for cap in LOCATION_REGEX.captures_iter(text) {
        if let Some(m) = cap.get(1) {
            locations.insert(m.as_str().to_string());
        }
    }

    ExtractedEntities {
        characters,
        locations,
    }
}
