// Thin IPC bindings only - every command delegates to the `backend` crate (docs/PLAN.md M6:
// "IPC 커맨드를 backend 함수로 위임하는 바인딩만. 로직 금지"). The exceptions are `open_file`/
// `open_config_folder` (need a native dialog/opener - lives in the `tauri-plugin-dialog`/
// `tauri-plugin-opener` plugins, not here) and window creation/lifecycle (docs/PLAN.md "멀티
// 윈도우/인스턴스 지원" - inherently Tauri-specific, no equivalent in `backend`).

mod cli;

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, EventTarget, Manager, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// Active file watchers, keyed by the label of the window watching (docs/PLAN.md "멀티 윈도우/
/// 인스턴스 지원") - each window only ever watches one document at a time (still true per window,
/// just no longer true process-wide now that there can be several windows), so re-watching from
/// the same window just replaces its old watcher same as before. Keying by window instead of by
/// path (like before multi-window) means two windows watching the same file path no longer stomp
/// on each other's watcher.
#[derive(Default)]
struct WatcherRegistry(Mutex<HashMap<String, backend::FileWatcher>>);

/// The label of a window that was created blank (no file) and hasn't had anything loaded into it
/// yet - exists to work around a macOS-specific ordering issue between `setup()` and
/// `application:openURLs:`/`RunEvent::Opened`. **Which of the two runs first is not reliable** -
/// tracing an actual cold double-click showed `Opened` fully handled (a window created with the
/// file) *before* `setup()` even started, the opposite of what was originally assumed here. Two
/// complementary fixes cover both orderings: `setup()` itself now checks whether a window was
/// already created (`NEXT_WINDOW != 0`) before making its own blank one, covering "`Opened` wins
/// the race" (the case actually observed); this `PristineWindow` reuse covers the other direction -
/// if `setup()` still wins (e.g. a plain icon double-click with no file, followed shortly after by
/// a drag onto the dock icon while still starting up) and leaves a blank window behind, a later
/// `Opened` reuses it (navigates it) instead of leaving that window blank forever alongside a
/// second one. The flag is cleared as soon as anything is genuinely loaded into that window - via
/// the reuse path itself, or via the first `watch_file` call arriving from it (covers the user
/// manually opening a file into it by hand, e.g. the toolbar Open button, before any `Opened`
/// event arrives) - so a later, unrelated file-open is never silently routed into a window that's
/// since been repurposed.
///
/// Reuse only ever fires on macOS (`open_window` gates it on `cfg!(target_os = "macos")`) - the
/// decided behavior for every other OS trigger (double-click, CLI relaunch) is "open a new
/// window", full stop (docs/PLAN.md 멀티 윈도우/인스턴스 지원 결정 2). Without that gate, this
/// mechanism would also silently reuse *any* still-idle blank window on Linux/Windows for a
/// wholly unrelated, much-later relaunch - confirmed happening in this repo's own `npm run tauri
/// dev` smoke test (see HANDOFF.md's "실기 검증" section) before this gate was added.
#[derive(Default)]
struct PristineWindow(Mutex<Option<String>>);

/// Every window gets a unique label (`win-0`, `win-1`, ...) - a plain module-level counter rather
/// than managed state, since routing a single atomic through `State` buys nothing here. A "find
/// the first unused `win-N`" scheme was considered instead and rejected: it's TOCTOU-racy, and
/// window creation is genuinely concurrent here (a single-instance callback on one thread, a
/// macOS multi-file-select loop on another).
static NEXT_WINDOW: AtomicU32 = AtomicU32::new(0);

fn next_window_id() -> u32 {
    NEXT_WINDOW.fetch_add(1, Ordering::Relaxed)
}

/// Spreads new windows out diagonally so they don't all spawn stacked exactly on top of each
/// other (`.center()` doesn't help - it's equally identical for every window).
fn cascade_position(id: u32) -> (f64, f64) {
    let offset = f64::from(id % 10) * 24.0;
    (offset, offset)
}

fn encode_file_query(path: &str) -> String {
    url::form_urlencoded::Serializer::new(String::new())
        .append_pair("file", path)
        .finish()
}

/// Clears `PristineWindow` if it's currently recording `label` - shared by the `watch_file`
/// command (a real document just loaded into that window) and the window-destroyed handler (the
/// window is gone, so there's nothing left to reuse).
fn clear_pristine_if_matching(app: &AppHandle, label: &str) {
    let pristine = app.state::<PristineWindow>();
    let mut guard = pristine.0.lock().unwrap_or_else(|e| e.into_inner());
    if guard.as_deref() == Some(label) {
        *guard = None;
    }
}

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

