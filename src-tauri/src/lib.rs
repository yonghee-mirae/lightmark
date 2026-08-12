// Thin IPC bindings only - every command delegates to the `backend` crate (docs/PLAN.md M6:
// "IPC 9개 커맨드를 backend 함수로 위임하는 바인딩만. 로직 금지"). The one exception is
// `open_file`/`open_config_folder`, which need a native dialog/opener - that logic lives in the
// `tauri-plugin-dialog`/`tauri-plugin-opener` plugins, not here.

mod cli;

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// Active file watchers, keyed by the exact path being watched (docs/IPC_SPEC.md's
/// `watch_file(path)`/`unwatch_file(path)` take a path, not a synthetic id - LightMark only ever
/// watches one document at a time, per `frontend/src/main.ts`'s `activeWatchPath`).
#[derive(Default)]
struct WatcherRegistry(Mutex<HashMap<String, backend::FileWatcher>>);

/// Matches `frontend/src/platform/backend.ts`'s `OpenedFile`.
#[derive(serde::Serialize)]
struct OpenedFile {
    path: String,
    name: String,
    content: String,
}

fn file_name_of(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string())
}

// Must be `async fn`, even though nothing here is awaited: a plain (non-async) #[tauri::command]
// runs inline on whatever thread handles the IPC call - the main/GTK thread on Linux - and
// `blocking_pick_file()` needs that same main loop free to actually show and respond to the
// dialog. Calling it there deadlocks the whole app. `async fn` makes Tauri dispatch this onto
// its async runtime (a background thread) instead, matching the plugin's own naming
// ("blocking_") - it's meant to be called from anywhere *but* the main thread.
#[tauri::command]
async fn open_file(app: AppHandle) -> Result<Option<OpenedFile>, String> {
    let mut dialog = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown"]);
    if let Some(dir) = backend::initial_open_dir() {
        dialog = dialog.set_directory(dir);
    }
    let picked = dialog.blocking_pick_file();
    let Some(file_path) = picked else {
        return Ok(None);
    };
    let path_buf = file_path.into_path().map_err(|e| e.to_string())?;
    let content = backend::read_file(&path_buf).map_err(|e| e.to_string())?;
    if let Some(parent) = path_buf.parent() {
        // Best-effort - remembering the directory for next time isn't worth failing the open over.
        let _ = backend::save_last_opened_dir(parent);
    }
    let path = path_buf.to_string_lossy().into_owned();
    Ok(Some(OpenedFile {
        name: file_name_of(&path),
        path,
        content,
    }))
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    backend::read_file(Path::new(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn watch_file(
    app: AppHandle,
    registry: State<WatcherRegistry>,
    path: String,
) -> Result<(), String> {
    let mut watchers = registry.0.lock().unwrap();
    // Re-watching the same path (e.g. reopening the same file) just replaces the old watcher -
    // dropping the previous `FileWatcher` value stops it.
    let target = Path::new(&path).to_path_buf();
    let event_path = path.clone();
    let watcher = backend::watch_file(&target, move || {
        let _ = app.emit("file-changed", &event_path);
    })
    .map_err(|e| e.to_string())?;
    watchers.insert(path, watcher);
    Ok(())
}

#[tauri::command]
fn unwatch_file(registry: State<WatcherRegistry>, path: String) {
    registry.0.lock().unwrap().remove(&path);
}

#[tauri::command]
fn read_config() -> backend::Config {
    backend::load_config()
}

#[tauri::command]
fn reload_config() -> backend::Config {
    // Unlike read_config(), self-heals a missing/broken config.json by writing a fresh default
    // one to disk - see backend::reload_config() (M7: replaces the removed Reset Config button).
    backend::reload_config()
}

#[tauri::command]
fn open_config_folder(app: AppHandle) -> Result<(), String> {
    let dir = backend::config_dir().ok_or("no platform config directory")?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dir.to_string_lossy().into_owned(), None::<String>)
        .map_err(|e| e.to_string())
}

/// Not one of docs/IPC_SPEC.md's 7 commands - a small addition so the frontend can pull the
/// CLI/file-association path once on startup (pull, not push, avoids any race with page load;
/// same shape as the `?file=` query param Dev mode already uses).
#[tauri::command]
fn get_initial_path(app: AppHandle) -> Option<String> {
    app.state::<cli::InitialPath>().0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            // A second launch (e.g. double-clicking another .md file) hands its argv/cwd here
            // instead of starting a second process - docs/PLAN.md M5's "single document" design
            // (`frontend/src/main.ts`'s `activeWatchPath`) means one window is the right model.
            if let Some(path) = cli::extract_path_arg(&argv, Path::new(&cwd)) {
                let _ = app.emit("open-path", path);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(WatcherRegistry::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let initial = cli::extract_path_arg(
                &std::env::args().collect::<Vec<_>>(),
                &std::env::current_dir()?,
            );
            app.manage(cli::InitialPath(Mutex::new(initial)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_file,
            read_file,
            watch_file,
            unwatch_file,
            read_config,
            reload_config,
            open_config_folder,
            get_initial_path,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, _event| {
            // macOS-only: "Open With LightMark" / dropping a file on the dock icon delivers here
            // rather than via argv (unverified on real macOS hardware - implemented from the
            // documented API shape only, see HANDOFF.md).
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &_event {
                if let Some(path) = urls.first().and_then(|u| u.to_file_path().ok()) {
                    let _ = _app_handle.emit("open-path", path.to_string_lossy().into_owned());
                }
            }
        });
}
