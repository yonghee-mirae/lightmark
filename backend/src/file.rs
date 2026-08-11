// Reading an arbitrary user-chosen .md file: normalize encoding/line endings so the frontend
// never has to think about it, and cap size so a huge file can't stall the UI (docs/PLAN.md M5).

use std::fmt;
use std::fs;
use std::path::Path;

/// Above this, `read_file` errors instead of loading the whole thing into memory.
pub const MAX_FILE_SIZE: u64 = 20 * 1024 * 1024; // 20MB

#[derive(Debug)]
pub enum FileError {
    TooLarge { size: u64, limit: u64 },
    InvalidUtf8,
    Io(std::io::Error),
}

impl fmt::Display for FileError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FileError::TooLarge { size, limit } => {
                write!(f, "file is {size} bytes, over the {limit} byte limit")
            }
            FileError::InvalidUtf8 => write!(f, "file is not valid UTF-8"),
            FileError::Io(err) => write!(f, "{err}"),
        }
    }
}

impl std::error::Error for FileError {}

impl From<std::io::Error> for FileError {
    fn from(err: std::io::Error) -> Self {
        FileError::Io(err)
    }
}

/// Reads `path` as UTF-8 text, stripping a leading BOM and normalizing CRLF to LF so the
/// renderer always sees plain LF-separated text regardless of what editor/OS wrote the file.
pub fn read_file(path: &Path) -> Result<String, FileError> {
    let size = fs::metadata(path)?.len();
    if size > MAX_FILE_SIZE {
        return Err(FileError::TooLarge {
            size,
            limit: MAX_FILE_SIZE,
        });
    }

    let bytes = fs::read(path)?;
    let text = String::from_utf8(bytes).map_err(|_| FileError::InvalidUtf8)?;
    let text = text.strip_prefix('\u{FEFF}').unwrap_or(&text);
    Ok(text.replace("\r\n", "\n"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_temp(name: &str, bytes: &[u8]) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!(
            "lightmark-test-{name}-{:?}",
            std::thread::current().id()
        ));
        let mut f = fs::File::create(&path).unwrap();
        f.write_all(bytes).unwrap();
        path
    }

    #[test]
    fn normalizes_crlf_and_strips_bom() {
        let path = write_temp("bom-crlf", "\u{FEFF}# Title\r\nBody\r\n".as_bytes());
        let content = read_file(&path).unwrap();
        assert_eq!(content, "# Title\nBody\n");
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn rejects_invalid_utf8() {
        let path = write_temp("bad-utf8", &[0xff, 0xfe, 0x00]);
        assert!(matches!(read_file(&path), Err(FileError::InvalidUtf8)));
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn rejects_files_over_the_size_limit() {
        let path = write_temp("too-big", &vec![b'a'; (MAX_FILE_SIZE + 1) as usize]);
        assert!(matches!(read_file(&path), Err(FileError::TooLarge { .. })));
        fs::remove_file(path).unwrap();
    }
}
