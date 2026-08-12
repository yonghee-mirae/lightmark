// Config schema mirrors docs/CONFIG_SPEC.md exactly (same field names/defaults as
// frontend/src/types/config.ts's DEFAULT_CONFIG) so a config.json written by hand or by either
// side round-trips without surprises.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Config {
    pub theme: String,
    pub custom_css: String,
    pub font_family: String,
    pub code_font_family: String,
    pub zoom: u32,
    pub toc_visible: bool,
    pub breadcrumb_visible: bool,
    pub syntax_highlight: bool,
    pub mermaid: bool,
    pub mermaid_theme: String,
    pub katex: bool,
    pub auto_reload: bool,
    pub print_use_light_theme: bool,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            theme: "github-light".to_string(),
            custom_css: String::new(),
            font_family: "sans-serif".to_string(),
            code_font_family: "monospace".to_string(),
            zoom: 100,
            toc_visible: true,
            breadcrumb_visible: true,
            syntax_highlight: true,
            mermaid: true,
            mermaid_theme: "auto".to_string(),
            katex: true,
            auto_reload: true,
            print_use_light_theme: true,
        }
    }
}

/// Platform config directory per docs/CONFIG_SPEC.md - `dirs::config_dir()` already resolves to
/// exactly those three paths (`%APPDATA%`, `~/Library/Application Support`, `~/.config`).
pub fn config_dir() -> Option<PathBuf> {
    dirs::config_dir().map(|dir| dir.join("LightMark"))
}

pub fn config_path() -> Option<PathBuf> {
    config_dir().map(|dir| dir.join("config.json"))
}

/// Missing file, unreadable file, or invalid JSON all fall back to defaults rather than erroring,
/// a broken config shouldn't stop the viewer from opening. Partial JSON (only some fields set)
/// is filled in from `Config::default()` field by field via `#[serde(default)]` above.
pub fn load_config() -> Config {
    let Some(path) = config_path() else {
        return Config::default();
    };
    let Ok(text) = fs::read_to_string(&path) else {
        return Config::default();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

/// Overwrites config.json with `Config::default()`, backing up whatever was there first (single
/// `.bak`, overwritten each time - not a history, just a way back from a bad reset).
pub fn reset_config() -> std::io::Result<Config> {
    let dir = config_dir().ok_or_else(missing_config_dir)?;
    fs::create_dir_all(&dir)?;
    let path = dir.join("config.json");
    if path.exists() {
        fs::copy(&path, dir.join("config.json.bak"))?;
    }
    let default = Config::default();
    fs::write(&path, serde_json::to_string_pretty(&default).unwrap())?;
    Ok(default)
}

fn missing_config_dir() -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::NotFound, "no platform config directory")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fills_in_missing_fields_from_defaults() {
        let config: Config = serde_json::from_str(r#"{"theme":"github-dark","zoom":150}"#).unwrap();
        assert_eq!(config.theme, "github-dark");
        assert_eq!(config.zoom, 150);
        assert_eq!(config.font_family, Config::default().font_family);
        assert!(config.mermaid);
    }

    #[test]
    fn serializes_with_camel_case_keys_matching_config_spec() {
        let json = serde_json::to_string(&Config::default()).unwrap();
        assert!(json.contains("\"fontFamily\""));
        assert!(json.contains("\"printUseLightTheme\""));
        assert!(!json.contains("\"font_family\""));
    }
}
