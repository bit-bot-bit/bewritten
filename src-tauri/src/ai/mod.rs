use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct AiResponse {
    pub issues: Vec<String>,
}

pub trait AiProvider {
    fn review_continuity(&self, context: &str) -> Result<AiResponse, String>;
}

pub struct MockAiProvider;

impl AiProvider for MockAiProvider {
    fn review_continuity(&self, _context: &str) -> Result<AiResponse, String> {
        Ok(AiResponse {
            issues: vec!["Mock issue: Character voice seems inconsistent.".to_string()],
        })
    }
}
