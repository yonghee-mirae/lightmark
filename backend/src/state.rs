// App-internal bookkeeping that isn't part of the user-editable config (docs/CONFIG_SPEC.md) -
// right now just "which directory the Open dialog was last pointed at". Kept in its own
// `state.json`, deliberately separate from `config.json`: CLAUDE.md's "No graphical settings
// editor" is specifically about the documented, user-editable Config schema, not about the app
// silently remembering its own UI state - mixing the two would make config.json (meant to be
// hand-edited) grow fields no one would ever want to edit by hand.

use crate::config::config_dir;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppState {
    pub last_opened_dir: Option<PathBuf>,
}

fn state_path() -> Option<PathBuf> {
    config_dir().map(|dir| dir.join("state.json"))
}

fn load_state() -> AppState {
    let Some(path) = state_path() else {
        return AppState::default();
    };
    let Ok(text) = std::fs::read_to_string(&path) else {
        return AppState::default();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

/// Best-effort - failing to remember the directory isn't worth surfacing as an error to the user.
pub fn save_last_opened_dir(dir: &Path) -> std::io::Result<()> {
    let Some(path) = state_path() else {
        return Ok(());
    };
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut state = load_state();
    state.last_opened_dir = Some(dir.to_path_buf());
    std::fs::write(&path, serde_json::to_string_pretty(&state).unwrap())
}

/// The directory the Open dialog should start in: the last one used, unless it's gone (deleted,
/// moved, unmounted), in which case the user's home directory.
pub fn initial_open_dir() -> Option<PathBuf> {
    resolve_initial_dir(
        load_state().last_opened_dir,
        |p| p.is_dir(),
        dirs::home_dir(),
    )
}

fn resolve_initial_dir(
    remembered: Option<PathBuf>,
    exists: impl Fn(&Path) -> bool,
    home: Option<PathBuf>,
) -> Option<PathBuf> {
    match remembered {
        Some(dir) if exists(&dir) => Some(dir),
        _ => home,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uses_the_remembered_directory_when_it_still_exists() {
        let remembered = Some(PathBuf::from("/some/dir"));
        let home = Some(PathBuf::from("/home/user"));
        assert_eq!(
            resolve_initial_dir(remembered, |_| true, home),
            Some(PathBuf::from("/some/dir"))
        );
    }

    #[test]
    fn falls_back_to_home_when_the_remembered_directory_is_gone() {
        let remembered = Some(PathBuf::from("/deleted/dir"));
        let home = Some(PathBuf::from("/home/user"));
        assert_eq!(
            resolve_initial_dir(remembered, |_| false, home.clone()),
            home
        );
    }

    #[test]
    fn falls_back_to_home_when_nothing_is_remembered_yet() {
        let home = Some(PathBuf::from("/home/user"));
        assert_eq!(resolve_initial_dir(None, |_| true, home.clone()), home);
    }

    #[test]
    fn is_none_when_neither_the_remembered_dir_nor_home_is_available() {
        assert_eq!(resolve_initial_dir(None, |_| false, None), None);
    }

    #[test]
    fn app_state_serializes_with_camel_case_and_round_trips() {
        let state = AppState {
            last_opened_dir: Some(PathBuf::from("/tmp/docs")),
        };
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"lastOpenedDir\""));
        let parsed: AppState = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.last_opened_dir, state.last_opened_dir);
    }

    #[test]
    fn missing_field_defaults_to_none() {
        let parsed: AppState = serde_json::from_str("{}").unwrap();
        assert_eq!(parsed.last_opened_dir, None);
    }
}
