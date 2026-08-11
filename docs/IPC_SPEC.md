# IPC Specification

## Commands
- open_file()
- read_file(path)
- watch_file(path)
- unwatch_file(path)
- read_config()
- reload_config()
- open_config_folder()
- open_config_file()
- reset_config()

## Events
- file-changed
- config-changed
- watcher-error

## Dev Server (Tauri 비의존)
`cargo run -p backend --features dev-server` (127.0.0.1:7878). HTTP+SSE로 동일 기능 제공.

| Command | Dev Server Route |
|---|---|
| read_file | GET /api/file?path= |
| watch_file / unwatch_file | GET /api/events (SSE, 연결 종료=unwatch) |
| read_config | GET /api/config |
| reload_config | POST /api/config/reload |
| reset_config | POST /api/config/reset |
| open_config_folder / open_config_file | 미지원 (capabilities.configFile=false) |
| - | GET /api/health (모드 감지용) |

## Frontend BackendApi
Web / Dev / Tauri 3개 구현체가 동일 인터페이스(BackendApi)를 만족한다.
watch_file + unwatch_file은 프론트 표면에서 `watchFile(path, onChange): Unwatch` 하나로 합쳐진다.