/// Opens a window, optionally with a file already loaded into it via a `?file=` query param on
/// its own URL (docs/PLAN.md "멀티 윈도우/인스턴스 지원") rather than an IPC pull - `main.ts`
/// already has a `?file=` handler (originally Dev-mode-only), so every window (including the
/// very first one at cold start) just reuses it for free. On macOS only, reuses a still-blank
/// `PristineWindow` instead of creating a new one when one is on record - see that type's doc
/// comment for why this is macOS-only.
///
/// `exclude` is the label of the window this request originated *from*, if any (only
/// `open_new_window` has one - OS-level triggers like the single-instance callback or
/// `RunEvent::Opened` have no window context at all, so they pass `None`). Without excluding it,
/// dropping several files onto a still-pristine window races: the first file loads into that
/// window client-side (`openPath()`, several IPC round-trips away from the `watch_file` call that
/// actually clears the pristine flag), while the rest fire `open_new_window` for it almost
/// immediately - if that lands before the flag clears, it finds "itself" recorded as pristine and
/// navigates the very window it's supposed to be opening a *new* one alongside, yanking it out
/// from under the first file's still-in-flight load (surfaces as a `Load failed` IPC error and
/// only one of the dropped files ending up open - user-reported, reproduced exactly this way).
fn open_window(
    app: &AppHandle,
    file: Option<&str>,
    exclude: Option<&str>,
) -> tauri::Result<WebviewWindow> {
    if let Some(f) = file {
        if cfg!(target_os = "macos") {
            let pristine = app.state::<PristineWindow>();
            let mut guard = pristine.0.lock().unwrap_or_else(|e| e.into_inner());
            if guard.as_deref() != exclude {
                let recorded = guard.take();
                drop(guard);
                if let Some(label) = recorded {
                    if let Some(window) = app.get_webview_window(&label) {
                        let mut url = window.url()?;
                        url.set_query(Some(&encode_file_query(f)));
                        window.navigate(url)?;
                        let _ = window.set_focus();
                        return Ok(window);
                    }
                }
            }
        }
    }

    let id = next_window_id();
    let label = format!("win-{id}");
    let mut cfg = app.config().app.windows[0].clone();
    cfg.label = label.clone();
    cfg.title = match file {
        Some(f) => format!("LightMark — {}", file_name_of(f)),
        None => "LightMark".into(),
    };
    cfg.url = WebviewUrl::App(
        match file {
            Some(f) => format!("index.html?{}", encode_file_query(f)),
            None => "index.html".into(),
        }
        .into(),
    );
    let (x, y) = cascade_position(id);
    let window = WebviewWindowBuilder::from_config(app, &cfg)?
        .position(x, y)
        .build()?;

    if file.is_none() {
        app.state::<PristineWindow>()
            .0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .replace(label);
    }
    Ok(window)
}

// Must be `async fn`, even though nothing here is awaited: a plain (non-async) #[tauri::command]
// runs inline on whatever thread handles the IPC call - the main/GTK thread on Linux - and
// `blocking_pick_file()` needs that same main loop free to actually show and respond to the
// dialog. Calling it there deadlocks the whole app. `async fn` makes Tauri dispatch this onto
// its async runtime (a background thread) instead, matching the plugin's own naming
// ("blocking_") - it's meant to be called from anywhere *but* the main thread.
#[tauri::command]
async fn open_file(app: AppHandle, window: WebviewWindow) -> Result<Option<OpenedFile>, String> {
    let mut dialog = app
        .dialog()
        .file()
        .set_parent(&window)
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
    window: WebviewWindow,
    registry: State<WatcherRegistry>,
    path: String,
) -> Result<(), String> {
    let label = window.label().to_string();
    clear_pristine_if_matching(&app, &label);
    let target = Path::new(&path).to_path_buf();
    let emit_label = label.clone();
    let watcher = backend::watch_file(&target, move || {
        let _ = app.emit_to(
            EventTarget::webview_window(&emit_label),
            "file-changed",
            &path,
        );
    })
    .map_err(|e| e.to_string())?;
    registry
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(label, watcher);
    Ok(())
}

#[tauri::command]
fn unwatch_file(window: WebviewWindow, registry: State<WatcherRegistry>) {
    registry
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .remove(window.label());
}

#[tauri::command]
fn read_config() -> backend::Config {
    // Self-heals a missing/broken config.json by writing a fresh default one to disk - see
    // backend::reload_config(). Runs on every app startup, not just when the user clicks Apply.
    backend::reload_config()
}

