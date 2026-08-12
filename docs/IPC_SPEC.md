# IPC Specification

## Commands
- open_file()
- read_file(path)
- watch_file(path)
- unwatch_file(path)
- read_config()
- reload_config()
- open_config_folder()
- get_initial_path() — M6에서 추가. 위 7개에 없던 항목: CLI 인자/파일 연결로 실행됐을 때의 경로를 프론트가 시작 시 1회 pull. Dev 모드의 `?file=` 쿼리 파라미터와 같은 역할.

`open_config_file()`/`reset_config()`는 사용자 요청으로 M7에서 제거됨(버튼/IPC 커맨드/플랫폼 어댑터 전부). `reload_config()`가 그 대신 자기 치유(self-heal) 동작을 갖게 됨 — config.json이 없거나 깨져 있으면 읽기만 하는 게 아니라 기본값을 그 자리에 다시 써준다(기존 파일이 있었으면 `config.json.bak`으로 백업). `read_config()`도 동일한 자기 치유 동작을 공유한다 — 앱 시작 시 config.json이 없으면 그 자리에서 기본값 파일을 생성한다. 두 커맨드는 트리거만 다르다: `read_config()`는 앱 시작 시 1회, `reload_config()`는 사용자가 Apply를 눌렀을 때(앱을 실행한 채로 config.json을 삭제해도 재적용 가능하게).

## Events
- file-changed — 구현됨. payload로 변경된 파일의 경로를 실어서, 레이스(watch/unwatch 직후 다른 파일 open) 발생 시 프론트가 필터링 가능.
- open-path — M6에서 추가. 이미 실행 중인 창에 새 파일을 열어야 할 때(두 번째 실행 → `tauri-plugin-single-instance`, macOS 파일 연결 → `RunEvent::Opened`) push.
- config-changed — **미구현**. 지금은 config를 바꾸는 유일한 경로가 프론트 자신의 invoke(reload) 호출뿐이라 응답값으로 충분해서, 별도 브로드캐스트가 필요 없었음.
- watcher-error — **미구현**. `backend::watch_file`의 콜백이 "변경됨" 하나만 신호하는 구조라(에러 채널 없음) 표면화할 경로가 없음 — 발생 시 그냥 무시됨.

## Dev Server (Tauri 비의존)
`cargo run -p backend --features dev-server` (127.0.0.1:7878). HTTP+SSE로 동일 기능 제공.

| Command | Dev Server Route |
|---|---|
| read_file | GET /api/file?path= |
| watch_file / unwatch_file | GET /api/events (SSE, 연결 종료=unwatch) |
| read_config | GET /api/config |
| reload_config | POST /api/config/reload |
| open_config_folder | 미지원 (capabilities.configFile=false) |
| - | GET /api/health (모드 감지용) |

## Frontend BackendApi
Web / Dev / Tauri 3개 구현체가 동일 인터페이스(BackendApi)를 만족한다(M6에서 TauriBackend 구현 완료).
watch_file + unwatch_file은 프론트 표면에서 `watchFile(path, onChange): Unwatch` 하나로 합쳐진다.
get_initial_path()/open-path 이벤트는 `BackendApi`의 선택적(optional) 메서드로만 존재 — Web/Dev는 구현하지 않는다(Dev는 `?file=` 쿼리 파라미터로 같은 역할을 대신함).
