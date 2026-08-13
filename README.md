# LightMark

**Fast. Lightweight. Focused.**

- **버전**: 0.1.0
- **개발자**: Yonghee Yu

## 소개

LightMark는 크로스 플랫폼 Markdown **뷰어**입니다. 편집기가 아닙니다 — 원하는 에디터(VSCode, Cursor, Zed, Vim, Neovim, Emacs, Obsidian 등)로 문서를 작성하고, LightMark로는 렌더링과 읽기만 담당합니다.

## 특징

- **Fast** — 시작 1초 이내, 1만 줄 문서 열기 300ms 이내
- **Lightweight** — 일반 문서 기준 메모리 30MB 이하
- **Live Reload** — 외부 에디터에서 저장하면 500ms 이내 자동 갱신
- **Viewer Only** — 편집/자동저장/WYSIWYG 없음
- **Local-first** — 클라우드 동기화 없음, 전부 로컬에서 동작
- **여러 문서 동시에** — 문서마다 독립된 창(멀티 윈도우), 더블클릭/CLI/"Open With"로 새 창
- **Minimal dependencies** — 필요한 것만 지연 로딩

## 기능

- **Markdown 렌더링**: CommonMark + GFM(표, 취소선, task list, 자동 링크)
- **목차(TOC)**: 왼쪽 사이드바, 토글·크기 조절 가능, 계층 구조, 현재 섹션 강조
- **Breadcrumb**: 스크롤 위치에 따라 뷰어 상단에 토스트로 잠깐 표시
- **다이어그램 / 수식 / 문법 강조**: Mermaid, KaTeX, Shiki (문서에 실제로 쓰일 때만 지연 로딩)
- **테마**: 내장 `github-light`/`github-dark` + `customCss`로 자유롭게 커스터마이즈
- **폰트**: 본문/코드 폰트 각각 지정
- **Zoom**: 50~200% 배율 조절, 툴바 버튼·단축키로 조절, 상태바에 현재 배율 표시
- **뷰어 폭 제한**: `config.json`의 `viewerMaxWidth`로 읽기 컬럼 폭 지정(기본은 창 전체 폭)
- **인쇄**: 툴바/TOC/상태바 제외하고 인쇄, OS 프린트 대화상자로 PDF 저장 가능
- **드래그&드롭**: 파일 하나는 그 창에서 바로 열기, 여러 개를 한꺼번에 드롭하면 파일마다 새 창
- **JSON 기반 설정**: `config.json`을 직접 편집(그래픽 설정 화면 없음), 툴바의 **Apply**로 재적용

## 설치 (macOS)

> Windows/Linux 설치 안내는 추후 추가됩니다.

1. `.dmg` 파일을 받습니다.
2. 마운트한 뒤 **LightMark.app**을 **Applications** 폴더로 드래그합니다.
3. 처음 실행할 때 서명이 없어서(Apple Developer 인증 미가입) macOS가 막을 수 있습니다 — 다음 중 한 가지로 열어주세요:
   - **터미널**(가장 간단):
     ```bash
     xattr -cr /Applications/LightMark.app
     ```
     이후 정상적으로 더블클릭 실행됩니다.
   - **시스템 설정**: 더블클릭 → 경고 창 닫기 → **시스템 설정 → 개인정보 보호 및 보안** 맨 아래로 스크롤 → 차단됐다는 안내 옆의 **"그래도 열기"** 클릭 → 암호/Touch ID 확인.

## 설정 파일 수정

LightMark는 그래픽 설정 화면이 없습니다 — `config.json` 파일을 직접 편집하는 게 유일한 설정 경로입니다.

### 위치

| OS | 경로 |
|---|---|
| macOS | `~/Library/Application Support/LightMark/config.json` |
| Windows | `%APPDATA%/LightMark/config.json` |
| Linux | `~/.config/LightMark/config.json` |

툴바의 **Config** 버튼(단축키 `Cmd+,`)을 누르면 이 폴더가 파일 탐색기(Finder 등)로 바로 열립니다.

### 수정 방법

1. `config.json`을 텍스트 에디터로 엽니다(파일이 없으면 앱을 한 번 실행하면 기본값으로 자동 생성됩니다).
2. 원하는 값을 수정하고 저장합니다.
3. LightMark 툴바의 **Apply** 버튼(단축키 `Cmd+Shift+R`)을 누르면 **앱을 재시작하지 않고도** 바로 반영됩니다.

파일이 깨졌거나 지워진 상태로 **Apply**를 누르면, 기존 파일을 `config.json.bak`으로 백업한 뒤 기본값으로 새로 만들어줍니다(앱을 처음 실행할 때도 마찬가지로 없으면 자동 생성됩니다).

### 필드

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `theme` | string | `"github-light"` | 내장 테마: `"github-light"` \| `"github-dark"` |
| `customCss` | string | `""` | 테마 위에 덧씌울 커스텀 CSS |
| `fontFamily` | string | `"sans-serif"` | 본문 폰트 |
| `codeFontFamily` | string | `"monospace"` | 코드 폰트 |
| `zoom` | number | `100` | 기본 확대 배율(%). 50~200 범위 |
| `tocVisible` | boolean | `false` | 문서를 열었을 때 TOC를 기본으로 보여줄지 |
| `syntaxHighlight` | boolean | `true` | 코드블록 문법 강조(Shiki) 사용 여부 |
| `mermaid` | boolean | `true` | Mermaid 다이어그램 렌더링 여부 |
| `mermaidTheme` | string | `"auto"` | Mermaid 배색: `"auto"` \| `"light"` \| `"dark"` |
| `katex` | boolean | `true` | 수식(KaTeX) 렌더링 여부 |
| `printUseLightTheme` | boolean | `true` | 인쇄 시 항상 라이트 테마로 강제할지 |
| `viewerMaxWidth` | number | `0` | 뷰어 본문 최대 폭(px). `0`은 제한 없음(창 전체 폭) |

## 단축키

`Cmd`(macOS) / `Ctrl`(Windows·Linux) 기준입니다. 해당 툴바 버튼이 비활성 상태(문서 없음 등)인 조건에서는 단축키도 동작하지 않습니다.

| 단축키 | 동작 |
|---|---|
| `Cmd+O` | 파일 열기 (Open) |
| `Cmd+P` | 인쇄 (Print) |
| `Cmd+B` | 목차(TOC) 토글 |
| `Cmd+=` / `Cmd+-` | 확대 / 축소 (Zoom) |
| `Cmd+0` | 배율 리셋 (기본 배율로) |
| `Cmd+,` | Config 폴더 열기 |
| `Cmd+Shift+R` | Apply (config.json 재적용) |
