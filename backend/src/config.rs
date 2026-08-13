// Config schema mirrors docs/CONFIG_SPEC.md exactly (same field names/defaults as
// frontend/src/types/config.ts's DEFAULT_CONFIG) so a config.json written by hand or by either
// side round-trips without surprises.

use crate::fsutil::atomic_write;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

// Guards config.json's read-modify-write cycle within this process (docs/PLAN.md: multi-window
// support means several windows' IPC calls can hit reload_config() concurrently in the same
// process - a plain Mutex<()> around the critical section keeps them from interleaving). This is
// on top of, not instead of, atomic_write()'s temp-file+rename - that one's for readers in a
// *different* process (the axum dev-server binary) never observing a half-written file; this one
// is for two callers *in* this process not racing each other's read-then-decide-then-write.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Config {
    pub theme: String,
    pub custom_css: String,
    pub font_family: String,
    pub code_font_family: String,
    pub zoom: u32,
    pub toc_visible: bool,
    pub syntax_highlight: bool,
    pub mermaid: bool,
    pub mermaid_theme: String,
    pub katex: bool,
    pub print_use_light_theme: bool,
    /// Max viewer content width in px; `0` means unlimited (docs/CONFIG_SPEC.md).
    pub viewer_max_width: u32,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            theme: "github-light".to_string(),
            custom_css: String::new(),
            font_family: "sans-serif".to_string(),
            code_font_family: "monospace".to_string(),
            zoom: 100,
            toc_visible: false,
            syntax_highlight: true,
            mermaid: true,
            mermaid_theme: "auto".to_string(),
            katex: true,
            print_use_light_theme: true,
            viewer_max_width: 0,
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

fn try_load(path: &Path) -> Option<Config> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

/// Missing file, unreadable file, or invalid JSON all fall back to defaults rather than erroring,
/// a broken config shouldn't stop the viewer from opening - and it writes a fresh default file to
/// that path too, so the viewer always leaves behind a real, editable config.json rather than
/// silently running on in-memory defaults. Whatever was at that path is backed up first (single
/// `.bak`, overwritten each time - not a history, just a way back from a broken file). Runs both
/// on every app startup and whenever the user clicks Apply (M7: replaces the removed Reset Config
/// button - deleting config.json while the app is running and clicking Apply gets a clean default
/// file back without needing to restart). Partial JSON (only some fields set) is filled in from
/// `Config::default()` field by field via `#[serde(default)]` above.
///
/// The whole read-then-maybe-write cycle runs under `WRITE_LOCK` (multi-window: several windows'
/// IPC calls can land here concurrently in the same process) - without it, one caller's read
/// could land between another caller's "file's missing" check and its write, and read a
/// half-written file as "broken", triggering a second, spurious self-heal write. The write itself
/// goes through `atomic_write` (temp file + rename) so a *different process* (the axum dev-server
/// binary, pointed at the same config directory) never observes a partially-written file either.
pub fn reload_config() -> Config {
    let Some(path) = config_path() else {
        return Config::default();
    };
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(config) = try_load(&path) {
        return config;
    }
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
        if path.exists() {
            let _ = fs::copy(&path, dir.join("config.json.bak"));
        }
    }
    let default = Config::default();
    // Best-effort - a failed write here shouldn't stop the caller from getting a usable config.
    let _ = atomic_write(&path, &serde_json::to_string_pretty(&default).unwrap());
    default
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
