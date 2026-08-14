# IPC Specification

## Commands
- open_file()
- read_file(path)
- watch_file(path)
- unwatch_file() — 창별로 관리되므로 더 이상 path를 안 받음(아래 참고)
- read_config()
- reload_config()
- open_config_folder()
- open_new_window(path) — 멀티 윈도우 지원(아래 참고)에서 추가. 파일 하나를 새 창으로 여는 커맨드 - 한 창에 여러 파일을 한꺼번에 drag&drop했을 때, 첫 번째 파일은 그 창 내용을 바로 교체하고(기존 방식) 나머지 파일 각각에 대해 이 커맨드를 호출해 새 창을 연다.
- open_url(url) — 문서 안 하이퍼링크(같은 문서 내 `#heading` 앵커 제외)를 OS 기본 브라우저로 여는 커맨드(사용자 리포트: 클릭하면 앱 자신의 창이 그 주소로 이동해버리던 버그 수정). `open_config_folder`와 같은 패턴 — `tauri-plugin-opener`의 `open_url` IPC 커맨드(ACL 스코프 있음)를 직접 호출하는 대신, `Opener` 확장 트레잇의 `open_url()`을 그대로 불러서 스코프 설정 없이 동작.

`get_initial_path()`는 멀티 윈도우 지원 작업에서 제거됨 — 아래 "멀티 윈도우/인스턴스 지원" 참고.

`open_config_file()`/`reset_config()`는 사용자 요청으로 M7에서 제거됨(버튼/IPC 커맨드/플랫폼 어댑터 전부). `reload_config()`가 그 대신 자기 치유(self-heal) 동작을 갖게 됨 — config.json이 없거나 깨져 있으면 읽기만 하는 게 아니라 기본값을 그 자리에 다시 써준다(기존 파일이 있었으면 `config.json.bak`으로 백업). `read_config()`도 동일한 자기 치유 동작을 공유한다 — 앱 시작 시 config.json이 없으면 그 자리에서 기본값 파일을 생성한다. 두 커맨드는 트리거만 다르다: `read_config()`는 앱 시작 시 1회, `reload_config()`는 사용자가 Apply를 눌렀을 때(앱을 실행한 채로 config.json을 삭제해도 재적용 가능하게).

## Events
- file-changed — 구현됨. 이제 변경된 창에만 보내는 targeted emit(`emit_to`)이고(멀티 윈도우 지원 이전에는 전체 브로드캐스트), payload로 변경된 파일의 경로를 실어서 레이스(watch/unwatch 직후 다른 파일 open) 발생 시 프론트가 한 번 더 필터링 가능.
- config-changed — **미구현**. 지금은 config를 바꾸는 유일한 경로가 프론트 자신의 invoke(reload) 호출뿐이라 응답값으로 충분해서, 별도 브로드캐스트가 필요 없었음.
- watcher-error — **미구현**. `backend::watch_file`의 콜백이 "변경됨" 하나만 신호하는 구조라(에러 채널 없음) 표면화할 경로가 없음 — 발생 시 그냥 무시됨.

`open-path`(M6에서 추가, 이미 실행 중인 창에 새 파일을 push하던 이벤트)는 멀티 윈도우 지원 작업에서 제거됨 — 아래 참고.

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
`onFileDrop()`/`openWindow()`는 `BackendApi`의 선택적(optional) 메서드로만 존재 — Web/Dev는 구현하지 않는다(창을 새로 열거나 네이티브 OS drag&drop을 받을 수 있는 게 Tauri뿐이라서).
`openUrl(url)`은 위 둘과 달리 **필수** 메서드 — Web/Dev도 `window.open(url, '_blank', 'noopener,noreferrer')`로 똑같이 의미 있게 구현 가능해서(Tauri만의 OS 기능이 아님) optional로 둘 이유가 없음.
`setTitle(title)`도 같은 이유로 필수 — Web/Dev는 `document.title`로, Tauri는 `@tauri-apps/api/window`의 `getCurrentWindow().setTitle()`(새 커맨드 아님, `core:window` API 직접 호출 - `capabilities/default.json`에 `core:window:allow-set-title` 필요, 이 플러그인의 `default` 퍼미션 세트엔 안 들어있음)로 구현.

## 멀티 윈도우/인스턴스 지원
`tauri-plugin-single-instance`가 예전에는 두 번째 실행을 기존 창으로 라우팅했으나, LightMark는 뷰어이니 문서마다 별도 창을 띄울 수 있어야 한다는 사용자 결정으로 방향이 바뀜:
- 툴바 Open / 창에 파일 1개 drag&drop → 그 창 내용 교체(기존 그대로).
- 창에 파일 여러 개를 한꺼번에 drag&drop → 첫 파일은 그 창 내용 교체, 나머지는 파일마다 새 창(macOS 세션에서 확정 - 처음엔 구현 시점의 임의 확장이었으나 `open_new_window`가 자기 자신이 드롭 대상인 창을 pristine-재사용하는 레이스 버그를 수정 후 정식 결정으로 확정).
- 더블클릭 / CLI 인자로 재실행 / macOS "Open With"(다중 선택 포함) → 파일마다 새 창.
- macOS: 창을 전부 닫아도 앱은 떠 있고, Dock 클릭 시 새 창(`RunEvent::Reopen`).

**IPC 대신 URL로 초기 파일 전달**: 모든 창(첫 창 포함)은 생성 시점에 자기 URL에 파일이 이미 담겨 있다 — `index.html?file=<percent-encoded>`. `main.ts`의 기존 `?file=` 처리(원래 Dev 전용이었던 것, `capabilities.watch`로 게이팅되어 있어 Tauri에도 그대로 적용됨)가 그대로 재사용되므로, 과거의 `get_initial_path()` pull 방식(전역 `Mutex<Option<String>>` 하나를 시작 시 한 번 소비)은 완전히 불필요해져 삭제됨.

새 창은 `src-tauri/src/lib.rs`의 `open_window()` 헬퍼 함수(Rust 쪽에서만 호출, IPC 커맨드 아님)로 생성 — `tauri.conf.json`의 창 설정에 `"create": false`를 추가해 Tauri가 시작 시 자동 생성하지 않게 하고, 그 설정을 복제해 `label`/`title`/`url`만 창마다 다르게 채워 넣는다. 창 라벨은 `win-0`, `win-1`, ... 형식이라 `capabilities/default.json`의 `"windows"`도 `["win-*"]`로 바뀜.
