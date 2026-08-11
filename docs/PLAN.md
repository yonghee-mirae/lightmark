# LightMark 구현 계획

## Context

`lightmark` 저장소에는 `CLAUDE.md`와 `docs/` 문서만 있고 코드가 전혀 없는 상태에서 이 계획을 작성했다. 문서는 제품 방향(Viewer 전용, 가볍고 빠름, Tauri는 패키징 계층)과 6개 마일스톤을 정의하지만, 실제 파일 구조·모듈 경계·개발 실행 방식은 미정이었다. 이 문서는 그것들을 구현 가능한 단위로 번역해 M1~M6 전체 로드맵을 정의하고, 각 단계의 산출물과 검증 기준을 못박는 것을 목표로 한다.

핵심 제약 하나가 구조 전반을 결정한다: **개발 단계는 Tauri에 전혀 의존하지 않는다.** 프론트엔드는 Firefox/Chrome에서 `npm run dev`로, Rust 백엔드는 `cargo run -p backend`로 각각 단독 실행된다. Tauri는 배포 시점에만 두 조각을 묶는다.

이 결정들의 핵심 요약은 `ARCHITECTURE.md`/`IPC_SPEC.md`/`TASKS.md`/`RULES.md`/`UI_SPEC.md`에도 반영되어 있다. 이 문서는 그 배경과 마일스톤별 상세 실행 계획을 담는다.

---

## 아키텍처

### 실행 모드

| 모드 | 실행 | BackendApi | 파일 읽기 | Live Reload |
|---|---|---|---|---|
| Web | `npm run dev` | `WebBackend` | `<input type=file>` / drop | 미지원 (`Auto Reload: N/A`) |
| Dev | `cargo run -p backend` + `npm run dev` | `DevBackend` | `GET /api/file?path=` | SSE `/api/events` |
| Tauri | `npm run tauri dev` / 배포 | `TauriBackend` | `invoke("read_file")` | `file-changed` 이벤트 |

모드 선택은 `platform/backend.ts`의 팩토리 한 곳에서만 판단한다:
1. `window.__TAURI_INTERNALS__` 존재 → Tauri
2. `import.meta.env.DEV` 이고 dev 서버 헬스체크(`GET /api/health`) 성공 → Dev
3. 그 외 → Web

### 디렉토리 구조

```text
lightmark/
  Cargo.toml                  # workspace: backend, src-tauri
  backend/
    Cargo.toml                # feature "dev-server" (기본 off)
    src/
      lib.rs                  # pub use file, watcher, config
      file.rs                 # read_file, 인코딩/개행 정규화
      watcher.rs              # notify 래핑 + 디바운스
      config.rs               # 기본값, 병합, 경로 해석
      bin/devserver.rs        # #[cfg(feature = "dev-server")] axum + SSE
  src-tauri/
    Cargo.toml
    src/main.rs               # IPC 커맨드 바인딩만
    tauri.conf.json
  frontend/
    package.json
    vite.config.ts
    index.html
    src/
      main.ts                 # 조립 + 컴포넌트 간 이벤트 배선
      core/
        markdown.ts           # markdown-it 인스턴스 + 커스텀 룰
        toc.ts                # 토큰 → TOC 트리
        breadcrumb.ts         # 활성 heading → 경로
        theme.ts              # 테마/폰트/zoom → CSS 변수
        slug.ts               # heading id 생성 (중복 처리)
        lazy/
          mermaid.ts
          katex.ts
          shiki.ts
      components/
        lm-toolbar.ts
        lm-breadcrumb.ts
        lm-toc.ts
        lm-viewer.ts
        lm-statusbar.ts
      platform/
        backend.ts            # BackendApi 인터페이스 + 팩토리
        web.ts
        dev.ts
        tauri.ts              # @tauri-apps/api import 허용되는 유일한 파일
      styles/
      types/config.ts         # Config 타입 + DEFAULT_CONFIG
  docs/
```

### BackendApi (계약 고정)

