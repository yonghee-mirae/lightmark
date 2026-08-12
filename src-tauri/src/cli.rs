// CLI-argument / file-association path extraction (docs/PLAN.md M6: "CLI 인자로 파일 열기").
// A pure function so it's testable without spinning up a Tauri app - the same style
// `backend/src/watcher.rs`'s `event_affects` uses.

use std::path::Path;
use std::sync::Mutex;

/// Holds the path (if any) this process was launched with, until the frontend pulls it via the
/// `get_initial_path` command.
pub struct InitialPath(pub Mutex<Option<String>>);

/// `args[0]` is always the executable itself; anything after that which isn't a flag (`-`/`--`,
/// which `tauri dev`/Chromium/webview runtimes can prepend) is treated as the file to open.
/// Relative paths are resolved against `cwd` - required for the single-instance callback, whose
/// argv/cwd come from wherever the second launch happened, not this process's own directory.
pub fn extract_path_arg(args: &[String], cwd: &Path) -> Option<String> {
    let arg = args.iter().skip(1).find(|a| !a.starts_with('-'))?;
    let path = Path::new(arg);
    let resolved = if path.is_absolute() {
        path.to_path_buf()
    } else {
        cwd.join(path)
    };
    Some(resolved.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn returns_none_with_no_path_argument() {
        let cwd = PathBuf::from("/home/user");
        assert_eq!(extract_path_arg(&["lightmark".into()], &cwd), None);
        assert_eq!(
            extract_path_arg(&["lightmark".into(), "--flag".into()], &cwd),
            None
        );
    }

    #[test]
    fn resolves_a_relative_path_against_cwd() {
        let cwd = PathBuf::from("/home/user/docs");
        assert_eq!(
            extract_path_arg(&["lightmark".into(), "notes.md".into()], &cwd),
            Some("/home/user/docs/notes.md".to_string())
        );
    }

    #[test]
    fn keeps_an_absolute_path_as_is() {
        let cwd = PathBuf::from("/home/user");
        assert_eq!(
            extract_path_arg(&["lightmark".into(), "/tmp/notes.md".into()], &cwd),
            Some("/tmp/notes.md".to_string())
        );
    }

    #[test]
    fn skips_flags_before_the_path() {
        let cwd = PathBuf::from("/home/user");
        assert_eq!(
            extract_path_arg(
                &["lightmark".into(), "--verbose".into(), "notes.md".into()],
                &cwd
            ),
            Some("/home/user/notes.md".to_string())
        );
    }
}
