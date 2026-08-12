// Tauri-independent core: file reading, config, and file watching. Used directly by src-tauri
// (M6) and over HTTP+SSE by bin/devserver.rs (docs/PLAN.md M5) - this crate itself never depends
// on Tauri or (outside the `dev-server` feature) on any async runtime.

pub mod config;
pub mod file;
pub mod state;
pub mod watcher;

pub use config::{config_dir, reload_config, Config};
pub use file::{read_file, FileError, MAX_FILE_SIZE};
pub use state::{initial_open_dir, save_last_opened_dir};
pub use watcher::{watch_file, FileWatcher};