```ts
export interface BackendApi {
  openFile(): Promise<OpenedFile | null>;
  readFile(path: string): Promise<string>;
  watchFile(path: string, onChange: () => void): Promise<Unwatch>;
  readConfig(): Promise<Config>;
  reloadConfig(): Promise<Config>;
  openConfigFolder(): Promise<void>;
  openConfigFile(): Promise<void>;
  resetConfig(): Promise<Config>;
  readonly capabilities: { watch: boolean; configFile: boolean };
}
export interface OpenedFile { path: string; name: string; content: string; }
export type Unwatch = () => void;
```

`capabilities`가 UI 분기의 단일 근거다 — `lm-statusbar`는 `capabilities.watch`가 false면 `Auto Reload: N/A`, `lm-toolbar`는 `capabilities.configFile`이 false면 Config 버튼을 숨긴다. 컴포넌트가 실행 모드를 직접 묻는 코드를 두지 않는다.

`watchFile`이 콜백+unwatch 핸들을 반환하므로 `unwatch_file`은 프론트 API 표면에서 사라지고 어댑터 내부 구현으로 들어간다.

---

## 마일스톤

### M1 — 부트스트랩

**산출물**
- `frontend/package.json`: `vite`, `typescript`, `vitest`, `eslint`, `prettier` (devDeps) / `markdown-it` (dep)
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`
- ESLint 규칙 추가: `no-restricted-imports`로 `@tauri-apps/*`를 금지하고 `src/platform/tauri.ts`에서만 override — CLAUDE.md의 "Tauri import 격리"를 사람이 지키는 규칙이 아니라 린트 에러로 강제
- `index.html` + 5개 Web Component 껍데기(등록만, 렌더 없음) + `styles/`의 CSS 변수 토큰
- `types/config.ts`: `CONFIG_SPEC.md` 스키마 그대로 + `DEFAULT_CONFIG`
- `platform/backend.ts` 인터페이스 + `web.ts` 구현(파일 선택/드래그앤드롭), 팩토리는 Web만 반환

**검증**: `npm run dev` → Firefox/Chrome에서 4분할 레이아웃이 보이고, .md를 드롭하면 raw 텍스트가 `lm-viewer`에 뜬다. `npm run lint`, `npm run build`, `npx tsc --noEmit` 무에러.

---

### M2 — 렌더러 / TOC / Breadcrumb

**핵심 결정: 플러그인 대신 커스텀 룰.** GFM 요구사항 중 표·취소선은 markdown-it 내장, 링크는 `linkify: true`로 커버된다. 나머지는 작은 커스텀 룰로 해결해 의존성을 markdown-it 하나로 유지한다.
- task list: `core/markdown.ts`의 `core` 룰러에서 `[ ]`/`[x]` 리스트 아이템을 disabled checkbox로 치환
- 수식: `$…$` / `$$…$$`를 인라인/블록 룰로 잡아 `<span class="lm-math">` 플레이스홀더만 생성 (KaTeX는 M4에서 지연 로딩)
- heading id: `core/slug.ts`로 생성, 동일 slug는 `-1`, `-2` 접미

`html: false`로 시작한다 (임의 .md를 여는 뷰어라 raw HTML은 XSS 경로). 아래 Open Questions 참고.

**TOC/Breadcrumb는 DOM이 아니라 토큰에서 만든다.** `markdown.ts`가 `{ html, headings: Heading[] }`을 함께 반환 → `toc.ts`가 `Heading[]`을 트리로, `breadcrumb.ts`가 활성 heading id를 조상 경로로 변환. 순수 함수라 Vitest로 직접 검증 가능하고, 큰 문서에서 DOM 재순회를 피한다.

**활성 heading 추적 (구현 후 확정된 설계)**: `lm-viewer`가 `IntersectionObserver`로 담당하고 `lm-toc`/`lm-breadcrumb`은 `lm-active-heading` 이벤트를 받아 하이라이트만 한다. 세부 구현은 계획보다 한 단계 더 정교해졌다 — 단순 "상단 N% 영역에 들어오면 활성" 방식은 실측 결과 어긋났다:
- **root/밴드**: `root: this`(lm-viewer는 자체 스크롤 컨테이너이므로 window가 아니라 자기 자신 기준), `rootMargin: '0px 0px -98% 0px'`로 pane 상단에 얇은(2%) trip-wire를 둔다.
- **enter만 신뢰**: heading이 trip-wire에 **진입(enter)**하는 순간만 활성 신호로 쓰고 **exit는 무시**한다. exit는 heading이 자기 줄 높이만큼 화면 위로 완전히 사라져야 발생해서, 이걸 근거로 다음 heading으로 넘기면 항상 늦게 전환된다.
- **`scrollend` 보정**: 트랙패드 플링 등 아주 빠른 스크롤은 두 intersection 샘플 사이에 heading이 trip-wire를 통째로 건너뛸 수 있다. `lm-viewer`에 `scrollend`(스크롤 제스처당 1회, 프레임마다 도는 핸들러 아님) 리스너를 달아 이때만 실제 좌표(`getBoundingClientRect`)로 "top을 지난 마지막 heading"을 재계산해 보정한다. 이 보정은 첫 heading을 기본값으로 두어야 한다 — 문서 맨 위로 스크롤했을 때 어떤 heading도 "top을 지났다"는 조건을 만족하지 못하는 경우(padding 때문에 top이 정확히 0이 아님)를 이전 상태 유지가 아니라 첫 heading으로 되돌리기 위함.

**Breadcrumb는 고정 행이 아니라 Viewer 영역 상단의 토스트다 (UI 변경으로 확정).** 처음엔 항상 보이는 고정 높이 행(`#app` grid의 별도 row)으로 두었으나, 이후 "구분된 영역보다는 떠 있는 알림창 느낌"을 원하는 요구로 바꿨다: `#app` grid에서 breadcrumb 전용 row를 없애고, `lm-breadcrumb`를 `lm-viewer`와 함께 `.lm-viewer-pane`(`position: relative`) 안에 넣어 `position: absolute`로 얹었다. `lm-active-heading` 이벤트로 활성 heading이 바뀔 때만(`lm-viewer`가 동일 id 재호출을 이미 걸러내므로 매 이벤트가 실제 변경) 페이드인하고 1.5초 뒤 자동 페이드아웃한다(연속 변경 시 타이머 리셋). 폭 축약(전체 체인이 넘치면 `First > ... > Last`, 그래도 넘치면 First/Last 각각 CSS `text-overflow: ellipsis`) 로직은 그대로다. 축약 여부는 축소되지 않는 상태로 전체 체인을 렌더해 `scrollWidth`가 실제로 넘치는지 측정해서 판단(JS로 글자 수를 계산하지 않음)하고, 측정 기준은 Viewer 영역 폭(TOC는 침범하지 않음)이다. `ResizeObserver`로 폭 변화에 재계산한다.

**검증**: `docs/PRD.md`를 열어 렌더/TOC 계층/스크롤 시 breadcrumb 갱신 확인. 10k줄 생성 문서에서 파싱+렌더 < 300ms (`performance.now()` 계측, `lm-statusbar`에 dev 전용 표시). Vitest로 toc/breadcrumb/slug 단위 테스트. 추가로: 느린/빠른 스크롤 양방향, 문서 맨 위/아래 경계, 좁은 폭에서 breadcrumb 축약을 수동 확인.

---

### M3 — 테마 / 폰트 / Zoom

- `core/theme.ts`: Config → `:root` CSS 변수 주입. 내장 테마는 `github-light`, `github-dark` 2종 + `prefers-color-scheme` 연동
- `customCss`: 별도 `<style id="lm-custom">`에 주입 (교체 시 통째로 replace)
- 폰트: 시스템 폰트 스택 우선, `fontFamily`/`codeFontFamily`는 그 앞에 붙임. 웹폰트 번들 금지(시작 비용)
- Zoom: `--lm-zoom` 변수로 본문 컨테이너에만 적용 (툴바/상태바 크기 고정)
- `printUseLightTheme` + `@media print`: 툴바/TOC/상태바 숨김, 코드블록 페이지 분할 방지

**검증**: 테마 전환 시 깜빡임 없음, 인쇄 미리보기에서 툴바/TOC/상태바 미표시, zoom 50~200% 레이아웃 정상.

**구현 후 확정된 사항**:
- 계획대로 전부 `core/theme.ts` 한 파일에 둔다(디렉토리 구조 문서와 동일). `computeCssVars(config)`는 순수 함수(테마 토큰/폰트 스택/줌 계산)라 Vitest로 검증하고, `applyTheme(config, root?)`만 `root.style.setProperty`로 `:root` 변수를 주입하고 `<style id="lm-custom">`을 통째로 교체하는 DOM 부수효과를 담당한다 — M2의 `markdown.ts`(순수) vs `lm-viewer.ts`(DOM)와 같은 분리 원칙.
- `main.ts`에서 시작 시 `backend.readConfig()` 결과로 `applyTheme()`을 1회 호출. `WebBackend.readConfig()`는 항상 `DEFAULT_CONFIG`를 즉시 resolve하는 마이크로태스크라 첫 페인트 전에 끝나 깜빡임이 없다(실측: M5 이전에는 Web 모드에서 config.json을 실제로 읽지 않으므로 이 값이 사실상 유일한 소스).
- **`!important`가 필요한 이유**: `printUseLightTheme`는 `<html>`에 `.lm-print-light` 클래스를 토글해 인쇄 시 라이트 테마로 강제하는데, 같은 `<html>`에 `applyTheme`이 인라인 `style`로 색상 변수를 이미 주입해 두었다. 인라인 스타일은 그 자체로 대부분의 스타일시트 규칙보다 우선하므로, `@media print { .lm-print-light { ... } }`의 값에 `!important`를 붙이지 않으면 인쇄 시에도 인라인 값이 그대로 이겨 라이트 테마 강제가 무효화된다.
- 폰트: `fontFamily`/`codeFontFamily`가 공백을 포함하면(`JetBrains Mono` 등) CSS `font-family` 목록 규칙상 반드시 quote 처리해야 해서 `buildFontStack`이 공백 포함 여부로 분기한다.
- Zoom: `--lm-zoom`(줌 퍼센트/100)을 `.lm-markdown`에만 `font-size: calc(1rem * var(--lm-zoom))`로 적용한다. 툴바/상태바는 이 변수를 참조하지 않으므로 별도 처리 없이 요구사항("툴바/상태바 크기 고정")을 만족한다.
- **결정: 툴바 Zoom 버튼 배선은 M5 이후로 미룬다.** M3는 CSS/변수 경로(config → `--lm-zoom` → 레이아웃)만 범위로 하고, 그 값을 사용자가 직접 바꾸는 UI는 다루지 않는다. 이유: Web 모드에서 `WebBackend.readConfig()`는 항상 `DEFAULT_CONFIG`만 반환해 config.json이 실제로 읽히지 않으므로(M5 "Config System"에서 해결), 지금 버튼을 배선해도 값을 저장/반영할 실제 대상이 없다. 검증("zoom 50~200% 레이아웃 정상")은 이번엔 `DEFAULT_CONFIG.zoom`을 코드에서 임시로 바꿔 눈으로 확인하는 방식으로 대체했다 — M5에서 Config System이 붙으면 그때 툴바 Zoom 버튼을 실제로 배선한다.
- **버그 수정: `--lm-color-border`를 텍스트 색으로 재사용하면 안 됨.** `lm-viewer`의 빈 상태 안내문(`.lm-empty`)이 `--lm-color-border`를 글자색으로 썼는데, border는 divider용 저대비 색이라 dark 테마(`#30363d` on `#0d1117`)에서 거의 안 보였다. 별도의 `--lm-color-muted`(secondary text) 토큰을 테마별로 추가(`github-light: #656d76`, `github-dark: #8b949e`)해 `.lm-empty`가 이걸 쓰도록 수정. `tokens.css`의 pre-JS 기본값에도 동일하게 추가.

---

### M4 — 지연 로딩 (Mermaid / KaTeX / Shiki)

세 로더 모두 동일한 형태: **렌더 결과에 대상 노드가 있을 때만** `await import()`. `core/lazy/*.ts`는 각각 모듈 레벨 캐시 프로미스를 들고 있어 중복 로드를 막는다.

- Mermaid: `pre > code.language-mermaid`가 1개 이상일 때만
- KaTeX: M2가 심어둔 `.lm-math` 노드가 있을 때만. CSS도 동적 주입
- Shiki: 코드블록 존재 시. 문서에 실제로 등장한 언어만 로드. 하이라이팅은 렌더 완료 후 비동기로 덮어써서 첫 페인트를 막지 않는다

Config의 `mermaid`/`katex`/`syntaxHighlight`가 false면 import 자체를 하지 않는다.

**검증**: 세 요소가 없는 문서를 열었을 때 Network 탭에 해당 청크 요청이 없음(각 기능당 1회씩 확인). `npm run build` 후 청크가 분리되어 있고 초기 번들에 포함되지 않음.

**구현 후 확정된 사항**:
- `core/lazy/mermaid.ts`/`katex.ts`/`shiki.ts` 3개 파일, 각각 계획대로 모듈 레벨 캐시 프로미스 + "대상 노드 없으면 import 자체를 안 함" 가드를 가진다. 호출은 `lm-viewer.ts`의 `setContent()`가 DOM에 HTML을 심은 직후 `enhance()`에서 순서대로: **mermaid → shiki → katex**. mermaid를 먼저 하는 이유는 shiki의 코드블록 탐색 시점에 `language-mermaid` 블록이 이미 `<svg>`로 교체돼 있어야 shiki가 그걸 코드로 잘못 하이라이트하지 않기 때문(shiki 자체에도 별도로 `language-mermaid` 제외 필터를 둬서 mermaid config가 꺼져 있을 때도 안전).
- Config의 `mermaid`/`katex`/`syntaxHighlight` 플래그 체크는 `lm-viewer.ts`(호출 여부)에서, "대상 노드 존재 여부" 체크는 각 `lazy/*.ts` 내부에서 — 두 조건 모두 참일 때만 실제 `import()`가 일어난다. `main.ts`가 시작 시 읽은 config를 저장해 두고(M3에서 추가한 `currentConfig`) `loadFile()`에서 `viewer.setContent(html, headings, { theme, mermaid, katex, syntaxHighlight })`로 넘긴다.
- **Shiki는 언어별 지연 로딩을 자체적으로 이미 구현하고 있다.** `shiki`(fine-grained이 아닌 "full" 배럴)를 그냥 `import()`해도, 배럴 안의 모든 언어/테마 항목은 `() => import('@shikijs/langs/...')` 형태의 클로저로만 존재하고 실제로 요청한 언어만 dynamic import된다 — 그래서 우리 쪽에서 문서에 등장한 언어 목록을 따로 추적해 allowlist를 만들 필요가 없다. 테마 이름도 우리 Config의 `theme` 값(`github-light`/`github-dark`)이 Shiki의 내장 테마 이름과 그대로 일치해서 별도 매핑이 필요 없다.
- KaTeX CSS는 `import('katex/dist/katex.css')`로 JS와 함께 동적 import(`Promise.all`) — Vite가 이 청크를 code-split해서 실제 사용 시점에만 `<link>`를 주입한다. 별도 `<link rel=stylesheet>` 수동 관리 코드가 필요 없다.
- 셋 다 잘못된 입력(오타 언어명, 문법 오류 있는 mermaid/수식)에 대해 개별 블록 단위로 try/catch해서 원본을 그대로 두고 넘어간다 — 임의의 사용자 마크다운을 여는 뷰어라 이런 입력은 실제로 발생 가능한 경우라 방어 처리 대상으로 판단.
- **버그 수정: 잘못된 mermaid 문법이 try/catch에 안 걸림.** `mermaid.render()`는 문법 오류가 있어도 reject하지 않고, 대신 mermaid 내장 "error diagram"(빨간 에러 아이콘 + `Syntax error in text` + `mermaid version X.Y.Z` 텍스트가 든 SVG)을 정상적으로 resolve해버린다. 그래서 render() 주변 try/catch는 이 실패 케이스를 절대 못 잡고, 화면에는 원본 코드블록 대신 저 에러 SVG가 그대로 표시됐다(`samples/all-features.md`의 의도적으로 깨뜨린 mermaid 블록에서 실제로 재현됨). 수정: `render()` 호출 전에 `mermaid.parse(source, { suppressErrors: true })`로 먼저 검증하고, `false`가 돌아오면 render()를 호출하지 않고 원본 코드블록을 그대로 둔다. try/catch는 그 외의(파싱은 통과했지만 렌더링 단계에서 나는) 오류에 대한 방어로 남겨둠.
- **실패 시 눈에 띄는 경고 표시 (사용자 요청으로 추가).** 원래는 "실패하면 원본을 그대로 둔다"만 했는데, 그러면 뭐가 잘못됐는지 표시가 전혀 없어서 사용자 요청으로 ⚠️ 이모지가 붙은 경고 문구를 추가했다.
  - mermaid: `core/lazy/warning.ts`의 `renderWarning(message)`가 `<p class="lm-render-warning">⚠️ ...</p>`를 만들어 원본 `<pre>` 앞에 삽입(`pre.before(...)`) — mermaid 블록은 항상 block 컨텍스트(자기 `<pre>`)라 안전.
  - KaTeX: `throwOnError: false`(기본값)는 던지지 않고 KaTeX 자체의 에러 span(눈에 잘 안 띄는 빨간 텍스트)을 렌더해버려서 mermaid와 같은 문제가 있었다 — `throwOnError: true`로 바꿔 실제로 던지게 하고, catch에서 우리 경고로 교체한다. `.lm-math`는 문단 안 인라인 `<span>`일 수 있어서(블록 `<div>`인 경우도 있음) `renderWarning()`처럼 새 엘리먼트를 형제로 끼워넣지 않고, 노드 자체의 텍스트/클래스를 그 자리에서 바꾼다(`node.textContent = '⚠️ Invalid math: ...'`, `.lm-render-warning-inline` 클래스 추가) — 인라인/블록 어느 쪽이든 DOM 중첩 규칙을 깨지 않음.
  - CSS(`layout.css`)의 `.lm-render-warning`/`.lm-render-warning-inline`은 테마 토큰과 무관하게 고정된 빨간 계열 색(`#d1242f`)을 쓴다 — 경고는 라이트/다크 어느 테마든 동일하게 눈에 띄어야 하기 때문.
- **뒤늦게 발견/수정: 이미지 lazy loading이 어느 마일스톤에도 배정 안 돼 있었음.** `CLAUDE.md`의 "Images: Use lazy loading" 규칙은 M1~M4 어디에도 작업 항목으로 들어가 있지 않아서 그동안 빠져 있었다(존재하지 않는 이미지가 어떻게 보이는지 사용자가 물어보다가 드러남). 이번에 같이 처리:
  - `core/markdown.ts`: `lm_image_attrs`라는 core 룰을 추가해 모든 `image` 토큰에 `loading="lazy"`와 `class="lm-image"`를 부여(task list/heading id 룰과 같은 패턴 — 렌더러를 새로 만들지 않고 토큰에 속성만 얹음).
  - `layout.css`: `.lm-image { max-width: 100%; height: auto; }`로 뷰어보다 큰 원본 이미지가 폭을 뚫고 나가지 않게 함.
  - `core/images.ts`(신규, `core/lazy/`가 아님 — 임포트할 외부 라이브러리가 없어서 지연 로딩 패턴이 필요 없음): `<img>`마다 `error` 이벤트를 1회 리스닝해서, 실제로 로드에 실패하면 브라우저 기본 "깨진 이미지" 아이콘 대신 `.lm-render-warning-inline`(mermaid/KaTeX와 동일한 경고 스타일)로 교체. `lm-viewer.ts`의 `setContent()`에서 HTML을 심은 직후 동기적으로 호출(비동기 `enhance()`보다 먼저 — 에러 리스너는 이미지 로드가 시작되기 전에 붙어 있어야 함).

---

### M5 — Rust 백엔드 + Dev 서버 + 어댑터

**`backend` 크레이트 (Tauri 비의존)**
- `file.rs`: UTF-8 읽기(BOM 제거, CRLF→LF), 크기 상한 초과 시 에러
- `watcher.rs`: `notify` + 100ms 디바운스. 에디터의 write-replace 패턴(rename→create) 때문에 파일이 아니라 **부모 디렉토리를 감시하고 대상 경로만 필터링**한다 — 이걸 놓치면 Vim/VSCode 저장 후 watcher가 죽는다
- `config.rs`: 플랫폼별 경로(`CONFIG_SPEC.md`), 기본값 병합(부분 JSON 허용), `reset` 시 기존 파일 백업

**`bin/devserver.rs`** (`--features dev-server`, 기본 off라 배포 바이너리에 미포함)
- `axum` + `tokio`: `GET /api/health|file|config`, `POST /api/config/reload|reset`, `GET /api/events`(SSE)
- CORS는 `localhost:5173`만 허용, 바인딩은 `127.0.0.1`

**어댑터**
- `platform/dev.ts`: fetch + `EventSource`. `capabilities.watch = true`
- `platform/tauri.ts`: `invoke` + `listen`. `capabilities` 동일

**Live reload UX**: 재렌더 시 스크롤 앵커(현재 활성 heading id)를 저장 후 복원한다. 이게 없으면 저장할 때마다 문서 맨 위로 튀어서 live reload가 사실상 못 쓴다.

**의존성**: `notify`, `serde`/`serde_json`, `tokio`, `axum`(dev 전용), `dirs`. `dirs`와 `axum`은 CLAUDE.md 허용 목록에 없으므로 M5 착수 시 승인 필요 — 아래 Open Questions 참고.

**검증**: 두 터미널로 dev 서버 + Vite 실행 → Firefox에서 `?file=docs/PRD.md`로 열고 다른 편집기에서 저장 → 500ms 내 갱신되며 스크롤 위치 유지. Vim(rename 저장)과 VSCode 양쪽으로 확인. `cargo test -p backend`.

**M3에서 미룬 것**: 툴바 Zoom 버튼 배선(M3 절 참고). Config System이 실제로 config.json을 읽고/반영하게 되는 시점이라 여기서 같이 처리한다.

---

### M6 — Tauri 통합 및 패키징

- `src-tauri`: IPC 9개 커맨드를 `backend` 함수로 위임하는 바인딩만. 로직 금지
- `fs`/`dialog`/`shell`(opener) 권한을 필요한 범위로만 허용
- 파일 연결(`.md`, `.markdown`) 및 CLI 인자로 파일 열기
- 시작 시간 < 1s, 일반 문서 메모리 < 30MB 실측

**선행 확인**: 개발 환경에 `pkg-config`가 없으면 Tauri 시스템 의존성(webkit2gtk-4.1, libsoup 등)이 미설치 상태일 수 있다. M6 착수 전 설치 필요.

**검증**: `npm run tauri dev`로 전체 플로우(열기 → 편집기 저장 → 갱신 → 인쇄 → Config 폴더 열기) 확인. `npm run tauri build` 성공.

---

## Open Questions (해당 마일스톤 착수 시점에 결정)

1. **[해결됨] M2 — raw HTML 허용 여부**: `html: false`로 확정. `docs/*.md`를 grep한 결과 raw HTML은 전부 인라인 코드/코드블록 안에서만 등장(`<input type=file>`, `<span class="lm-math">` 등은 문서화 예시일 뿐)해서 실제로 깨지는 문서가 없다. sanitizer 의존성을 추가할 이유가 없으므로 보류.
2. **M5 — `axum`, `dirs` 의존성 승인**: `axum`은 dev 전용 feature라 배포 바이너리 미포함. `dirs`는 3개 OS 경로 분기를 직접 짜면 없앨 수 있다(~30줄).

---

## 검증 요약

```bash
# 프론트엔드
cd frontend && npm run dev          # Firefox/Chrome, Tauri 없이
npm run lint && npx tsc --noEmit && npm run build
npm run test                        # Vitest: core 레이어

# 백엔드 (Tauri 없이 단독)
cargo test -p backend
cargo run -p backend --features dev-server   # :7878

# 통합 (M6)
npm run tauri dev && npm run tauri build
```

마일스톤 종료 조건은 매번 동일하다: 해당 검증 통과 + 린트/빌드 무에러 + Web 모드와 (M5 이후) Dev 모드 양쪽 동작 + 관련 문서 갱신.
