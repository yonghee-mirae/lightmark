# Config Specification

## File Location
Windows: %APPDATA%/LightMark/config.json
macOS: ~/Library/Application Support/LightMark/config.json
Linux: ~/.config/LightMark/config.json

## Schema
```json
{
  "theme":"github-light",
  "customCss":"",
  "fontFamily":"sans-serif",
  "codeFontFamily":"monospace",
  "zoom":100,
  "tocVisible":false,
  "syntaxHighlight":true,
  "mermaid":true,
  "mermaidTheme":"auto",
  "katex":true,
  "printUseLightTheme":true,
  "viewerMaxWidth":0
}
```

`theme`: 내장값 `"github-light"`(기본값) | `"github-dark"` | `"dracula"` | `"nord"` | `"solarized-light"` | `"solarized-dark"` | `"one-light"` | `"one-dark-pro"` | `"gruvbox-light-medium"` | `"gruvbox-dark-medium"`. 이 문자열이 Shiki의 내장 테마 이름과 정확히 일치해서(`docs/PLAN.md` M4) 코드 하이라이팅 배색도 별도 매핑 없이 그대로 따라간다. 인식 안 되는 값(오타, 아직 없는 테마)은 다크로 폴백한다(`frontend/src/core/theme.ts`의 `isLightTheme`/`THEMES`가 유일한 기준 — mermaid의 라이트/다크 자동 판단도 이 함수를 그대로 재사용).

`mermaidTheme`: `"auto"`(기본값, `theme`을 보고 라이트/다크 자동 선택) | `"light"` | `"dark"`. `customCss`로 `theme`이 나타내는 것과 다른 배색으로 바꾼 경우 자동 선택이 틀릴 수 있어서, 이 값으로 mermaid 다이어그램의 라이트/다크를 `theme`과 무관하게 직접 지정할 수 있다.

`viewerMaxWidth`: 뷰어 본문 최대 폭(px). 기본값 `0`은 "제한 없음" — 뷰어가 창 폭 전체를 그대로 채운다(word-wrap은 창 가장자리에서만 일어남). `0`보다 큰 값을 넣으면 본문이 그 폭으로 좁아지고 좌우 여백이 동일하게 가운데 정렬된다. on/off 스위치가 아니라 폭 값 자체를 사용자가 직접 정하는 방식(사용자 요청). TOC Toggle/Zoom과 달리 세션 중 바꿀 수 있는 UI 컨트롤 자체가 없음 — **편집은 config.json에서만** 가능하고, 상태바(파일명 오른쪽)는 현재 값을 `Width: Full`/`Width: {값}px`로 읽기 전용 표시만 한다(`CLAUDE.md`의 "No graphical settings editor"에 가장 가까운 필드).

## Internal State (not user-editable, not part of this spec)

`config.json`은 사용자가 직접 편집하는 설정만 담는다(`CLAUDE.md`의 "No graphical settings editor" — 파일을 직접 열어 고치는 게 유일한 편집 경로).

앱이 스스로 기억하는 내부 편의 상태(예: Open 다이얼로그가 마지막으로 열었던 디렉터리)는 이 스키마에 넣지 않고, 같은 디렉터리의 별도 파일 `state.json`에 저장한다 — 두 파일을 분리해서 `config.json`이 사람이 편집할 이유가 없는 필드로 오염되지 않게 한다. Tauri 전용(Web/Dev에는 이 기능이 없음).

- **위치**: `config.json`과 동일한 디렉터리 (`~/.config/LightMark/state.json` on Linux 등)
- **스키마**:
  ```json
  {
    "lastOpenedDir": "/home/user/Documents"
  }
  ```
- 파일이 없거나 깨져 있어도 앱은 죽지 않고 그냥 빈 상태로 취급한다(`lastOpenedDir: null`인 것처럼 동작).
- `lastOpenedDir`가 가리키는 디렉터리가 더 이상 존재하지 않으면(삭제/이동/마운트 해제) Open 다이얼로그는 사용자 홈 디렉터리를 시작 위치로 대신 사용한다.
