// Watches a single file for changes (docs/PLAN.md M5). Editors commonly save via
// write-then-rename (write a temp file, then rename it over the original), which looks to a
// filesystem watcher like the original file being removed - watching the file itself misses
// that. Watching its *parent directory* and filtering events down to the one path we care about
// survives that pattern (this is the concrete "Vim/VSCode 저장 후 watcher가 죽는다" failure mode
// docs/PLAN.md calls out).
//
// notify reports a burst of several events for a single logical save (temp file create, rename,
// metadata touch...), so a 100ms quiet-period debounce collapses each burst into one callback
// instead of firing once per underlying filesystem event.

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher as _};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

const DEBOUNCE: Duration = Duration::from_millis(100);

/// Keeps the underlying watcher (and its background thread) alive. Dropping this stops watching.
pub struct FileWatcher {
    _watcher: RecommendedWatcher,
}

// Only content-changing events count as "this file actually changed". `EventKind::Access`
// (file/handle opened, read, or closed) matches the target path too but fires just from a
// program *viewing* the file - notably, an editor merely having the document open - with no
// write involved at all. Reacting to those caused live reload to fire (and the viewer to flash)
// just from opening the file in an editor, or repeatedly for as long as it stayed open there.
fn event_affects(event: &Event, target: &Path) -> bool {
    (event.kind.is_create() || event.kind.is_modify()) && event.paths.iter().any(|p| p == target)
}

/// Calls `on_change` once per debounced burst of filesystem activity on `path`. `on_change` runs
/// on a dedicated background thread, not the caller's thread.
pub fn watch_file<F>(path: &Path, mut on_change: F) -> notify::Result<FileWatcher>
where
    F: FnMut() + Send + 'static,
{
    let target: PathBuf = path.to_path_buf();
    let parent = target
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));

    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let mut watcher = notify::recommended_watcher(tx)?;
    watcher.watch(&parent, RecursiveMode::NonRecursive)?;

    thread::spawn(move || {
        while let Ok(result) = rx.recv() {
            let Ok(event) = result else { continue };
            if !event_affects(&event, &target) {
                continue;
            }
            // Drain the rest of this save's event burst: keep waiting as long as more events
            // (relevant or not) keep arriving within the quiet period, then fire once.
            while rx.recv_timeout(DEBOUNCE).is_ok() {}
            on_change();
        }
    });

    Ok(FileWatcher { _watcher: watcher })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::{Arc, Mutex};
    use std::time::Instant;

    #[test]
    fn fires_once_for_a_burst_of_writes_to_the_watched_file() {
        let dir =
            std::env::temp_dir().join(format!("lightmark-watch-test-{:?}", thread::current().id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("doc.md");
        fs::write(&path, "before").unwrap();

        let count = Arc::new(Mutex::new(0));
        let count_clone = Arc::clone(&count);
        let _watcher = watch_file(&path, move || {
            *count_clone.lock().unwrap() += 1;
        })
        .unwrap();

        // A burst of several quick writes (simulating an editor's save) should still collapse
        // into a single callback thanks to the debounce.
        for i in 0..3 {
            fs::write(&path, format!("after-{i}")).unwrap();
        }

        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline && *count.lock().unwrap() == 0 {
            thread::sleep(Duration::from_millis(20));
        }

        assert_eq!(*count.lock().unwrap(), 1);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn ignores_pure_access_events_but_reacts_to_modify_and_create() {
        use notify::event::{AccessKind, AccessMode, CreateKind, ModifyKind};
        use notify::EventKind;

        let target = PathBuf::from("/tmp/doc.md");
        let other = PathBuf::from("/tmp/other.md");

        let access = Event::new(EventKind::Access(AccessKind::Open(AccessMode::Read)))
            .add_path(target.clone());
        assert!(
            !event_affects(&access, &target),
            "opening the file for reading shouldn't trigger a reload"
        );

        let modify = Event::new(EventKind::Modify(ModifyKind::Data(
            notify::event::DataChange::Content,
        )))
        .add_path(target.clone());
        assert!(event_affects(&modify, &target));

        let create = Event::new(EventKind::Create(CreateKind::File)).add_path(target.clone());
        assert!(event_affects(&create, &target));

        let modify_other_file = Event::new(EventKind::Modify(ModifyKind::Any)).add_path(other);
        assert!(!event_affects(&modify_other_file, &target));
    }
}