#[tauri::command]
fn reload_config() -> backend::Config {
    // Same self-healing backend::reload_config() as read_config() above, just triggered by the
    // user clicking Apply instead of app startup (M7: replaces the removed Reset Config button -
    // deleting config.json while the app is running and clicking Apply gets a clean default file
    // back without restarting).
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

/// Lets the frontend ask for another window with a specific file (docs/PLAN.md "멀티 윈도우/
/// 인스턴스 지원") - used when several files are dropped onto one window at once: the first
/// replaces that window's content in place (already handled purely in the frontend), the rest
/// each get their own new window via this command. `window` is passed so `open_window()` can
/// exclude it from pristine-window reuse - see that function's doc comment.
#[tauri::command]
fn open_new_window(app: AppHandle, window: WebviewWindow, path: String) -> Result<(), String> {
    open_window(&app, Some(&path), Some(window.label()))
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            // A second launch (double-click, `lightmark <file>` from a terminal) hands its
            // argv/cwd here instead of starting a second process - docs/PLAN.md "멀티 윈도우/
            // 인스턴스 지원": each one now opens its own new window rather than routing into the
            // existing one. Dispatched via async_runtime::spawn rather than run inline: this
            // callback's own thread differs per platform (a zbus worker on Linux, a tokio task on
            // macOS, but *the main thread itself, re-entrantly inside the plugin's hidden
            // window's WndProc* on Windows) - spawning normalizes all three onto a clean point in
            // the event loop instead of relying on that reentrancy being safe.
            let path = cli::extract_path_arg(&argv, Path::new(&cwd));
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = open_window(&app, path.as_deref(), None);
            });
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(WatcherRegistry::default())
        .manage(PristineWindow::default())
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let label = window.label();
                window
                    .state::<WatcherRegistry>()
                    .0
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .remove(label);
                clear_pristine_if_matching(&window.app_handle().clone(), label);
            }
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // On macOS, `RunEvent::Opened` for the file that launched this app can arrive and be
            // fully handled *before* `setup()` runs (confirmed by tracing the actual event order -
            // the reverse of what was assumed when `PristineWindow` above was designed to reuse a
            // window `setup()` had already created for exactly this race; user-reported: an extra
            // blank window appeared alongside the one with the file on a cold double-click).
            // `NEXT_WINDOW` only ever moves off 0 by a window actually being created, so if it's
            // no longer 0 here, `Opened` (or, in principle, a same-instant single-instance
            // callback) already created one and there's nothing left for `setup()` to do - CLI-arg
            // extraction wouldn't find anything anyway (macOS delivers the file via `Opened`'s
            // Apple Event, never through argv, confirmed by the same trace).
            if NEXT_WINDOW.load(Ordering::Relaxed) == 0 {
                let initial = cli::extract_path_arg(
                    &std::env::args().collect::<Vec<_>>(),
                    &std::env::current_dir()?,
                );
                open_window(&app.handle().clone(), initial.as_deref(), None)?;
            }
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
            open_new_window,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, _event| {
            // macOS-only: "Open With LightMark" / dropping a file on the dock icon delivers here
            // rather than via argv (unverified on real macOS hardware - implemented from the
            // documented API shape only, see HANDOFF.md), as does clicking the dock icon when no
            // windows are open, and the "closed the last window" exit request this app now
            // intentionally survives so Reopen has something to react to.
            #[cfg(target_os = "macos")]
            match &_event {
                tauri::RunEvent::Opened { urls, .. } => {
                    // `.filter_map` (not `.first()`) - one new window per file (docs/PLAN.md:
                    // macOS "Open With" multi-select). Also skips non-file URLs (Opened can carry
                    // deep links), so those can't each spawn a blank window.
                    for path in urls.iter().filter_map(|u| u.to_file_path().ok()) {
                        let _ = open_window(_app_handle, Some(&path.to_string_lossy()), None);
                    }
                }
                tauri::RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } => {
                    if !has_visible_windows {
                        let _ = open_window(_app_handle, None, None);
                    }
                }
                // Only swallow the "closed the last window" quit (that's the only case where
                // `code` is `None`) - a real `AppHandle::exit(0)` also fires ExitRequested and
                // must be allowed through, or the app becomes unquittable via any programmatic
                // path. Cmd+Q itself bypasses this entirely (goes straight to `terminate:`), so
                // this only ever governs the last-window-closed case.
                tauri::RunEvent::ExitRequested { code, api, .. } if code.is_none() => {
                    api.prevent_exit();
                }
                _ => {}
            }
        });
}
