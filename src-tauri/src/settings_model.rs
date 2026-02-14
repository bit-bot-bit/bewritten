use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppSettings {
    pub ai_provider: String, // "none", "openai", "ollama"
    pub ai_base_url: Option<String>,
    pub ai_api_key: Option<String>,
    pub ai_model: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            ai_provider: "none".to_string(),
            ai_base_url: None,
            ai_api_key: None,
            ai_model: None,
        }
    }
}
