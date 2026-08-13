// Shared by config.rs/state.rs: writing a JSON file so a reader (possibly in a *different*
// process - the axum dev-server binary and a Tauri instance can both point at the same config
// directory) never observes a half-written file. `fs::write` alone truncates-then-writes in
// place, so a read racing it can see a truncated/partial file; writing to a temp file first and
// `fs::rename`-ing it over the real path is atomic on the same filesystem on all three platforms
// LightMark targets, so a concurrent reader always sees either the old contents or the new ones,
// never a partial write.

use std::io;
use std::path::Path;

pub fn atomic_write(path: &Path, contents: &str) -> io::Result<()> {
    let tmp_path = path.with_extension("json.tmp");
    std::fs::write(&tmp_path, contents)?;
    std::fs::rename(&tmp_path, path)
}
