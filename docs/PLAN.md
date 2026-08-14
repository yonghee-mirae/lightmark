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
| Web | `npm run dev` | `WebBackend` | `<input type=file>` / drop | 미지원 |
| Dev | `cargo run -p backend` + `npm run dev` | `DevBackend` | `GET /api/file?path=` | SSE `/api/events` |
| Tauri | `npm run tauri dev` / 배포 | `TauriBackend` | `invoke("read_file")` | `file-changed` 이벤트 |

모드 선택은 `platform/backend.ts`의 팩토리 한 곳에서만 판단한다:
1. `window.isTauri === true`(`@tauri-apps/api/core`의 `isTauri()`와 동일한 체크, import 없이 inline) → Tauri
2. `import.meta.env.DEV` 이고 dev 서버 헬스체크(`GET /api/health`) 성공 → Dev
3. 그 외 → Web

### 디렉토리 구조

```text
lightmark/
  Cargo.toml                  # workspace: backend, src-tauri
  backend/
    Cargo.toml                # feature "dev-server" (기본 off)
    src/
      lib.rs                  # pub use file, watcher, config, state
      file.rs                 # read_file, 인코딩/개행 정규화
      watcher.rs              # notify 래핑 + 디바운스
      config.rs               # 기본값, 병합, 경로 해석
      state.rs                # state.json(config.json과 별도) - Open 다이얼로그 마지막 위치 기억 (M6)
      fsutil.rs               # atomic_write (임시 파일+rename) - 멀티 윈도우 지원에서 추가
      bin/devserver.rs        # #[cfg(feature = "dev-server")] axum + SSE
  src-tauri/
    Cargo.toml
    src/lib.rs                # IPC 커맨드 바인딩만
    src/main.rs               # 엔트리 포인트 스텁, app_lib::run()(lib.rs) 호출만
    src/cli.rs                # CLI 인자 파싱 (순수 함수, 단위 테스트됨 - M6)
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
        appInfo.ts            # About용 앱 이름/태그라인/버전/개발자 (M7)
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
        lm-about.ts           # 네이티브 <dialog> 래퍼 (M7)
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
  readonly capabilities: { watch: boolean; configFile: boolean };
  openFile(): Promise<OpenedFile | null>;
  readFile(path: string): Promise<string>;
  watchFile(path: string, onChange: () => void): Promise<Unwatch>;
  readConfig(): Promise<Config>;
  reloadConfig(): Promise<Config>;
  openConfigFolder(): Promise<void>;
  // Optional: only TauriBackend implements these - Web/Dev have no native window/OS concept
  // (drag&drop onto a window, opening another window for a second file).
  onFileDrop?(cb: (paths: string[]) => void): void;
  openWindow?(path: string): Promise<void>;
}
export interface OpenedFile { path: string; name: string; content: string; }
export type Unwatch = () => void;
```

(M7에서 `openConfigFile()`/`resetConfig()`는 삭제됨. 멀티 윈도우/인스턴스 지원에서 `getInitialPath()`/`onOpenPath()`는 `onFileDrop()`/`openWindow()`로 대체됨 — 위 계약은 M6/M7 당시가 아니라 현재 기준. 각 해당 절 참고.)

`capabilities`가 UI 분기의 단일 근거다 — `lm-toolbar`는 `capabilities.configFile`이 false면 Config 버튼을 숨긴다. 컴포넌트가 실행 모드를 직접 묻는 코드를 두지 않는다. (`capabilities.watch`는 UI에 표시되지 않고 `main.ts`가 live reload를 배선할지만 내부적으로 결정한다 — `autoReload` config 필드는 별도 토글 기능 없이 사용자 요청으로 제거됨, 아래 참고.)

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
- **`scrollend` 보정**: 트랙패드 플링 등 아주 빠른 스크롤은 두 intersection 샘플 사이에 heading이 trip-wire를 통째로 건너뛸 수 있다. `lm-viewer`에 `scrollend`(스크롤 제스처당 1회, 프레임마다 도는 핸들러 아님) 리스너를 달아 이때만 실제 좌표(`getBoundingClientRect`)로 "top을 지난 마지막 heading"을 재계산해 보정한다.
- **버그 수정(사용자 리포트, M6 테스트 중 발견): 첫 heading 앞에 본문이 있으면 문서를 열거나 맨 위로 스크롤했을 때 그 heading이 잘못 focus됨.** 처음엔 "top을 지난 heading이 하나도 없으면 첫 heading을 기본값으로" 했는데(padding 때문에 첫 heading의 top이 정확히 0이 아닌 경우를 보정하려는 의도였음), 이게 "첫 heading 앞에 본문이 실제로 있어서 아직 그 heading에 도달 안 한 경우"와 구분이 안 됐다 — 두 경우 다 "top을 지난 heading 없음"으로 관측되기 때문. 수정: 기본값을 "첫 heading"에서 **"없음(null)"**으로 바꾸고, `top <= 0` 대신 `top <= TOP_TOLERANCE_PX`(24px, `lm-viewer`의 `padding: 1rem`+여유분)로 완화했다 — 이러면 진짜로 맨 위에 있는 첫 heading(패딩만큼만 밀려있음)은 여전히 잡히고, 본문이 실제로 몇 줄 이상 앞서는 경우(패딩보다 훨씬 큰 오프셋)는 정확히 걸러진다. `lm-viewer.ts`의 `computeActiveHeadingId()`로 이 로직을 `setContent()`(문서 로드 시)와 `reconcileActiveHeading()`(scrollend) 둘 다 공유하도록 합쳤다 — 이제 두 경로가 다른 기준으로 계산할 일이 없음. `ActiveHeadingDetail.id`/`lm-toc`·`lm-breadcrumb`의 `setActive`는 이미 `string | null`을 받도록 돼 있어서(구현할 때부터 그렇게 짜여 있었음) 프론트 쪽엔 이 변경이 자연스럽게 흘러들어갔다.
- **버그 수정(사용자 리포트): 문서 끝에 여러 heading이 한 화면에 다 보이는 상태에서 TOC의 다른 heading을 클릭해도 focus/breadcrumb가 안 바뀜.** "활성 heading" 추적이 전부 스크롤(IntersectionObserver enter, 또는 scrollend 보정)에 의존하는데, 클릭한 heading이 문서 끝이라 이미 화면에 다 보이는 상태면 앵커 이동이 실제 스크롤을 전혀 유발하지 않는다(이미 최대 스크롤 위치) — 그러면 `scroll`/`scrollend` 이벤트 자체가 안 나서 활성 상태를 갱신할 트리거가 없다. 수정: `lm-toc`가 링크 클릭을 직접 감지해서(`href`의 `#id`를 읽어) `lm-toc-select` 이벤트를 디스패치하고, `main.ts`가 이걸 받아 `viewer.focusHeading(id)`를 호출.
  - **1차 시도(사용자가 바로 정정): `focusHeading`이 클릭한 `id`를 무조건 활성으로 강제.** 문서 끝이라 `scrollIntoView`로도 그 heading을 화면 맨 위까지 끌어올릴 수 없는 경우(더 스크롤할 내용이 없음), 클릭한 heading이 화면 중간/아래쯔음에 머무는데도 그게 활성으로 표시돼서 어색했다 — 게다가 그 상태에서 살짝만 스크롤해도 (원래 규칙대로) 화면 맨 위 heading으로 활성이 확 바뀌어서 일관성이 없어 보였다.
  - **수정(확정)**: `focusHeading`이 클릭한 `id`를 강제하지 않고, `scrollIntoView` 이후 **`computeActiveHeadingId()`로 다시 계산**해서 그 결과를 활성으로 설정한다 — 일반적인 경우(heading이 화면 맨 위까지 잘 올라간 경우)는 결국 클릭한 heading과 같은 결과가 나오지만, 문서 끝처럼 맨 위까지 못 올라가는 경우엔 "현재 화면에서 실제로 맨 위에 있는 heading"이 선택돼서, 스크롤로 도달했을 때와 완전히 같은 규칙을 따르게 된다.

**Breadcrumb는 고정 행이 아니라 Viewer 영역 상단의 토스트다 (UI 변경으로 확정).** 처음엔 항상 보이는 고정 높이 행(`#app` grid의 별도 row)으로 두었으나, 이후 "구분된 영역보다는 떠 있는 알림창 느낌"을 원하는 요구로 바꿨다: `#app` grid에서 breadcrumb 전용 row를 없애고, `lm-breadcrumb`를 `lm-viewer`와 함께 `.lm-viewer-pane`(`position: relative`) 안에 넣어 `position: absolute`로 얹었다. `lm-active-heading` 이벤트로 활성 heading이 바뀔 때만(`lm-viewer`가 동일 id 재호출을 이미 걸러내므로 매 이벤트가 실제 변경) 페이드인하고 1.5초 뒤 자동 페이드아웃한다(연속 변경 시 타이머 리셋). 폭 축약(전체 체인이 넘치면 `First > ... > Last`, 그래도 넘치면 First/Last 각각 CSS `text-overflow: ellipsis`) 로직은 그대로다. 축약 여부는 축소되지 않는 상태로 전체 체인을 렌더해 `scrollWidth`가 실제로 넘치는지 측정해서 판단(JS로 글자 수를 계산하지 않음)하고, 측정 기준은 Viewer 영역 폭(TOC는 침범하지 않음)이다. `ResizeObserver`로 폭 변화에 재계산한다.
- **버그 수정(사용자 리포트, M7 이후): breadcrumb가 표시된 상태에서 문서 최상단으로 빠르게 스크롤하면(활성 heading이 없어짐, `id: null`) 즉시 사라져야 하는데, 이전 heading 활성화 때 걸어둔 `hideTimer`가 남아 있어서 그 타이머가 끝날 때까지 빈 영역만 계속 보이다가 사라짐.** `setActive(null)`이 `render()`로 내용(빈 크럼)만 갈아치우고 `lm-breadcrumb-visible` 클래스나 예약된 `hideTimer`는 그대로 뒀던 게 원인 — `show()`(활성 heading 있을 때: 클래스 추가 + 타이머 재예약)에 대응하는 `hide()`(활성 heading 없을 때: 타이머 즉시 취소 + 클래스 즉시 제거)가 없었다. `lm-breadcrumb.ts`에 `hide()`를 신설하고 `setActive(id)`가 `id`가 falsy면 `show()` 대신 `hide()`를 호출하도록 수정.
- **발견(전체 문서 대조 세션): TOC Resizable이 애초에 구현된 적이 없었음.** `CLAUDE.md`/`UI_SPEC.md` 둘 다 TOC가 "resizable"이어야 한다고 명시하는데, `lm-toc.ts`/`layout.css`엔 리사이즈 핸들/드래그 로직이 전혀 없고 폭은 `--lm-toc-width: 280px` 고정값뿐이었다 - TOC Engine(M2)에 포함됐어야 할 요구사항이 빠진 채로 지나간 것. 문서만 조용히 낮추면 요구사항을 임의로 낮추는 셈이라 사용자에게 확인 → "지금 구현"으로 결정, Zoom/TOC Toggle과 같은 전례(세션 전용, config.json에 안 씀 - `CLAUDE.md`의 "No graphical settings editor"는 config.json 편집 경로 얘기라 세션 중 UI 조절 값엔 안 걸림)를 따라 구현: `lm-toc.ts`의 light DOM을 `.lm-toc-list`(항목)/`.lm-toc-resize-handle`(핸들) 두 자식으로 나누고(`setToc()`가 `.lm-toc-list`만 갈아치워서 파일을 열 때마다 핸들이 같이 지워지지 않게), 핸들은 `pointerdown → setPointerCapture → pointermove(160~560px 클램프, --lm-toc-width 갱신) → pointerup` 표준 패턴.
  - **버그 수정(사용자 리포트): 세로 스크롤이 있으면 resize가 안 되고, 하면 안 된다고 못박은 가로 스크롤바가 생김.** 헤드리스 Chrome(CDP)으로 TOC에 헤딩 200개를 주입해 직접 재현·측정 - 원인은 핸들을 `position: absolute; right: -3px`로 `lm-toc` 자기 경계 밖까지 튀어나오게 배치한 것: `overflow-y: auto`인 요소에서 자식이 박스 밖으로 넘치면 overflow-wrap/word-break 수정 때 겪은 것과 같은 "overflow-x가 암묵적으로 auto가 되는" 계산이 재발동해 진짜 가로 스크롤바가 생기고, 같은 배치 때문에 핸들의 히트 영역이 실제 세로 스크롤바 자리와 겹쳐 클릭이 스크롤바한테 먼저 가로채짐. 수정: `.lm-toc-list`(`flex: 1 1 auto`)와 `.lm-toc-resize-handle`(`flex: 0 0 6px`)을 `lm-toc { display: flex }`의 서로 겹칠 수 없는 형제로 재배치.
  - **2차 발견(같은 헤드리스 테스트): flex/grid item의 `min-height: auto` 함정.** 위 구조로 바꾸자 이번엔 `lm-toc` 자체 높이가 그리드 셀 고정 높이 대신 컨텐츠 전체 높이로 늘어나 있었음(스크롤 대신 화면 전체를 밀어버림) - `overflow-y: auto`를 `lm-toc` 자신에 걸면 자동 최소 크기가 0이 되는데, 스크롤을 자식으로 옮기며 `lm-toc`가 그 계산 혜택을 못 받게 된 것. `lm-toc`에 `min-height: 0` 명시로 수정. 헤드리스 Chrome으로 가로 스크롤 없음(`scrollWidth === clientWidth`)/세로 스크롤 있어도 핸들이 정확히 히트됨(`elementFromPoint`)을 재검증. 사용자가 실제 앱에서 최종 확인("좋아. 모두 해결됐네.").

- **버그 수정(사용자 리포트): 문서 내 하이퍼링크가 앱 창 안에서 열림.** "문서 내 하이퍼링크를 클릭하면 현재 뷰어 창 안에서 열리도록 돼 있는데, 외부 앱(브라우저 등)으로 연결되도록 해줘. 문서 내 heading 링크일 경우에는 뷰어 안에서 이동하도록 두고." `lm-viewer.ts`엔 `<a>` 클릭 핸들러 자체가 없어서(마크다운도 외부/내부 링크를 구분 안 하고 동일하게 렌더링) 아무것도 안 막아 Tauri webview가 그 URL로 자기 자신을 네비게이션해버렸던 게 원인. 수정: 클릭 시 `href`가 `#`로 시작하면 그대로 두고(기존 앵커 스크롤 유지), 그 외는 `preventDefault` + `lm-external-link` 이벤트를 dispatch해 `main.ts`가 새로 추가된 필수 `BackendApi.openUrl(url)`을 호출하도록 배선(`onFileDrop`/`openWindow`와 달리 Web/Dev도 `window.open`으로 의미 있게 구현 가능해 optional로 안 둠). Tauri 쪽은 `open_config_folder`와 같은 패턴으로 새 커맨드 `open_url`을 만들어 `tauri-plugin-opener`의 `Opener` 확장 트레잇을 직접 호출(플러그인 자체 IPC 커맨드의 ACL 스코프 체크를 우회 - 새 npm 패키지도 불필요), `capabilities/default.json`에 `opener:allow-open-url` 추가. 헤드리스 Chrome으로 외부 링크(`preventDefault`+이벤트 발생)/앵커 링크(둘 다 안 함) 클릭을 실제로 재현해서 검증.

**검증**: `docs/PRD.md`를 열어 렌더/TOC 계층/스크롤 시 breadcrumb 갱신 확인. 10k줄 생성 문서에서 파싱+렌더 < 300ms (`performance.now()` 계측, `lm-statusbar`에 표시 - 원래 dev 전용이었으나 macOS 세션에서 사용자 요청으로 항상 표시로 변경, `docs/UI_SPEC.md` 참고). Vitest로 toc/breadcrumb/slug 단위 테스트. 추가로: 느린/빠른 스크롤 양방향, 문서 맨 위/아래 경계, 좁은 폭에서 breadcrumb 축약을 수동 확인.

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
- **버그 수정(사용자 리포트, M6 테스트 중 발견): PDF로 인쇄하면 문서 전체가 아니라 화면에 보이던 한 화면 분량만 나옴.** `#app`(`height: 100vh`)/`.lm-content`(`overflow: hidden`)/`lm-viewer`(`overflow-y: auto`, `flex: 1`)는 전부 화면에서 스크롤 가능한 고정 높이 패널을 만들기 위한 규칙인데, `@media print`가 툴바/TOC/상태바를 숨기는 것만 하고 이 높이/overflow 제약은 그대로 둬서, 인쇄 시에도 브라우저가 "화면에 보이는 한 뷰포트 분량"만 렌더링했다. 수정: `@media print`에서 `#app`은 `height: auto`, `.lm-content`/`.lm-viewer-pane`/`lm-viewer`는 `overflow: visible`(+`lm-viewer`는 `height: auto`)로 재정의해서 전체 문서가 여러 페이지에 걸쳐 자연스럽게 흐르도록 함. `.lm-content`의 `grid-template-columns`도 TOC가 숨겨진 만큼 1열로 좁힘(TOC 칸 너비만큼 빈 공간이 남는 걸 방지).
- 폰트: `fontFamily`/`codeFontFamily`가 공백을 포함하면(`JetBrains Mono` 등) CSS `font-family` 목록 규칙상 반드시 quote 처리해야 해서 `buildFontStack`이 공백 포함 여부로 분기한다.
- Zoom: `--lm-zoom`(줌 퍼센트/100)을 `.lm-markdown`에만 `font-size: calc(1rem * var(--lm-zoom))`로 적용한다. 툴바/상태바는 이 변수를 참조하지 않으므로 별도 처리 없이 요구사항("툴바/상태바 크기 고정")을 만족한다.
- **결정: 툴바 Zoom 버튼 배선은 M5 이후로 미룬다.** M3는 CSS/변수 경로(config → `--lm-zoom` → 레이아웃)만 범위로 하고, 그 값을 사용자가 직접 바꾸는 UI는 다루지 않는다. 이유: Web 모드에서 `WebBackend.readConfig()`는 항상 `DEFAULT_CONFIG`만 반환해 config.json이 실제로 읽히지 않으므로(M5 "Config System"에서 해결), 지금 버튼을 배선해도 값을 저장/반영할 실제 대상이 없다. 검증("zoom 50~200% 레이아웃 정상")은 이번엔 `DEFAULT_CONFIG.zoom`을 코드에서 임시로 바꿔 눈으로 확인하는 방식으로 대체했다 — M5에서 Config System이 붙으면 그때 툴바 Zoom 버튼을 실제로 배선한다.
- **버그 수정: `--lm-color-border`를 텍스트 색으로 재사용하면 안 됨.** `lm-viewer`의 빈 상태 안내문(`.lm-empty`)이 `--lm-color-border`를 글자색으로 썼는데, border는 divider용 저대비 색이라 dark 테마(`#30363d` on `#0d1117`)에서 거의 안 보였다. 별도의 `--lm-color-muted`(secondary text) 토큰을 테마별로 추가(`github-light: #656d76`, `github-dark: #8b949e`)해 `.lm-empty`가 이걸 쓰도록 수정. `tokens.css`의 pre-JS 기본값에도 동일하게 추가.
- **버그 수정(사용자 리포트, M6 테스트 중 발견, 확정): Tauri(WebKitGTK)에서 글자가 두꺼워 보임.** `fc-match`로 직접 확인: 이 환경엔 `fontFamily` 기본값 `Pretendard`가 설치돼 있지 않고, `system-ui`/`sans-serif`조차 이 시스템에 설치된 유일한 sans 폰트(`Noto Sans`)로 매칭된다 — 즉 폰트 자체나 `font-weight`(devtools로 미지정=normal 확인) 문제가 아니라, **같은 폰트/굵기/크기인데도 WebKitGTK가 Chromium보다 텍스트를 더 두껍게 래스터라이즈하는** 엔진 차이.
  - 중간 시행착오: `.lm-markdown`(뷰어)에만 좁게 적용 → 뷰어는 좋아졌는데 사용자가 "TOC가 굵어졌다"고 리포트 → "상대적 착시"로 잘못 판단해 넘어갔다가 사용자가 강하게 정정(TOC는 원래 정상이었음). 정확한 인과관계(형제 서브트리인 `.lm-markdown`이 `lm-toc`에 영향을 줄 CSS 상속 경로가 없음)는 끝내 설명 못 했지만, 매번 Tauri 앱을 완전히 재시작하며 재확인한 결과 최종적으로 `html, body`(전체 적용)에서 뷰어/TOC 둘 다 정상으로 확인됨.
  - 수정: `html, body`에 `-webkit-font-smoothing: antialiased` + `-moz-osx-font-smoothing: grayscale` — 앱 전체에 상속으로 한 번에 적용. Chromium/Firefox는 대부분 무시하므로 회귀 위험 없음.
  - **알려진 업스트림 이슈, 참고용**: [tauri-apps/tauri#14286](https://github.com/tauri-apps/tauri/issues/14286) — WebKitGTK(Linux)가 지정된 font-weight보다 약 +100 무겁게 렌더링하는, 아직 미해결인 업스트림 버그(computed style은 정상인데 실제 래스터라이즈만 두꺼움 — 우리가 겪은 증상과 일치). 이 이슈와 [관련 정리 글](https://medium.com/@dasunnimantha777/fonts-render-too-bold-in-rust-tauri-wails-on-linux-a-webkitgtk-bug-and-how-to-fix-it-8b6a0b27b613)은 둘 다 "스크롤/overflow/compositing과 무관하다"고 명시하는데, 우리가 관찰한 "TOC에 스크롤바가 생길 때만 굵어짐" 현상은 여기 안 나온 별개 각도라 완전히 설명되진 않음. 이 글이 제시하는 "정식" 해결법은 weight 300 폰트를 직접 번들링해 `@font-face`로 등록하고 일부러 더 가벼운 weight를 지정해 +100 오프셋을 상쇄하는 것인데, 이건 `CLAUDE.md`의 "웹폰트 번들 금지" 원칙과 충돌해서 적용 안 함 — 지금은 `-webkit-font-smoothing`만으로 사용자가 정상으로 확인해서 여기서 멈춤. 증상이 재발하면 이 트레이드오프를 다시 검토.
- **개선(사용자 요청): 기본 config 값 변경.** `fontFamily`/`codeFontFamily` 기본값을 `Pretendard`/`JetBrains Mono`(둘 다 이 환경엔 설치돼 있지 않음, 위 WebKitGTK 폰트 굵기 조사에서 `fc-match`로 확인)에서 제네릭 CSS 키워드 `sans-serif`/`monospace`로 변경 — `buildFontStack`이 이미 시스템 폰트 스택 뒤에 붙이는 구조라 동작은 그대로(`sans-serif, system-ui, ...`처럼 중복되지만 해롭지 않음), 설치돼 있을 필요가 없는 값으로 바뀐 것뿐. `printUseLightTheme` 기본값도 `false`→`true`로 변경(다크 테마로 인쇄해도 항상 라이트로 강제). `frontend/src/types/config.ts`(`DEFAULT_CONFIG`)/`backend/src/config.rs`(`Config::default()`)/`docs/CONFIG_SPEC.md`(스키마 예시) 세 곳 동시 수정 — 세 군데가 항상 값이 같아야 한다는 기존 설계(`config.rs` 파일 상단 주석) 그대로 유지.
- **개선(사용자 요청): 내장 테마 8종 추가.** github-light/dark 2종뿐이던 걸 Dracula/Nord/Solarized(light/dark)/One Dark·Light/Gruvbox(light/dark medium) 8종 추가해 10종으로 — 각 테마의 공식 팔레트에서 `bg`/`fg`/`border`/`muted`/`accent` 5토큰을 가져옴. 테마 이름을 Shiki의 내장 테마 ID와 정확히 맞춰서(Shiki가 이미 전부 번들하고 있음) 코드 하이라이팅 배색도 추가 매핑 없이 그대로 따라감(M4의 기존 설계 그대로 확장). `resolveThemeTokens`는 이진 분기에서 `Record<string, ThemeTokens>` 조회 테이블로, `isLightTheme`는 `LIGHT_THEMES` Set 기반으로 일반화 — `core/lazy/mermaid.ts`의 `mermaidThemeOf`가 이 `isLightTheme`를 그대로 재사용하는 구조라 mermaid 쪽 수정 없이 새 테마들에도 자동 적용됨. `docs/CONFIG_SPEC.md`에 `theme` 필드 전체 허용값 목록 신규 추가. 검증: Vitest에 테마별 테스트 추가(30→49개), Shiki `codeToHtml`을 10개 테마 전부에 직접 호출해서 이름 오타 없음 실측 확인. 상세: `HANDOFF.md`.

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
- **버그 수정(사용자 리포트): `theme`을 `github-dark`로 바꾸면 mermaid 다이어그램 선이 잘 안 보임.** `mermaid.initialize()`가 `theme` 옵션 없이 호출되고 있어서 앱 테마와 무관하게 항상 mermaid 기본 테마(`default` — 밝은 배경을 전제로 짙은 글자/선)로 렌더링됐던 게 원인. 위 185번째 줄의 "Shiki는 우리 `theme` 값과 내장 테마 이름이 그대로 일치해서 매핑이 필요 없다"는 mermaid에는 적용되지 않는다 — mermaid는 자체 테마 이름 체계(`default`/`dark`/`forest`/`neutral`/`base`)를 쓴다. 수정: `core/lazy/mermaid.ts`에 순수 함수 `mermaidThemeOf(appTheme)`을 추가해서 `mermaid.initialize({ startOnLoad: false, theme: mermaidThemeOf(appTheme) })`로 전달. `renderMermaid(container, appTheme)`으로 시그니처 변경, 호출부(`lm-viewer.ts`의 `enhance()`)는 이미 갖고 있던 `options.theme`을 그대로 넘겨주기만 하면 됨.
  - **후속 질문(사용자): 사용자가 커스텀 테마를 지정한 경우는?** `config.theme`은 그냥 문자열이라(`config.rs`도 검증 없음) `github-light`/`github-dark`가 아닌 임의 값을 넣을 수 있는데, `theme.ts`의 `resolveThemeTokens`는 그런 미인식 값을 전부 다크 토큰으로 폴백한다. 처음 짠 `mermaidThemeOf`는 `appTheme === 'github-dark'`만 `'dark'`로 취급하고 **그 외 전부(미인식 값 포함) `'default'`**로 보내서, 미인식/커스텀 테마 이름을 썼을 때 앱 전체는 다크인데 mermaid만 라이트로 어긋나는 같은 버그가 재발할 뻔했다. 수정: `theme.ts`에 `isLightTheme(theme)`(`theme === 'github-light'`인지만 확인)를 export하고 `resolveThemeTokens`도 이걸로 다시 쓰게 해서 폴백 로직의 단일 소스로 만든 뒤, `mermaidThemeOf`가 이걸 가져와 씀(`isLightTheme(appTheme) ? 'default' : 'dark'`) — 이제 미인식/커스텀 이름은 앱 전체와 mermaid가 항상 같은 방향(다크)으로 폴백한다.
  - **재질문(사용자): `customCss`로 배색을 바꾼 경우 mermaid의 라이트/다크를 별도로 지정할 수 있어야 하지 않나?** 맞는 지적 — `mermaidThemeOf`가 `theme` 값만 보고 자동으로 라이트/다크를 고르는데, `customCss`(`<style id="lm-custom">`)는 우리 CSS 변수/셀렉터만 덮어쓸 뿐 `theme` 필드 자체는 그대로라서, `customCss`로 실제 배색을 뒤집어도 `mermaidThemeOf`는 그걸 알 방법이 없다(mermaid는 렌더링 시점에 SVG 내부에 색을 직접 구워서 반환하므로 `customCss`가 사후에 mermaid 색을 덮어쓸 수도 없음 — 자동 감지가 유일한 경로). 그래서 자동 감지를 대체할 명시적 설정을 신설: **`CONFIG_SPEC.md`에 `mermaidTheme` 필드 추가**(`"auto"`(기본값)/`"light"`/`"dark"`) — `"light"`/`"dark"`는 `theme` 값과 무관하게 mermaid 선택을 강제하고, 그 외(`"auto"`, 미설정, 오타)는 기존 `theme` 기반 자동 감지를 그대로 유지. `mermaidThemeOf(appTheme, mermaidThemeSetting)`으로 파라미터 추가, `renderMermaid`/`RenderOptions`/`main.ts`의 `loadFile()`까지 값을 그대로 흘려보냄.
  - `mermaidThemeOf`/`isLightTheme` 둘 다 순수 함수라 Vitest로 각각 6개/해당 분기 테스트(auto 3분기 + 명시적 light/dark 강제 2개 + 미인식 설정값이 auto와 동일하게 처리되는지 1개).
- **버그 수정(사용자 리포트, M7 이후): mermaid/KaTeX/image 경고 상자 디자인이 서로 다름.** `.lm-render-warning`(mermaid)은 `padding: 0.5rem 0.75rem`이 있었는데 `.lm-render-warning-inline`(KaTeX inline/block, 깨진 이미지)은 `padding: 0 0.15em`으로 사실상 여백이 없었음 — 위 198번째 줄에 "동일한 경고 스타일"이라 적었지만 실제로는 처음부터 값이 달랐음. 수정: `padding`/`border`/`border-radius`/`background`/`color`/`font-size`를 `.lm-render-warning, .lm-render-warning-inline` 공유 셀렉터로 합침, `margin`만 block 전용(`.lm-render-warning`)으로 분리 유지. 엘리먼트 자체(어디는 `<p>`, 어디는 `<span>`)는 인라인 중첩 안전성 때문이라 그대로 둠 — 디자인과는 무관. 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.

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

**M3에서 미룬 것**: 툴바 Zoom 버튼 배선(M3 절 참고). Config System은 이번에 붙었지만 **쓰기(config.json 저장)는 여전히 없다** — `CLAUDE.md` "No graphical settings editor" 규칙대로 IPC/HTTP에 config를 쓰는 커맨드 자체가 없고(`read`/`reload`/`reset`만 존재), 그래서 이번에도 Zoom 버튼 배선은 하지 않고 그대로 미룸(M3 절의 "여기서 같이 처리한다"는 예상이 빗나감 — 정정).

**구현 후 확정된 사항**:
- **의존성 승인**: `axum`은 대체 불가(경량 HTTP+SSE 서버 자체 구현이 더 위험/복잡)로 그대로 승인. `dirs`는 사용자에게 대안(OS별 경로 직접 분기, ~30줄)과 함께 물어봐서 **`dirs` 사용으로 확정**(Open Questions #2 해결) — `dirs::config_dir()`이 `CONFIG_SPEC.md`의 세 경로(Windows `%APPDATA%`, macOS `~/Library/Application Support`, Linux `~/.config`)와 정확히 일치해서 그대로 썼다.
- **워크스페이스**: 루트 `Cargo.toml`은 지금은 `members = ["backend"]`만 (src-tauri는 M6에서 추가). `backend/Cargo.toml`은 `dev-server` feature가 꺼져 있으면 `axum`/`tokio`/`futures-core`를 전혀 컴파일하지 않는다(`optional = true` + feature gate) — `cargo build -p backend`(기본)로 실제 확인, 라이브러리 자체는 `notify`/`serde`/`serde_json`/`dirs`만 링크된다.
- **watcher.rs**: 별도 디바운서 크레이트(`notify-debouncer-*`) 없이 `std::thread` + `mpsc::channel`로 직접 구현. 이벤트 하나가 오면 100ms 동안 추가 이벤트가 없을 때까지 계속 기다렸다가(`recv_timeout` 루프) 한 번만 콜백을 부른다. `event_affects()`가 감시 중인 정확한 경로가 `event.paths`에 있는지만 확인 — 부모 디렉토리를 통째로 감시하지만 필터링은 정확한 경로 일치로 좁힌다. 통합 테스트(`fires_once_for_a_burst_of_writes_to_the_watched_file`)로 "빠른 연속 쓰기 3번 → 콜백 1번"을 확인, 3회 반복 실행으로 타이밍 flakiness 없음을 확인.
- **버그 수정(사용자 리포트): 파일을 열기만 해도(수정 없이) live reload가 계속 발동**. `event_affects()`가 처음엔 경로만 확인하고 `event.kind`는 전혀 안 봤다 — `notify`의 `EventKind::Access`(파일/핸들을 열거나 읽거나 닫음)도 경로만 일치하면 그대로 콜백을 불렀다. 에디터가 파일을 **열기만** 해도(내용 변경 없이) OS가 access 이벤트를 발생시키고, 파일이 열려 있는 동안 계속 발생할 수도 있어서 "계속 깜빡이는" 증상으로 나타났다. 수정: `event_affects()`가 `event.kind.is_create() || event.kind.is_modify()`도 같이 확인 — access 이벤트는 무시. 합성 `Event` 값으로 단위 테스트(`ignores_pure_access_events_but_reacts_to_modify_and_create`) 추가, 실제로 `cat`/`vim -c :q`(읽기만, 쓰기 없음)로 열었을 때 SSE 이벤트가 전혀 안 오고 실제 수정(`echo >>`) 시에만 오는 것을 재현해서 확인.
- **config.rs**: `Config`에 `#[serde(rename_all = "camelCase", default)]` — 구조체 전체에 `default`를 붙이면 JSON에 없는 필드는 `Config::default()`에서 채워진다(부분 JSON 허용을 필드별 어노테이션 없이 한 줄로 해결). `reset_config()`은 기존 `config.json`을 `config.json.bak`로 복사(덮어쓰기, 히스토리 아님)한 뒤 기본값을 씀 — 실제로 파일 써서 백업/복원 확인.
- **devserver.rs**: `tower-http` 없이 `middleware::from_fn`으로 CORS 헤더를 직접 얹었다(`Access-Control-Allow-Origin: http://localhost:5173` 고정) — 프론트에서 보내는 요청이 전부 커스텀 헤더/바디가 없는 "simple request"라 preflight(OPTIONS) 처리가 필요 없어서 이 정도로 충분하다.
  - **`/api/events`는 `?path=` 쿼리 파라미터를 받는다** — `docs/IPC_SPEC.md`의 표엔 이 부분이 명시돼 있지 않아서(연결 종료=unwatch만 명시) 구현하면서 채운 세부사항.
  - **연결 종료 = unwatch를 코드로 어떻게 보장했는지**: SSE 응답에 넘기는 `Stream`을 직접 구현한 `WatchStream` 구조체가 `mpsc::Receiver`와 `FileWatcher`를 **같이** 들고 있다. axum은 클라이언트가 연결을 끊으면 이 스트림을 그냥 drop하는데, 그 순간 `WatchStream`도 통째로 drop되면서 `FileWatcher`(=`notify` watcher)도 같이 drop되어 감시가 실제로 멈춘다 — 별도 "unwatch" 로직이 필요 없고 Rust의 ownership/Drop이 그대로 처리한다. `curl`로 SSE 연결 후 강제 종료해도 서버가 죽지 않고(devserver.log에 panic 없음) 이후 `/api/health`가 계속 정상 응답하는 것으로 확인.
- **`platform/dev.ts`**: `IPC_SPEC.md`의 Dev Server 표에 `open_file` 행이 없다는 걸 근거로 `openFile()`은 미지원(reject)으로 처리 — 대신 실제 파일은 `readFile(path)`(→ `GET /api/file?path=`)로 열고, 그 경로는 **main.ts가 `?file=` URL 쿼리 파라미터로 받는다**(브라우저에는 네이티브 열기 다이얼로그가 없으므로). `openConfigFolder`/`openConfigFile`도 표의 "미지원(capabilities.configFile=false)"대로 reject.
- **`createBackend()`가 비동기로 바뀜**: 계획대로 헬스체크(`GET /api/health`, 300ms 타임아웃)로 Dev 모드를 판별해야 하는데 이건 본질적으로 비동기라, `platform/backend.ts`의 팩토리를 `Promise<BackendApi>`로 바꾸고 `main.ts` 최상단에서 top-level `await`로 받는다(`tsconfig`가 `target: ES2022`라 모듈 최상위 await가 바로 동작). Tauri 분기(`window.__TAURI_INTERNALS__`)는 M6에서 `platform/tauri.ts`가 생기면 추가 — 지금은 Dev/Web 둘만 분기.
- **Live reload 스크롤 앵커**: `lm-viewer.ts`에 `getActiveId()`/`scrollToHeading(id)`를 공개 메서드로 추가. `main.ts`의 `reloadFile()`이 재렌더 전에 `getActiveId()`로 현재 활성 heading을 저장했다가, 재렌더 후 `scrollToHeading()`으로 같은 heading으로 되돌린다.
- **버그 수정(사용자 리포트, M6 Reload Config 배선 이후): `mermaidTheme`(및 사실상 `mermaid`/`katex`/`syntaxHighlight`/`theme`이 Shiki 코드 색에 주는 영향)을 config.json에서 바꾼 뒤 Reload Config를 눌러도 반영이 안 되고 앱을 다시 시작해야만 반영됨.** `main.ts`의 `lm-reload-config`/`lm-reset-config` 핸들러는 `currentConfig` 갱신 + `applyTheme(config)` 호출까지만 하는데, `applyTheme`은 CSS 변수/`.lm-print-light` 클래스/`customCss`만 갱신하는 함수라 — 이런 것들(색상/폰트/zoom/printUseLightTheme)은 실시간으로 반영되지만, mermaid/Shiki처럼 **렌더링 시점에 결과를 DOM/SVG에 직접 구워 넣는(bake)** 값은 `enhance()`가 다시 호출(=문서를 다시 렌더)돼야만 바뀐다. `enhance()`는 `loadFile()`이 호출될 때만 실행되는데 Reload/Reset Config는 `loadFile()`을 전혀 안 부르니, 이미 열려 있는 문서는 그대로 남아있었다 — 앱을 재시작(다시 파일을 열게 됨)해야만 우연히 반영되는 것처럼 보였을 뿐. 이건 한계가 아니라 누락된 배선이라고 판단해 수정: `main.ts`에 현재 열려 있는 문서의 원본(raw) 내용을 저장해두는 `currentDoc`을 추가(`loadFile()`이 호출될 때마다 갱신)하고, 문서가 열려 있으면 그걸로 `reloadFile()`(live reload가 이미 쓰던, 읽던 위치를 보존하며 재렌더하는 함수)을 그대로 재사용하는 `rerenderCurrentDocument()`를 신설 — Reload/Reset Config 핸들러 양쪽 다 `applyTheme()` 다음에 이걸 호출. 문서가 안 열려 있으면 `currentDoc`이 `null`이라 아무 일도 안 함.
- **검증**: `cargo fmt --check`/`cargo clippy --all-features` 무경고, `cargo test -p backend` 6개 전부 통과. devserver를 실제로 띄워서 모든 엔드포인트를 `curl`로 직접 확인(health/file 200·404/config get·reload·reset·백업/SSE 디바운스 단일 발화). 헤드리스 Chrome으로 실제 브라우저에서 `createBackend()`가 Dev 모드를 정확히 감지하는 것(`capabilities: {watch:true, configFile:false}`)까지는 콘솔 로그로 확인했지만, `?file=` → 렌더까지 이어지는 전체 파이프라인의 최종 DOM 결과는 헤드리스 `--dump-dom`이 `load` 이벤트 시점에 캡처돼서 그 이후에 resolve되는 fetch를 못 잡는 도구 한계로 캡처하지 못했다 — 대신 그 경로가 호출하는 정확한 HTTP 엔드포인트(`GET /api/file?path=`, CORS 헤더 포함)를 `curl`로 직접 검증하고 코드 리뷰로 보완.

---

### M6 — Tauri 통합

패키징/배포(AppImage 빌드, 성능 실측)는 M8로 분리했다 — 이 M6은 오직 IPC/권한/파일 연결까지의 통합만 다룬다.

- `src-tauri`: IPC 9개 커맨드를 `backend` 함수로 위임하는 바인딩만. 로직 금지
- `fs`/`dialog`/`shell`(opener) 권한을 필요한 범위로만 허용
- 파일 연결(`.md`, `.markdown`) 및 CLI 인자로 파일 열기

**선행 확인**: 개발 환경에 `pkg-config`가 없으면 Tauri 시스템 의존성(webkit2gtk-4.1, libsoup 등)이 미설치 상태일 수 있다. M6 착수 전 설치 필요.

**검증**: `npm run tauri dev`로 전체 플로우(열기 → 편집기 저장 → 갱신 → 인쇄 → Config 폴더 열기) 확인.

**구현 후 확정된 사항**:
- **시스템 패키지**: Ubuntu 24.04에서 실제로 설치 확인. `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config` — `libwebkit2gtk-4.1-dev` 하나가 `libgtk-3-dev`/`libsoup-3.0-dev`/`libjavascriptcoregtk-4.1-dev`를 의존성으로 끌고 오는 것까지 `apt-cache depends`로 직접 확인함. AppImage 패키징용 `patchelf`/`libfuse2t64`(Ubuntu 24.04는 64비트 time_t 전환으로 `libfuse2`가 아니라 `libfuse2t64`)는 사용자가 패키징을 별도로 진행하기로 해서 이번엔 설치/사용하지 않음 — `tauri build`를 나중에 그냥 돌리면 `bundle.targets` 기본값이 "all"이라 AppImage도 같이 시도하다 실패하니, 그때는 `--bundles deb` 등으로 좁히거나 이 패키지들을 먼저 설치해야 함.
- **루트 `package.json` 신설**: `@tauri-apps/cli`만 devDependency로 두고 `"tauri": "tauri"` 스크립트 하나만 가짐. `frontend/package.json`은 건드리지 않음(`CLAUDE.md` "Browser Development First" 유지 — frontend는 Tauri CLI를 몰라도 됨). `tauri.conf.json`의 `beforeDevCommand`/`beforeBuildCommand`가 `npm --prefix frontend run dev|build`로 frontend를 원격 호출.
- **`src-tauri`는 `npx tauri init --ci`로 스캐폴딩**: 아이콘 세트까지 자동 생성됨(직접 만들 필요 없었음). `identifier`를 기본값 `com.tauri.dev`에서 `dev.lightmark.viewer`로, window 크기를 800x600에서 1000x700으로만 수동 수정.
  - **개선(사용자 요청, M7 이후): 최소 창 크기 제한.** `tauri.conf.json`의 `windows[0]`에 `minWidth`/`minHeight` 추가 — `600x400`으로 시작했다가 "너무 작다"는 피드백으로 `800x600`, 이후 다시 `640x480`으로 변경. 세 값 다 4:3 비율. Web/Dev 모드는 영향 없음(Tauri 전용 설정이라, 브라우저 창 크기는 OS/브라우저가 관리).
  - **개선(사용자 요청): 기본 창 크기를 4:3 비율로.** "기본 크기도 이상해" — 기존 `1000x700`(4:3이 아니었음)을 `960x720`으로 변경, `minWidth`/`minHeight`(현재 640x480)와 같은 4:3 비율로 통일.
- **9개 커맨드 전부 `backend` 크레이트로 위임, 로직 없음** (계획대로): `read_file`/`read_config`/`reload_config`/`reset_config`는 `backend::*` 1줄 호출. `watch_file`/`unwatch_file`은 `HashMap<String, backend::FileWatcher>`를 경로로 키잉해서 관리(`IPC_SPEC.md`가 `watch_file(path)`/`unwatch_file(path)`로 경로 기반 시그니처를 이미 명시하고 있고, LightMark는 항상 문서 하나만 보므로 별도 id 체계가 필요 없음 — 같은 경로를 다시 `watch_file`하면 이전 `FileWatcher`가 그냥 교체·drop되면서 감시가 멈춤).
- **`open_file`/`open_config_folder`/`open_config_file`만 예외적으로 플러그인 사용**: `tauri-plugin-dialog`(네이티브 파일 선택)와 `tauri-plugin-opener`(폴더/파일을 OS 기본 앱으로 열기) — `PLAN.md`가 이미 "fs/dialog/shell(opener) 권한"이라고 명시해둔 부분이라 새로 승인받을 필요 없이 그대로 사용. `capabilities/default.json`에 `dialog:allow-open`/`opener:allow-open-path` 추가(우리 커맨드는 프론트에 플러그인 커맨드를 직접 노출하지 않고 Rust 코드에서 플러그인 API를 호출하는 방식이라 엄밀히는 필수는 아니지만, 의도한 권한 범위를 문서화하는 의미로 추가).
- **`get_initial_path`: `IPC_SPEC.md`의 9개 커맨드 밖의 추가 항목.** Dev 모드가 `?file=` 쿼리 파라미터로 처음 열 파일을 받는 것과 같은 역할을 Tauri에서는 이 커맨드가 한다 — CLI 인자/파일 연결로 실행된 경로를 앱 시작 시 한 번 pull(프론트가 직접 호출)하는 방식으로, push 이벤트로 하지 않은 이유는 페이지 로드 타이밍과의 레이스를 원천적으로 피하기 위함. 두 번째 실행(다른 .md 파일을 다시 열었을 때)은 `tauri-plugin-single-instance`가 같은 창으로 라우팅하면서 `open-path` 이벤트로 push — 이건 이미 실행 중이라 레이스가 없음.
- **CLI 인자 파싱은 순수 함수(`src-tauri/src/cli.rs`)로 분리**: `backend/src/watcher.rs`의 `event_affects`와 같은 패턴 — Tauri 앱을 띄우지 않고도 단위 테스트 가능(`extract_path_arg`, 4개 테스트). 상대 경로는 `cwd` 기준으로 resolve — 특히 `tauri-plugin-single-instance`의 콜백이 넘겨주는 `cwd`(두 번째 실행이 일어난 디렉토리)가 이 프로세스 자신의 cwd와 다를 수 있어서 반드시 필요.
- **macOS `RunEvent::Opened`(dock 아이콘에 드롭/파일 연결)는 구현했지만 미검증**: 이 세션은 Linux 환경이라 실제 macOS에서 컴파일·동작 확인을 못 했다(Rust 코드 자체는 `#[cfg(target_os = "macos")]`로 감싸 Linux/Windows 빌드에는 전혀 포함되지 않음). macOS에서 릴리스하기 전 반드시 실기 확인 필요.
- **툴바 버튼 배선**: `capabilities.configFile`이 `true`인 첫 번째 백엔드가 Tauri라서, 이전까지 `disabled`로만 렌더되던 Config Folder 버튼이 이번에 처음 실제로 노출됨 — 동시에 `CLAUDE.md`의 "Application only provides: Open Config Folder / Open Config File / Reload Config / Reset Config" 4개를 전부 버튼으로 배선(그동안 UI 진입점이 하나도 없었음). Print 버튼도 같이 배선(`window.print()`) — M6 검증 문구 자체가 "인쇄" 단계를 포함하고 있어서 버튼이 있어야 검증이 말이 됨. TOC Toggle/Zoom/About은 M6 범위 밖이라 그대로 `disabled` 유지.
- **개선(사용자 요청): 문서를 열기 전엔 Print 버튼 비활성화.** `lm-toolbar`에 `hasDocument` 상태 추가(`setHasDocument(true)`를 `main.ts`의 `loadFile()`에서 호출, 문서를 닫는 기능이 없어서 false로 되돌아갈 일은 없음) — 렌더된 내용이 없을 때 인쇄해봤자 의미가 없으므로.
- **검증**: `cargo build/test/fmt/clippy -p app`(4개 CLI 파싱 테스트 포함) 전부 통과. `npm run tauri dev`를 실제로 백그라운드로 띄워서 25초 이상 크래시 없이 떠 있는 것 확인(이 세션은 GUI가 있는 실제 X/Wayland 데스크톱 환경이라 프로세스가 실제로 살아 있음은 확인했지만, xdotool/wmctrl/스크린샷 도구가 없어서 창 내용이 실제로 렌더링되는지까지는 시각적으로 확인 못 함 — 사용자가 직접 열어서 최종 확인 필요). `npm run tauri build`(전체 번들링/AppImage)는 M8에서 다룬다 — patchelf/libfuse2t64 미설치라 이번엔 실행하지 않음.
- **버그 수정(사용자 리포트): Open 버튼을 누르면 앱이 통째로 멈춤.** `open_file`이 일반(non-async) `fn`이었던 게 원인 — Tauri는 커맨드를 `async fn`으로 선언하지 않으면 **IPC를 처리하는 그 스레드에서 그대로, 별도 스레드로 옮기지 않고** 실행한다(`tauri-macros`의 `ExecutionContext` 기본값이 "Blocking" — 이름과 반대로 오히려 스레드를 안 옮긴다는 뜻이라 헷갈리기 쉬움. `async fn`으로 선언해야만 `respond_async_serialized`가 `async_runtime::spawn`으로 실제로 다른 스레드에 올린다). Linux에서 이 스레드는 GTK 메인 루프를 도는 스레드라, `blocking_pick_file()`이 다이얼로그 응답을 기다리는 동안 그 다이얼로그를 실제로 그리고 입력을 받아야 할 메인 루프 자체가 멈춰서 데드락이 났다. 수정: `open_file`을 `async fn`으로 변경(본문은 그대로, `.await`는 필요 없음 — 선언만 바꿔도 Tauri가 백그라운드 워커 스레드로 옮겨준다). `open_config_folder`/`open_config_file`은 같은 위험이 있어 보였지만, `tauri-plugin-opener`가 내부적으로 `open::that_detached`(프로세스를 완전히 떼어내 대기하지 않음)를 쓰는 걸 소스에서 직접 확인해서 그대로 둠.
- **버그 수정(사용자 리포트, 2단계): 드래그&드롭으로 파일 열기가 Tauri에서만 동작 안 함.** `lm-viewer.ts`의 드롭 처리는 브라우저 표준 `dataTransfer.files` API 그대로라 Web/Dev에선 문제없음.
  - **1차 시도(틀림, 되돌림)**: `@tauri-apps/cli`의 config 스키마가 `dragDropEnabled`에 "Disabling it is required to use HTML5 drag and drop on the frontend"라고 적어둔 걸 보고 `tauri.conf.json`에 `"dragDropEnabled": false`를 추가했었다. 그런데 스키마 설명을 다시 보면 그 문구는 **"on Windows"로 범위가 좁혀져 있다** — Linux(WebKitGTK)에서는 이 옵션을 꺼도 HTML5 DnD가 살아나는 게 아니라, Tauri의 가로채기가 없어지면서 **WebKitGTK 자체의 기본 동작**(드롭된 파일로 페이지 전체를 네비게이션 — 렌더링 안 된 raw text가 화면 전체를 덮어씀)이 그 자리를 대신 차지해버렸다. 그래서 `lm-toc` 등 drop 리스너가 없는 영역에 드롭하면 앱 전체가 raw text로 바뀌었고(`preventDefault`가 없어서), `lm-viewer`에 드롭하면 `preventDefault`가 그 네비게이션은 막았지만 `dataTransfer.files`엔 애초에 읽을 수 있는 `File`이 안 실려서(임베디드 WebKitGTK가 외부 OS 드롭에 대해 브라우저 수준의 File 구체화를 안 해줌) 아무 일도 안 일어났다.
  - **2차 시도(확정)**: `dragDropEnabled`는 기본값(`true`)으로 되돌리고, 대신 Tauri 고유의 `getCurrentWebview().onDragDropEvent()`(`@tauri-apps/api/webview`)를 사용 — 이건 OS 드롭을 Rust 쪽에서 읽어 **실제 파일 경로**(문자열)를 준다(브라우저 File 객체가 아님). `platform/tauri.ts`의 `onOpenPath(cb)` 안에 이 리스너를 하나 더 추가해서 `type: 'drop'` 이벤트가 오면 `cb(paths[0])`를 호출하도록 함 — CLI 인자/파일 연결로 열 때 이미 쓰던 것과 정확히 같은 경로(`main.ts`의 `backend.onOpenPath?.((path) => openPath(path))`)를 재사용하는 것이라 `lm-viewer.ts`/`main.ts`는 전혀 안 건드림. `dragDropEnabled`가 다시 `true`라 OS 드롭은 어느 영역에 놓든 DOM에 도달하기 전에 Tauri가 가로채므로, `lm-viewer.ts`의 기존 DOM 기반 드롭 처리와 겹치거나 경쟁할 일이 없다(Tauri에서는 그냥 안 쓰이게 되는 코드 경로가 될 뿐 — Web/Dev에서는 그대로 유일한 경로).
- **개선(사용자 요청): Open 다이얼로그가 마지막으로 연 디렉터리를 기억.** Tauri에서만 의미 있는 기능(Web의 `<input type=file>`은 브라우저 보안상 시작 디렉터리를 지정할 수 없고, Dev는 다이얼로그 자체가 없음) — `src-tauri/src/lib.rs`의 `open_file`에서만 처리. `tauri-plugin-dialog`의 `FileDialogBuilder::set_directory()`로 시작 위치를 지정.
  - **`config.json`이 아닌 별도 `state.json`에 저장**: `CLAUDE.md`의 "No graphical settings editor" 원칙은 문서화된, 사용자가 직접 편집하는 `config.json`(`CONFIG_SPEC.md` 스키마)에 관한 것이지, 앱이 스스로 기억하는 이런 내부 편의 상태까지 막는 취지는 아니라고 판단 — 두 파일을 분리해서 `config.json`은 계속 "사람이 손으로 편집하는 파일"로만 유지. `backend/src/state.rs`(신설): `AppState { last_opened_dir: Option<PathBuf> }`를 `backend::config_dir()`와 같은 디렉터리의 `state.json`에 저장. `config.rs`의 `load_config()`와 동일하게 읽기 실패 시 그냥 기본값(빈 상태)으로 넘어간다 — 이 파일이 없거나 깨져도 앱이 죽을 이유가 없음.
  - **디렉터리가 사라졌으면 홈으로**: 순수 함수 `resolve_initial_dir(remembered, exists_fn, home)`로 분리(`watcher.rs`의 `event_affects`와 같은 패턴 — Tauri 없이 단위 테스트 가능)해서 "기억된 디렉터리가 있고 지금도 존재하면 그걸, 아니면(기억이 없거나 삭제됨) 홈 디렉터리"를 결정. 홈 디렉터리는 이미 승인된 `dirs` 크레이트의 `dirs::home_dir()` 재사용(새 의존성 없음).
  - 파일을 성공적으로 선택하면 그 부모 디렉터리를 `backend::save_last_opened_dir()`로 최선 노력 저장(쓰기 실패해도 파일 열기 자체는 실패시키지 않음 — 다음번 시작 위치를 기억하는 건 편의 기능이지 핵심 기능이 아님).

---

### M7 — 남은 툴바 버튼 (TOC Toggle / Zoom / About)

M1부터 `disabled`로만 자리를 잡아두고 M3~M6에서 계속 미뤄온 세 버튼. 더 이상 구현을 막는 장애물이 없어 별도 마일스톤으로 분리해 처리한다.

- **TOC Toggle (완료)**: 사이드바 숨김/표시. `CONFIG_SPEC.md`의 `tocVisible`을 시작 상태로 쓰되, 토글은 **세션 동안만** 유지(config.json에 다시 쓰지 않음 — `CLAUDE.md`의 "No graphical settings editor" 그대로 적용). 상태는 `main.ts`가 소유(`tocVisible` 변수 + `updateTocDisplay()`), 클릭 시 `.lm-content`에 `lm-toc-hidden` 클래스를 토글(`layout.css`: 그리드 컬럼을 `1fr`로, `lm-toc`를 `display: none`으로) + `lm-toolbar`의 버튼에 `aria-pressed` 반영. 다른 컴포넌트들과 같은 패턴(컴포넌트는 상태를 안 갖고 `setXxx()`로 받아서 렌더만, 실제 상태는 `main.ts`).
  - **개선(사용자 요청): 문서를 열기 전엔 버튼 비활성화 + TOC 영역 자체를 숨김.** `hasDocument` 관용구를 Print 버튼(M6)에서 그대로 재사용 — `lm-toolbar`가 `hasDocument`로 TOC Toggle 버튼도 같이 `disabled` 처리. 표시 여부는 `tocVisible` 하나만으로 계산하지 않고 `!hasDocument || !tocVisible`로 계산(`updateTocDisplay()`) — 문서가 없으면 `tocVisible` 값과 무관하게 항상 숨김. 문서가 하나라도 열리면 `hasDocument`는 계속 `true`로 남으므로(문서를 다시 닫는 기능이 없음) 그 뒤로는 순수하게 `tocVisible`만으로 결정됨.
  - **개선(사용자 요청): 문서를 열기 전 뷰어의 안내 문구("Drop a Markdown file here, or use Open.")를 화면 정가운데로, 글자도 더 크게.** `.lm-empty`를 `position: absolute` + `top/left: 50%` + `translate(-50%, -50%)`로 전환 — 위치 기준은 `lm-viewer` 자신이 아니라 그 부모 `.lm-viewer-pane`(`position: relative`가 이미 걸려 있음)이라, `lm-viewer`의 `padding: 1rem`/스크롤과 무관하게 뷰어 영역 전체 기준으로 정확히 중앙에 온다. `font-size: 1.25rem` 추가.
  - **개선(사용자 요청): `tocVisible` 기본값을 `true`→`false`로.** "파일을 열어도 TOC는 기본으로 안 보이고, 토글 버튼을 눌러야만 보이게" — `CONFIG_SPEC.md`가 이미 `tocVisible`을 "시작 상태"로 규정해뒀으므로, 동작 자체를 config와 분리하지 않고 기본값만 뒤집는 것으로 충분(config.json에서 `true`로 바꾸면 여전히 시작부터 보이게 할 수 있음 — 필드의 의미는 그대로 유지). `frontend/src/types/config.ts`(`DEFAULT_CONFIG`)/`backend/src/config.rs`(`Config::default()`)/`docs/CONFIG_SPEC.md` 스키마 예시 세 곳 동시 수정(항상 함께 맞춰야 하는 "세 군데" 규칙 — `config.rs` 파일 헤더 주석 참고).
- **Zoom (완료, macOS 전환 세션에서 구현)**: 계획대로 `--lm-zoom` CSS 변수를 버튼으로 증가/감소, config.json에 쓰지 않는 세션 전용 상태(TOC Toggle과 동일 이유). `lm-toolbar.ts`가 `ZOOM_MIN`(50)/`ZOOM_MAX`(200)/`ZOOM_STEP`(10)/`ZOOM_RESET`(100) 상수를 export해서 `main.ts`가 같은 숫자로 클램프 — 단일 소스. 버튼은 `-`/`0`/`+`가 아니라 `−`(U+2212 MINUS SIGN)/`100%`/`+` — 하이픈/숫자 0이 폭 대비 시각적 무게가 달라 보인다는 사용자 리포트로 교체(디자인 프리뷰 3개 제시 후 선택받음). 중앙 버튼의 `100%` 라벨은 **항상 고정값**(현재 배율이 아님) — 실제 배율은 이미 상태바에 표시되므로, 이 라벨은 "누르면 100%로 리셋된다"는 의미만 나타내도록 사용자 요청으로 확정. 상태바의 zoom 표시(`lm-statusbar`, 하드코딩이던 "100%")는 `setZoom()`으로 실제 값 반영. 값 변경은 `applyTheme({ ...currentConfig, zoom })`로 CSS 변수만 재적용(문서 재렌더 없음 — Apply 버튼의 config 전체 재적용보다 가벼움). 상세: `HANDOFF.md`의 "M7 구현 상세 → Zoom" 참고.
- **버그 수정(사용자 리포트, 2단계): zoom을 조절해도 task-list 체크박스 크기는 그대로.**
  - **1차 시도 — 불충분**: `layout.css`에 `.lm-markdown input[type='checkbox'] { width: 1em; height: 1em; }`만 추가. 사용자가 "사이즈가 바뀌지 않아, 그대로야"로 재리포트.
  - **원인 재확인**: 브라우저 폼 컨트롤(`input`/`button`/`select`/`textarea`)은 기본적으로 페이지의 `font-size`를 상속하지 않고 UA 스타일시트가 주는 자체 고정 control font-size를 씀 — 그래서 `1em`이 `.lm-markdown`의 줌 반영된 font-size가 아니라 그 고정값 기준으로 계산되어 여전히 줌과 무관했음.
  - **2차 시도 — 확정**: 같은 규칙에 `font-size: inherit`을 먼저 추가해 `.lm-markdown`의 (이미 줌 반영된) font-size를 끌어온 뒤, 그 값 기준으로 `1em` width/height가 스케일되도록 수정. 사용자가 실제 앱에서 재확인("체크박스 크기 확인했어. 잘 돼.").
- **재설계(사용자 요청): 줌 방식을 font-size 확대에서 CSS `zoom`(브라우저 실제 화면 확대와 동일한 속성) 기반으로 전환, `max-width`도 고정값에서 창 폭 연동으로.** 위 체크박스 버그를 고친 직후 사용자가 방향 자체를 재검토 요청 — "글자 크기나 각 컴포넌트의 크기를 조절하는 것보다는 브라우저의 zoom 기능처럼 그냥 화면 확대/축소로 하는 게 좋겠어. markdown 영역의 max-width도 창크기와 연동하고." 이전 방식(`font-size: calc(1rem * var(--lm-zoom))`)은 텍스트만 커지고 나머지 요소(체크박스, 이미지, 표 등)는 컴포넌트별로 일일이 스케일을 맞춰줘야 하는 구조였음(체크박스가 바로 그 사례) — 근본적으로 다른 요소도 같은 문제를 겪을 수 있음.
  - **`layout.css`**: `.lm-markdown`의 `font-size: calc(...)`를 `zoom: var(--lm-zoom)`으로 교체 — 브라우저 자체 페이지 줌과 동일한 속성이라 텍스트/이미지/표 테두리/체크박스/여백 등 하위 트리 전체가 한 번에 비례 확대/축소됨. 방금 추가했던 `.lm-markdown input[type='checkbox']`의 `font-size: inherit`/`width`/`height` 오버라이드는 이제 불필요해져 제거(체크박스도 다른 요소와 똑같이 `zoom`을 통해 자동으로 스케일됨).
  - **`max-width: 860px`(고정값)를 `max-width: min(860px, 90vw)`로 교체** — 창 폭에 비례해 좁아지지만(사용자 요청 "창크기와 연동"), 아주 넓은 창에서는 860px을 넘지 않아 한 줄이 지나치게 길어지는 걸 막음(원래 가독성 컬럼 폭 취지 유지). TOC가 보이는 상태에서도 `max-width`는 실제 컨테이너 폭을 넘어설 수 없으므로(블록의 auto 폭은 컨테이너보다 커질 수 없음) 별도 분기 없이 안전.
  - **`--lm-zoom`(config.zoom/100 비율) 자체는 안 바뀜** — `theme.ts`의 `computeCssVars`/`theme.test.ts` 그대로, CSS 소비 방식만 바뀜.
  - 검증: `npm run lint && npm run typecheck && npm run build && npm run test`(30개) 전부 통과.
- **재조정(사용자 요청): 위 `min(860px, 90vw)`는 "창 폭 연동"의 의도가 아니었음 — 뷰어는 컬럼 폭 제한 없이 표시 가능한 최대로, 대신 폭 제한은 사용자가 켤 수 있는 설정으로.** "viewer 영역의 크기를 창 크기에 연동하라는 건 적용되지 않았네. word-wrap 하지 말고 그냥 표시할 수 있는 최대로 하라는 의미였어. 단, 사용자 설정을 추가해서 width를 제한할 수 있도록 해주고, 이 설정은 상태바 파일명 오른쪽에 추가해줘." 즉 기본은 뷰어 폭 전체 사용(word-wrap은 실제 창 가장자리에서만), 좁은 가독성 컬럼을 원하는 사용자를 위한 켜고 끄는 설정을 추가하는 방향.
  - **Config 필드 신설: `limitViewerWidth`(boolean, 기본값 `false`)** — `frontend/src/types/config.ts`/`backend/src/config.rs`/`docs/CONFIG_SPEC.md` 세 곳 동시 반영(항상 값 일치 규칙). TOC Toggle/Zoom과 동일하게 세션 시작 상태로만 쓰이고, 토글해도 config.json에는 안 씀.
  - **`layout.css`**: `.lm-markdown`의 `max-width`(고정/vw 혼합값)를 완전히 제거 — 기본은 뷰어 패널의 실제 폭을 그대로 채움. 대신 `.lm-content.lm-width-limited .lm-markdown { max-width: min(860px, 90vw); }`로 옮겨서, 이 클래스가 있을 때만(토글 on) 원래의 창 폭 연동 캡이 적용되도록 함(TOC Toggle이 `.lm-content.lm-toc-hidden`을 쓰는 것과 같은 패턴).
  - **새 인터랙티브 컨트롤을 `lm-statusbar`에 추가** — 지금까지 상태바는 순수 표시 전용이었는데(인터랙션은 전부 `lm-toolbar`), 사용자가 위치를 파일명 오른쪽으로 명시적으로 지정해서 처음으로 상태바에 클릭 가능한 버튼이 생김. `lm-toolbar`의 `dispatchOnClick` 관용구(클릭 시 `blur()` 후 커스텀 이벤트 dispatch, `aria-pressed`로 on/off 표시)를 그대로 재사용 — 라벨은 `Width`(한 단어, 토글 on일 때 accent 배경으로 강조, TOC 버튼과 동일한 시각 언어). `main.ts`가 `widthLimited` 세션 상태를 소유하고 `lm-width-toggle` 이벤트로 토글, `.lm-content`에 클래스 반영 + `statusbar.setWidthLimited()`로 버튼 표시 갱신.
  - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) + 백엔드(`cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`, 13개) 전부 통과.
- **재조정(사용자 요청): 폭 제한을 on/off 스위치가 아니라 값을 직접 입력하는 방식으로, 렌더링된 컨텐츠의 좌/우 여백도 상태에 따라 다르게.** "설정으로 width를 제한하는 건 true/false switch가 아니라 직접 값을 입력할 수 있도록 변경해줘. 그리고 렌더링된 컨텐츠는, width를 제한하지 않았을 때는 좌/우 여백을 좀 더 추가해주고, 제한했을 때는 좌/우 여백을 동일하게 설정해 가운데 위치하게 해줘."
  - **Config 필드를 `limitViewerWidth`(boolean) → `viewerMaxWidth`(number, px, 기본값 `0`)로 교체.** `0`은 "제한 없음"이라는 의미의 sentinel — `frontend/src/types/config.ts`(+`config.test.ts`)/`backend/src/config.rs`/`docs/CONFIG_SPEC.md` 세 곳 동시 반영.
  - **`lm-statusbar`의 버튼을 숫자 입력창으로 교체.** `<input type="number" min="0" step="10" placeholder="Full">`(파일명 오른쪽, 위치는 그대로) — 비워두면(또는 `0`) 제한 없음, 값을 입력하면 그 폭(px)으로 제한. `change`(blur/Enter 커밋, `input`처럼 매 키 입력마다 반응하지 않음)에서 `lm-width-change` 커스텀 이벤트로 값을 올려보냄. `WidthChangeDetail` 타입 export(다른 컴포넌트의 `*Detail` 관용구와 동일).
  - **`layout.css`**: `.lm-markdown`에 기본 `margin: 0 2rem`(좌/우 여백 추가, 요청한 "여백을 좀 더") 추가. `.lm-content.lm-width-limited .lm-markdown`은 `max-width: var(--lm-viewer-max-width)`(main.ts가 이 커스텀 프로퍼티를 `${viewerMaxWidth}px`로 세팅) + `margin-left/right: auto`(좌우 여백이 같아져서 가운데 정렬, 요청한 문구 그대로) — 고정폭이 아니라 사용자가 입력한 값 그대로 사용(더 이상 `min(860px, 90vw)` 계산 없음, 값 자체가 사용자 몫이므로).
  - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) + 백엔드(`cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`, 13개) 전부 통과.
- **재조정(사용자 요청): `lm-statusbar`의 숫자 입력창을 읽기 전용 표시로 되돌림 — 값을 바꾸는 곳은 config.json뿐.** "상태바에 width 표현이 마음에 안 들어. 여기서 변경하지는 않을거야. 그냥 현재 config 파일에 설정된 값이 뭔지 표시만 하면 돼. 상태바에 표시되는 다른 컨텐츠들과의 수직 정렬에 신경써서 변경해줘. 0이 설정된 경우는 Full로 표시하는 거 좋아." `<input type="number">`는 filename/zoom 같은 평범한 텍스트 `<span>`들과 나란히 있을 때 브라우저 기본 폼 컨트롤 테두리/패딩 때문에 높이가 달라 보여 수직 정렬이 어긋났던 것으로 보임 — 평범한 `<span>`으로 바꾸면 그 문제 자체가 구조적으로 사라짐.
  - `lm-statusbar`에서 `<input>`/`change` 리스너/`lm-width-change` 이벤트/`WidthChangeDetail` 타입 전부 제거, `<span class="lm-status-width">`로 교체 — filename/zoom과 동일한 패턴(`setViewerMaxWidth()`가 값만 반영, 값 > 0이면 `${width}px`, 아니면 `Full`).
  - `main.ts`: 더 이상 세션 중 바꿀 방법이 없으므로 별도 `viewerMaxWidth` 변수 없이 `currentConfig.viewerMaxWidth`를 직접 읽도록 단순화. Apply(`lm-reload-config`) 핸들러에도 `updateWidthDisplay()` 호출 추가 — config.json에서 값을 바꾸고 Apply를 누르면 상태바 표시와 실제 레이아웃(`--lm-viewer-max-width`) 둘 다 재시작 없이 갱신됨.
  - `layout.css`: 입력창 전용 스타일(`.lm-status-width`/`.lm-status-width-input`) 삭제 — 평범한 `<span>`이라 filename/zoom처럼 별도 스타일 불필요.
  - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과. 백엔드는 이번 변경에서 안 건드림(기존 `cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`, 13개로 재확인만).
- **개선(사용자 요청): 폭 표시에 라벨 추가.** "상태바에 그냥 값만 표시되니까 무슨 의미인지 잘 모르겠어. \"Width: 값\" 이런 식으로 표시해줘." zoom은 `100%`처럼 단위만으로 의미가 통하지만, 폭은 `700px`나 `Full`만 있으면 무엇의 폭인지 알 수 없다는 지적 — `updateWidth()`가 `Width: ${value}`로 접두어를 붙이도록 수정(`Width: Full` / `Width: 700px`). 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.
- **버그 수정(사용자 리포트): `viewerMaxWidth`에 아주 큰 값을 넣으면 좌/우 여백이 줄어듦.** 가로 스크롤 같은 건 안 생기지만(값이 컨테이너 폭보다 커도 `max-width`가 그 이상으로 밀어내진 못하니까), `.lm-content.lm-width-limited .lm-markdown`의 `margin-left/right: auto`가 문제 — 값이 컨테이너 폭에 도달하거나 넘으면 `max-width`가 사실상 컨테이너 폭 그대로를 차지하게 되고, 그러면 auto margin이 나눠 가질 여유 공간이 없어져서 좌우 여백이 0으로 줄어듦(제한 없음 상태의 기본 `2rem` 여백보다 좁아짐). 수정: `max-width: min(var(--lm-viewer-max-width), calc(100% - 4rem))` — 사용자가 입력한 값이 아무리 커도 "컨테이너 폭 - 4rem"을 넘지 못하게 캡을 하나 더 씌워서, auto margin이 항상 최소 `2rem`씩(제한 없음 상태와 동일)은 나눠 가질 여유가 남도록 함. 덕분에 컨테이너 폭에 아주 가까운(넘지는 않는) 값을 넣었을 때도 여백이 찌그러지지 않고 동일하게 최소 `2rem`이 보장됨.
  - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.
- **개선(사용자 요청): 좌/우 여백을 2rem → 1rem으로 축소.** "지금 설정을 width를 지정 여부와 관계없이 좌우 여백을 각각 2rem씩 확보한거지? 1rem으로 줄여봐줘." 확인된 그대로(제한 없음 상태의 `.lm-markdown` 기본 margin, 제한 상태의 `min(..., calc(100% - Nrem))` 캡 둘 다 `2rem` 기준이었음) — 두 곳 다 `1rem`으로 축소(캡의 `calc(100% - 4rem)`도 `calc(100% - 2rem)`으로 같이 축소, 여백의 2배라는 관계 유지). 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.
- **버그 수정(사용자 리포트): 메뉴바 zoom 리셋 버튼의 `100%`가 config.json의 `zoom`이 아니라 하드코딩된 값이었음.** "zoom 관련 문제가 있어. 설정 파일에 있는 zoom이 이 앱의 기본 zoom 레벨이야. 따라서 메뉴바의 100%도 고정이 아니라 이 값에 따라 적용돼야 해." — 앞서 이 버튼 라벨을 "항상 100%로 고정"하도록 만들었던 결정(위 참고)이 틀렸던 것으로 정정: `100%`는 임의의 고정값이 아니라 `config.zoom`의 기본값(우연히 `100`)이었고, `config.zoom`이 다른 값이면 리셋 버튼도 그 값을 목표로 해야 함.
  - `lm-toolbar.ts`: `ZOOM_RESET`(고정 상수) 대신 새 세션 상태 `defaultZoom`(+`setDefaultZoom()`)을 렌더에 사용 — 중앙 버튼 라벨이 `${this.defaultZoom}%`로 바뀜. `-`/`+`의 경계 판정(`this.zoom` 기준)은 그대로.
  - `main.ts`: `defaultZoom`을 `zoom`과 같은 패턴(세션 상태, `readConfig()` 완료 시 `config.zoom`으로 초기화)으로 신설. `lm-zoom-reset` 핸들러가 하드코딩된 `ZOOM_RESET` 대신 `defaultZoom`으로 리셋(`ZOOM_RESET`은 `lm-toolbar.ts` 내부 초기값 fallback으로만 남고 main.ts의 import에서는 이제 안 씀 - orphan 정리).
  - **부수 발견 및 수정: Apply(Reload Config)가 `--lm-zoom`은 `applyTheme(config)`로 바로 바꾸면서 세션 `zoom`/`defaultZoom` 상태와 그 UI 표시(툴바/상태바)는 갱신 안 하고 있었음.** config.json에서 zoom을 바꾸고 Apply를 누르면 실제 렌더링은 새 zoom으로 바뀌는데 툴바 `-`/`+`/리셋과 상태바 zoom 표시는 그 전 값을 그대로 보여주는 불일치가 있었음(defaultZoom을 config.zoom과 동기화하는 걸 만들면서 같은 값을 읽는 이 경로도 같이 점검하다 발견) - Apply 핸들러에도 `zoom = config.zoom; toolbar.setZoom(zoom); statusbar.setZoom(zoom); defaultZoom = config.zoom; toolbar.setDefaultZoom(defaultZoom);` 추가해서 실제 렌더링과 표시가 항상 같은 값을 가리키도록 함.
  - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.
- **버그 수정(사용자 리포트): 문서를 연 상태에서 zoom을 세션 중 바꾼 뒤 config를 고쳐 Apply를 누르면 zoom이 기본값으로 리셋됨.** "문서를 읽은 상태에서 zoom level을 변경하고, 이후 config 파일을 변경해 apply를 누르면, 기본 zoom level로 reset돼. 이 기능을 제외해줘. 사용자가 변경한 zoom level은 유지되도록." — 바로 위에서 추가한 "Apply 시 `zoom`/`defaultZoom`을 config.zoom과 동기화" 수정이 원인이었음: config에 다른 필드(테마 등)만 바꾸고 Apply를 눌러도 `zoom`을 무조건 `config.zoom`으로 되돌리고 있었던 것 — 세션 중 수동으로 조절한 zoom까지 함께 덮어써버림.
  - 수정: Apply 핸들러에서 `zoom = config.zoom; toolbar.setZoom(zoom); statusbar.setZoom(zoom);` 세 줄을 제거. `applyTheme(config)`도 `applyTheme({ ...config, zoom })`으로 바꿔서 세션 zoom을 그대로 유지한 채(현재 `--lm-zoom`을 안 건드림) 나머지 필드만 적용되도록 함. `defaultZoom`(리셋 버튼이 가리키는 목표값)만 계속 `config.zoom`으로 갱신 — "리셋하면 어디로 가는지"는 최신 config를 따르되, "지금 보이는 배율"은 사용자가 세션 중 조절한 값을 그대로 유지.
  - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.
- **About (완료)**: 앱 이름/버전 보여주는 간단한 표시. 네이티브 다이얼로그가 있는 건 Tauri뿐이라, Web/Dev/Tauri 모두 동일하게 동작하려면 플랫폼 API에 기대지 않는 게 핵심 — 새 컴포넌트 `lm-about`(네이티브 `<dialog>`를 감싸는 얇은 래퍼)을 추가해 `showModal()`로 오픈: 배경 딤 처리/가운데 정렬/Escape로 닫기가 다 공짜로 따라옴. 버전은 IPC로 백엔드에 묻지 않고 `frontend/package.json`을 `tsconfig.json`의 `resolveJsonModule`로 직접 import(`core/appInfo.ts`)해서 프론트엔드 하나의 소스만으로 세 모드 모두 동일한 값을 보여줌(플랫폼 API 의존 없음). Print 버튼과 달리 문서가 없어도 항상 활성화(앱 정보 표시는 문서 유무와 무관).
  - **개선(사용자 요청): 이름과 버전 사이에 한 줄 설명 추가.** `core/appInfo.ts`에 `APP_TAGLINE = 'Fast, lightweight, focused Markdown viewer.'` 추가, `lm-about`에서 이름과 버전 사이에 표시(`--lm-color-muted`로 톤 다운).
  - **개선(사용자 요청): 개발자 표시 추가.** `core/appInfo.ts`에 `APP_AUTHOR = 'Yonghee Yu'` 추가(`APP_NAME`과 같은 방식으로 하드코딩), 버전 아래에 "Developed by {APP_AUTHOR}"로 표시.
  - **개선(사용자 요청): Close 버튼 제거.** "없는 게 좋겠다"는 피드백 — Close 버튼과 그 클릭 리스너 삭제, 닫는 방법은 배경 클릭과 Escape(네이티브 `<dialog>` 기본 동작) 두 가지로 유지.
    - **버그(제거로 인한 부작용): 다이얼로그에 의도치 않은 outline.** 포커스 가능한 자식(Close 버튼)이 없어지자 `showModal()`이 `<dialog>` 자신에 포커스를 줘서 브라우저 기본 outline이 그려짐 — `.lm-about-dialog { outline: none; }`로 제거.
    - **개선(사용자 요청): 다이얼로그 안/밖 어디를 클릭해도 닫히게(Esc는 유지).** 배경 클릭만 닫히던 것을, `event.target` 체크를 없애고 `<dialog>`에서 일어나는 모든 클릭(내용/배경 구분 없이)이 `close()`로 이어지게 변경 — Close 버튼이 없는 지금은 내용 클릭에 다른 목적이 없음. Escape는 네이티브 동작이라 그대로 유지.

- **개선(사용자 요청): 버튼 디자인 전면 개편.** 지금까지 툴바/About 다이얼로그 버튼은 브라우저 기본 스타일 그대로였음 — 사용자가 "너무 별로"라고 리포트. `layout.css`에 `lm-toolbar button, .lm-about-dialog button` 공유 셀렉터로 하나의 flat 버튼 스타일 추가(테두리 없음, `border-radius: 6px`, hover 시 `--lm-color-border` 배경, `focus-visible` 아웃라인, `disabled` 시 `opacity: 0.4`). TOC Toggle의 `aria-pressed="true"` 상태는 accent 배경 + 흰 글자로 별도 강조. `lm-toolbar` 자체도 `display: flex` + `gap`으로 정렬을 정돈. 아이콘/그림자 등은 추가하지 않고 최대한 단순하게(`CLAUDE.md` "Fast. Lightweight. Focused." 정체성에 맞춰 심플함 유지) — 컴포넌트 템플릿(TS)은 전혀 안 건드리고 CSS만으로 처리. (Close 버튼 제거로 `.lm-about-dialog button` 관련 셀렉터는 이후 정리됨 — 위 참고.)
  - **개선(사용자 요청): 클릭 후 포커스가 남지 않도록.** `:focus-visible` CSS만으로는 일부 엔진(WebKitGTK 등)에서 마우스 클릭도 `:focus-visible`로 잡혀 링이 남을 수 있어서 불충분 — `lm-toolbar.dispatchOnClick()`에서 클릭 시 커스텀 이벤트 디스패치 전에 `button.blur()`를 호출해 모든 툴바 버튼에 한 번에 적용. About 다이얼로그는 별도 처리 필요: 네이티브 `<dialog>.close()`가 `showModal()`을 호출한 엘리먼트(About 버튼)로 포커스를 되돌리는 표준 동작이 있어서, `lm-about.close()`에서 `dialogEl.close()` 다음에 `document.activeElement?.blur()`도 호출. Tab으로 이동했을 때의 `:focus-visible` 키보드 접근성은 그대로 유지(활성화 후에만 사라짐).

- **개선(사용자 요청): 버튼 라벨을 한 단어로, Config File 기능은 완전히 삭제.** "화면 폭이 좁을 수 있어서 버튼은 한 단어로 표시하고 싶어" — `TOC Toggle`→`TOC`, `Config Folder`→`Config`, `Reset Config`→`Reset`. `Reload Config`는 그대로 유지(사용자가 아직 결정 안 함 — "Reload"만 쓰면 md 파일 재로딩과 헷갈릴 수 있다는 지적이 있어서 더 생각해보기로 함).
  - **개선(사용자 요청): 툴바 높이 축소.** "버튼 위/아래 padding과 margin이 좀 커서 메뉴바 높이 전체적으로 좀 커" — `lm-toolbar`의 수직 padding `0.5rem`→`0.3rem`, 버튼 자체의 수직 padding `0.4rem`→`0.25rem`(수평 padding은 그대로). 버튼에 `margin: 0`도 명시(브라우저 기본값이 이미 0이라 시각적으로 바뀌는 건 없지만, 의도를 코드에 남겨둠).
  - **개선(사용자 요청): 뷰어 안내 문구에서 ", or use Open" 삭제.** `"Drop a Markdown file here, or use Open."` → `"Drop a Markdown file here."`
  - **개선(사용자 요청, Reset 삭제 이후): `Reload Config` 라벨을 `Apply`로.** "config 관련 다른 버튼들이 없어졌으니, reload는 그냥 적용한다는 의미로 apply로 해도 좋을 것 같아" — Config File/Reset이 사라져서 애초에 헷갈릴 대상이 줄었고, "config.json에 방금 편집한 걸 지금 적용한다"는 효과를 직접 말해주는 이름이라 채택. **라벨만** 바꿈 — `data-action="reload-config"`/`lm-reload-config` 이벤트/`BackendApi.reloadConfig()`/`backend::reload_config()`/IPC 커맨드 이름은 전부 그대로(내부 동작을 정확히 설명하는 이름이라 유지, `Config Folder`→`Config`처럼 라벨과 내부 이름이 이미 갈라져 있던 기존 패턴과 동일).
  - **기능 삭제: Open Config File.** `CLAUDE.md`의 Config Rules가 "Open Config Folder / Open Config File / Reload Config / Reset Config" 4개 제공을 명시하고 있어서, 버튼만 없애면 문서와 코드가 안 맞게 되는 걸 먼저 확인 → 사용자가 "완전히 삭제"로 확정. 버튼(`lm-toolbar`)/IPC 커맨드(`open_config_file`, `src-tauri/src/lib.rs`)/`BackendApi.openConfigFile()`(3개 플랫폼 어댑터 전부)/`docs/IPC_SPEC.md`/`docs/UI_SPEC.md`/`CLAUDE.md`의 "Open Config File" 항목까지 전부 제거. 부수 정리: `backend::config_path()`가 이 커맨드의 유일한 외부 소비자였어서, `backend/src/lib.rs`의 `pub use`에서도 뺌(함수 자체는 `config.rs` 내부에서 `load_config()`가 계속 씀 — 삭제 아님, re-export만 정리).
- **기능 삭제(사용자 요청): Reset Config, 대신 Reload Config가 자기 치유(self-heal).** "config 파일을 삭제하고 reload를 하면 기본 config 파일을 다시 써주는 기능을 추가하고 reset 버튼을 없애는 건 어때?" — Config File 삭제로 인해 "삭제만 하고 다시 편집 가능한 파일을 못 만든다"는 gap이 생겼던 것을, Reset을 없애는 대신 Reload 쪽에 자기 치유를 얹어서 해소.
  - **`backend::reload_config()`(신설)**: 기존 `load_config()`(순수 읽기, 없으면 그냥 메모리 기본값)와 별도로, config.json이 없거나 읽기/파싱에 실패하면 기본값을 **그 자리에 실제로 써준다**(기존 파일이 있었으면 `config.json.bak`으로 먼저 백업 — 옛 `reset_config()`의 백업 습관 재사용). `read_config()`/`GET /api/config`는 여전히 `load_config()`만 호출(부작용 없는 순수 읽기 유지) — 자기 치유는 명시적으로 "Reload"를 눌렀을 때만 일어남.
  - **`load_config()` 내부 리팩터**: 파일 읽기+파싱 성공/실패 판정을 `try_load(path) -> Option<Config>`로 분리해서 `load_config()`/`reload_config()` 둘 다 재사용(중복 제거).
  - **정정(macOS 전환 세션, 사용자 요청)**: 바로 위 "`read_config()`는 여전히 `load_config()`만 호출"은 **더 이상 사실이 아님**. 사용자가 "앱이 실행될 때도 config file이 없으면 자동 생성되어야 한다"고 요청(단, Apply의 기존 동작은 유지) — `read_config()`/`GET /api/config`가 이제 `reload_config()`를 호출하도록 바뀌어서, 앱 시작 시에도 자기 치유가 일어난다. 순수 읽기 전용이던 `load_config()`는 외부 호출자가 없어져 **삭제**됨(`backend/src/lib.rs`의 re-export도 제거). 상세: `HANDOFF.md`의 "macOS 전환 세션 구현 상세" 참고.
  - **제거**: `backend::reset_config()`, `src-tauri`의 `reset_config` 커맨드(+등록), devserver의 `POST /api/config/reset`, 프론트 `BackendApi.resetConfig()`(3개 어댑터), `lm-toolbar`의 Reset 버튼, `main.ts`의 `lm-reset-config` 리스너, `CLAUDE.md` Config Rules의 "Reset Config" 항목까지 전부.
  - **검증**: 백엔드(`cargo fmt --check`/`clippy --workspace --all-features`(+`--features dev-server`)/`test --workspace`) + 프론트(`lint/typecheck/build/test`) 전부 통과. `reload_config()`의 자기 치유 로직 자체는 `load_config()`/구 `reset_config()`와 같은 이유로 단위 테스트 없음(실제 OS config 디렉터리에 의존하는 부수효과 함수라 기존에도 테스트 대상이 아니었음 — `config.rs`의 순수 serde 테스트 2개만 존재).

**검증(TOC Toggle/About)**: `npm run lint && npm run typecheck && npm run build && npm run test` 통과. TOC Toggle: 클릭 시 사이드바가 숨겨지고 뷰어가 전체 폭을 차지, 다시 클릭하면 원래대로. About: 버튼 클릭 시 모달이 뜨고 앱 이름/버전이 보이며, Close 버튼/배경 클릭/Escape 모두로 닫힘. 사용자 실사용 확인은 아직.
**검증(버튼 라벨/Config File·Reset 삭제)**: 프론트(`lint/typecheck/build/test`) + 백엔드(`cargo fmt --check/clippy --workspace --all-features/test --workspace`) 전부 통과.

**검증(전체, 완료)**: TOC Toggle/Zoom/About 세 버튼 모두 구현 완료 및 실사용 확인. Zoom은 프론트 `lint`/`typecheck`/`build`/`test` 통과, 디자인(3버튼 배치, `−`/`100%`/`+` 문자 선택)에 이어 실제 클릭 동작도 사용자가 실기로 확인(그 과정에서 위 task-list 체크박스 버그를 리포트). TOC Toggle/Zoom 상태가 페이지/앱을 새로 열면 초기화되는 것(세션 전용, 저장 안 됨)은 의도된 동작. **이후 zoom 재설계(CSS `zoom` 전환/`defaultZoom`/Apply 세션 보존), 뷰어 폭 제한(`viewerMaxWidth`), mermaid/KaTeX/image 경고 상자 디자인 통일까지 전부 사용자가 실기로 재확인함("1, 2, 3 모두 확인 완료했어") — M7에 더 이상 미확인 항목 없음.**

- **버그 수정(사용자 리포트, 진행 중): 인쇄 시 페이지가 넘어가는 지점에서 컨텐츠가 위/아래로 잘림.**
  - **1차 시도 — 불충분**: `@media print`에 `.lm-markdown pre`(코드블록)만 있던 `break-inside: avoid`를 `img`/`blockquote`/`li`/`tr`/`.lm-mermaid`/`.lm-math-block`까지 확장, `h1`~`h6`에 `break-after: avoid` 추가.
  - **2차 시도 — 틀린 방향으로 판단, 되돌림**: 사용자가 "일반 텍스트나 수식이 잘리는 경우도 있어. 결국 모든 컨텐츠가 잘릴 수 있다는 거 아닐까?"라고 재리포트하자, `.lm-markdown { zoom: var(--lm-zoom); }`(M7의 CSS `zoom`)이 인쇄 시에도 그대로 적용돼 페이지 분할 계산을 흐트러뜨리는 게 근본 원인이라고 판단해 `@media print`에 `.lm-markdown { zoom: 1; }`을 추가했었음. **사용자가 정정**: "화면 zoom level에 따라 인쇄 크기도 달라지는 건 마음에 드는 기능이었어. 이건 원복해." — zoom이 인쇄 크기에 그대로 반영되는 건 의도된, 선호하는 동작이었고 원인이 아니었음. `.lm-markdown { zoom: 1; }`을 삭제해 원복(1차 시도의 요소별 `break-inside`/`break-after` 규칙은 그대로 유지).
  - **3차: 직접 재현/진단(사용자가 스크린샷 대신 ASCII로 설명 — 박스 모서리 도형이 페이지 경계에서 위/아래로 잘림).** 실제 Tauri 앱과 같은 엔진(WebKitGTK 4.1, Ubuntu 24.04 번들 2.52.3)으로 `python3`+PyGObject(`WebKit2`)를 이용해 실제 `WebKitWebView`에 `samples/all-features.md`를 로드하고 `WebKitPrintOperation`으로 PDF 직접 export → `pdftoppm`으로 페이지별 이미지 변환해서 확인. `.lm-math-block`(KaTeX 블록 수식)이 페이지 경계에서 정확히 반으로 잘리는 걸 재현(사용자가 그린 그림과 일치). KaTeX 내부 래퍼(`.katex-display`/`.katex`)에 `break-inside: avoid`를 중복 추가, `.lm-math-block`을 `display: table`로 변경 — 둘 다 효과 없어서 코드에는 반영 안 함. **결정적으로**, 원본 문서에 필러 문단을 끼워 넣어 코드블록/mermaid 다이어그램이 페이지 경계에 걸리도록 강제했더니 **이것들도 똑같이 잘림** — 즉 원래 안 잘렸던 건 `break-inside: avoid`가 작동해서가 아니라 우연히 경계에 안 걸렸을 뿐이었음.
  - **결론 및 결정(종결)**: 이 WebKitGTK 버전은 `break-inside`/`page-break-inside`를 사실상 지키지 않는다 — CSS만으로 고칠 수 없는 엔진 자체의 인쇄 페이지네이션 한계(비-Mac WebKit 포트의 인쇄 지원이 약하다는 알려진 문제 범주). 제대로 고치려면 JS 기반 수동 페이지네이션(자체 구현 또는 Paged.js)이 필요한데, 직접 구현/Paged.js 도입/한계로 받아들이기 세 선택지를 제시한 결과 사용자가 **"알려진 한계로 받아들이고 넘어가기"**를 선택 — 이 항목은 여기서 종결, 추가 코드 변경 없음.
  - 기존 1차 시도의 요소별 `break-inside`/`break-after` 규칙은 코드에 그대로 유지(이 WebKitGTK 버전엔 효과 없지만 다른 엔진/향후 버전에는 유효할 수 있어 제거 안 함).
  - 검증(zoom 원복 후): 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.

---

### M8 — 패키징 및 배포

M6(Tauri 통합)에서 분리. 통합이 끝난 뒤 마지막에 하는 게 맞는 작업들이라 별도 마일스톤으로 둔다.

- **앱 아이콘 (완료)**: 사용자가 `npm run tauri icon ./app-icon.png`(1024x1024 소스, 저장소 루트 `app-icon.png`)로 `src-tauri/icons/` 아래 전체 세트(32x32/128x128/128x128@2x/icon.icns/icon.ico + 스토어/모바일용 나머지)를 재생성 — `tauri.conf.json`의 `bundle.icon`이 `tauri init --ci` 스캐폴딩 때부터 이미 이 정확한 경로들을 참조하고 있어서, 파일만 같은 자리에 다시 생성하면 되고 설정 변경은 필요 없었음.
  - **개선: `bundle.icon` 배열에 `icons/icon.png`(512x512) 추가(맨 앞).** Tauri 소스(`tauri-codegen`) 확인 결과, Linux 기본 창 아이콘은 배열에서 `.png`로 끝나는 첫 항목을 그대로 쓰는데 원래 `icons/32x32.png`가 먼저 있어서 창 자체 아이콘이 아주 작은 해상도로 박혀 있었음.
  - **버그 수정(사용자 리포트): `npm run tauri dev`로 확인했는데 dock에 아이콘이 적용 안 됨.** Tauri 소스(`tauri-2.11.5/src/app.rs`) 확인 결과, GTK application ID(Wayland에서 데스크톱 셸이 `.desktop` 파일과 창을 매칭하는 값)는 `app.enableGTKAppId`(정확히 이 대소문자)가 `true`일 때만 `identifier` 값으로 설정되고 기본값은 `false` — 즉 app_id 자체가 아예 없었던 게 근본 원인(사용자 세션이 Wayland임을 확인). `tauri.conf.json`에 `"enableGTKAppId": true` 추가로 수정, `busctl --user list`로 앱이 `dev.lightmark.viewer` D-Bus 이름을 실제로 세션 버스에 등록하는 것을 확인해 적용 여부 검증. 사용자 승인 하에 로컬 전용(커밋 안 됨) `~/.local/share/applications/dev.lightmark.viewer.desktop`도 추가해 dev 모드 창도 dock이 바로 인식하도록 함 — 실제 배포 시에는 M8 패키징이 `.desktop` 파일을 자동 생성하므로 불필요.
  - **후속 리포트(사용자, 2건): (1) `npm run tauri dev`로는 여전히 dock 아이콘 안 보임, (2) Apps 목록엔 아이콘이 뜨지만 클릭해도 앱이 실행 안 됨.** 원인 둘 다 확인/수정:
    - **(2) 먼저 확인**: `desktop-file-validate`로 확인해보니 원래 `Exec=bash -c 'npm run tauri dev'`가 Desktop Entry 스펙상 잘못된 따옴표 처리("reserved character ''' outside of a quote")라 GLib 런처가 아예 파싱 실패 — 클릭해도 조용히 아무 일도 안 일어난 이유. `Exec=npm run tauri dev`(bash 래핑 제거)로 단순화하고 `Path=/home/tramamte/src/rust/lightmark`(작업 디렉터리)를 추가해 `package.json`/`tauri.conf.json`을 제대로 찾도록 함. `gio launch`(더블클릭 시뮬레이션)로 실제 dev 파이프라인 전체(vite+tauri dev+앱, D-Bus 이름 등록까지)가 정상 기동하는 것 확인.
    - **(1) 근본 원인**: GNOME Shell의 Wayland 앱 아이콘 매칭은 실행 중인 창의 app_id를 `.desktop` **파일명**(확장자 제외)과 직접 비교하는 걸 우선시함(`StartupWMClass`는 X11 시절 창 위주의 보조 수단) — 파일명이 `lightmark-dev.desktop`이라 app_id(`dev.lightmark.viewer`)와 안 맞았음. 파일명을 정확히 `dev.lightmark.viewer.desktop`으로 바꿔서 해결(내용의 `StartupWMClass`는 보조 수단으로 그대로 유지).
    - 검증: `desktop-file-validate` 통과, `gio launch`로 실제 기동 확인, `busctl --user list`로 `dev.lightmark.viewer` D-Bus 이름 등록 재확인. **사용자가 재확인 후에도 dock 아이콘은 여전히 안 보임** — 자동화 도구로는 네이티브 Wayland 창 상태를 더 조회할 수 없어(GNOME Shell Eval은 기본 비활성화) 사용자에게 개발자 도구 활성화 여부를 물었으나, **사용자가 "일단 미뤄둘게. 패키징 이후 다시 보자"로 보류 결정** — M8 패키징 이후 실제 설치된 앱으로 재검토. 지금까지의 변경(`enableGTKAppId`, `bundle.icon` 순서, 로컬 `.desktop` 파일)은 무해하므로 그대로 유지.
  - 검증: `cargo check -p app`/`cargo fmt --check`/`cargo clippy --workspace --all-features`/`cargo test --workspace`(13개) 전부 통과.
- **결정(사용자): 배포 타깃을 deb 하나로 제한.** `tauri.conf.json`의 `bundle.targets`를 `"all"`(AppImage+deb+rpm)에서 `["deb"]`로 변경 — AppImage 전용 요구사항이던 `patchelf`/`libfuse2t64`(Ubuntu 24.04는 `libfuse2`가 아니라 이 이름) 설치가 불필요해짐, `.deb` 자체는 이미 설치돼 있는 `dpkg-deb`만 있으면 됨.
- **deb 빌드 완료 + 실제 설치 검증 + 발견된 문제 3가지 수정 (완료).** 첫 빌드(`LightMark_0.1.0_amd64.deb`, 7.7MB)를 실제로 `sudo apt install`/`sudo apt remove`로 반복 설치·검증하며 진행:
  1. **메타데이터가 전부 `tauri init --ci` 기본값**(`Maintainer: you`, `Description: A Tauri App`) — `src-tauri/Cargo.toml`의 `authors`/`description`/`license`/`repository`/`homepage`를 실제 값(`core/appInfo.ts`의 `APP_TAGLINE`, git config, `git remote`)으로 채움. license는 사용자에게 확인받아 MIT로 확정, 저장소 루트에 `LICENSE` 신규 작성, `bundle.licenseFile`로 연결.
  2. **바이너리/`.desktop`이 전부 `app`이라는 이름**(`Exec=app`/`Icon=app`/`StartupWMClass=app`, `/usr/bin/app`) — `[package] name`을 `app` → `lightmark`로 변경해서 정리(`[lib] name = "app_lib"`는 안 건드림, `main.rs`의 `app_lib::run()`과 무관).
  3. **dock 아이콘 불일치 우려**(런타임 GTK app_id는 `dev.lightmark.viewer`인데 `.desktop` 파일명/`StartupWMClass`는 다름) — 재빌드 후 실제 설치해서 사용자가 직접 확인, **문제없이 정상 표시됨**. dev 모드에서 오래 보류돼 있던 dock 아이콘 미표시 문제는 실제 패키징 경로에서는 재현 안 되는 것으로 결론.
  - **라이선스 호환성 검토**: MIT로 확정하기 전, 실제 배포 바이너리에 들어가는 Rust 499개(`cargo metadata`, 기본 feature) + npm 165개(`package-lock.json`의 `dev: true` 제외 프로덕션만) 전수 대조 — GPL/AGPL/LGPL 없음 확인(MPL-2.0 몇 개는 파일 단위 약한 copyleft라 무수정 의존성으로는 무관, GTK/WebKitGTK는 동적 링크라 LGPL 예외 적용). 저장소 루트에 `THIRD-PARTY-NOTICES.md` 생성(662개 패키지, 라이선스 타입 11종별로 실제 설치 파일에서 추출한 전문 1회 + 패키지 목록) — 상세: `HANDOFF.md`. `LICENSE`/`THIRD-PARTY-NOTICES.md`를 실제 `.deb` 안에 포함시킬지는 **"그럴 필요 없어"로 확정** — 저장소에만 두는 현재 상태 유지, `bundle.resources`/`deb.files` 추가 안 함.
- **시작 시간 < 1s, 일반 문서 메모리 < 30MB 실측 — 사용자 결정으로 생략.** "성능은 충분히 좋아. 따로 측정할 필요 없어." 실사용 체감으로 목표 충족 판단, 별도 벤치마크 진행 안 함.
- **Windows 패키징 — 크로스 빌드는 기각, 실제 Windows 머신에서 네이티브 빌드 필요.** Tauri가 Windows 크로스 컴파일을 공식 지원하지 않음(WebView2 COM ABI가 MSVC/GNU 타깃 간 다름, MSI/WiX는 리눅스 네이티브 툴체인이 없음) — 코드 자체는 유닉스 전용 경로가 없어 깨끗함을 확인했으나, `gcc-mingw-w64-x86-64` 설치 직전에 사용자가 크로스 빌드 시도를 취소함. 실제 Windows 머신 준비사항(Rust+MSVC Build Tools, Node.js, `tauri.conf.json`의 `bundle.targets`를 Windows용으로 변경 필요, 서명 인증서 없으면 SmartScreen 경고 예상, single-instance 플러그인의 Windows 전용 재진입 콜백 스레드 실기 확인 필요)은 정리해서 전달함 — 상세: `HANDOFF.md`.

**검증**: `npm run tauri build` 성공(macOS `.app`/`.dmg`, Linux `.deb` 둘 다). 패키징된 결과물을 실제로 설치해서 실행/D-Bus 등록/dock 아이콘까지 재확인 완료. 성능 실측은 위 결정으로 생략. Windows는 실제 머신에서 진행할 때 마무리.

**패치 릴리스 0.1.1 (사용자 요청)**: 하이퍼링크/타이틀바 버그 수정 반영해서 버전을 0.1.0 → 0.1.1로 올림(`package.json`/`frontend/package.json`/`src-tauri/tauri.conf.json`/`src-tauri/Cargo.toml` + `README.md`, `backend/Cargo.toml`은 앱 버전과 무관해서 제외) → `npm run tauri build`로 `LightMark_0.1.1_amd64.deb` 재생성 → 기존 0.1.0 설치본을 `sudo apt install`로 업그레이드해서 실행/D-Bus 등록까지 재확인. 상세: `HANDOFF.md`.

**마이너 릴리스 0.2.0 (사용자 요청)**: 테마 10종 확장은 기능 추가라 0.1.1 → 0.2.0으로 올림(같은 파일들 + `README.md`의 테마 기능 설명/`theme` 필드 허용값 표도 이 김에 동기화). `LightMark_0.2.0_amd64.deb` 재생성 → 기존 0.1.1 설치본 업그레이드 확인 — 테마 10종이 포함된 첫 배포 빌드. 상세: `HANDOFF.md`.

---

### 멀티 윈도우/인스턴스 지원 (M1~M8 마일스톤 밖, 완료)

M6에서 `tauri-plugin-single-instance`로 "두 번째 실행이 기존 창으로 라우팅+포커스"를 의도된 동작으로 구현·검증했었으나, 사용자가 "LightMark는 뷰어이니 여러 인스턴스를 동시에 띄울 수 있어야 한다"고 뒤늦게 판단해 정반대 방향으로 재설계. 사용자 확인 4건: (1) 툴바 Open/창에 파일 1개 drag&drop → 그 창 내용 교체(기존 유지) — 파일 여러 개를 한꺼번에 drag&drop한 경우는 첫 파일만 이 규칙, 나머지는 (2)와 동일하게 파일마다 새 창(macOS 세션에서 확정, 아래 검증 단락 참고), (2) 더블클릭/CLI 재실행/macOS "Open With" → 파일마다 새 창, (3) macOS는 창을 전부 닫아도 앱 유지 + Dock 클릭 시 새 창, (4) config.json/state.json 동시 접근 방지 필요.

**핵심 메커니즘**: `get_initial_path`(전역 `Mutex` pull) 대신, 창을 만들 때(첫 창 포함) URL 자체에 `?file=<percent-encoded>`를 실어 보냄 — `main.ts`의 기존 `?file=` 처리(원래 Dev 전용, `capabilities.watch`로 게이팅돼 있어 Tauri에도 그대로 적용됨)가 그대로 이를 받음. Tauri 소스(`tauri-2.11.5/src/manager/webview.rs`, `src/protocol/tauri.rs`)로 쿼리스트링이 dev/prod 양쪽에서 살아남는 것을 확인.

`src-tauri/src/lib.rs`의 `open_window(app, file)` 헬퍼(IPC 커맨드 아님, Rust 내부에서만 호출)가 `tauri.conf.json`의 창 설정(`"create": false`로 자동 생성만 끔)을 복제해 `label`(`win-N`, 모듈 레벨 `AtomicU32`)/`title`/`url`만 창마다 채워 생성. single-instance 콜백과 macOS `RunEvent::Opened`(다중 URL 전부 순회)/`Reopen`(창 없을 때 새 창)/`ExitRequested`(마지막 창 닫힘만 `prevent_exit`, 프로그램적 종료는 통과)가 전부 이걸 호출. `WatcherRegistry`는 파일 경로 대신 창 라벨로 재키잉(두 창이 같은 파일을 봐도 서로 안 건드림), `on_window_event`의 `Destroyed`에서 정리. `file-changed`는 `emit_to`로 해당 창에만. `capabilities/default.json`의 `"windows"`는 `["win-*"]`.

macOS 콜드스타트에서 `setup()`이 `RunEvent::Opened`보다 먼저 실행돼 빈 창이 하나 더 뜨는 레이스가 있어서, `PristineWindow`(아직 파일이 안 실린 시작 창의 라벨을 기억)로 그 창을 재사용(`navigate()`)하도록 처리 — 재사용 자체는 `open_window`에서 `cfg!(target_os = "macos")`로 게이팅돼 macOS에서만 실제로 일어남(아래 실기 검증 참고, 처음엔 이 게이팅이 빠져 있었음). `backend/src/config.rs`/`state.rs`는 `Mutex`(프로세스 내 순서 보장) + 새 `backend/src/fsutil.rs`의 `atomic_write`(임시 파일+rename, 프로세스 경계를 넘는 파일 원자성) 둘 다로 보강 — 읽기 경로도 락 안에서 돌게 해서, 쓰기 도중 읽어 "깨진 파일"로 오판해 자기 치유가 멀쩡한 config를 덮어쓰는 경우를 막음.

이 설계는 Plan 에이전트로 실제 Tauri 소스(`~/.cargo/registry`에 받아져 있는 버전)를 대조 검증한 뒤, 다시 Plan 에이전트로 비평받아 실제 버그 5개(macOS 콜드스타트 레이스, `prevent_exit` 과잉 적용, 창 닫을 때 watcher 누수, `?file=`이 새로고침마다 재실행되는 문제, `url` 크레이트 direct dependency 누락)를 구현 전에 미리 잡아낸 뒤 반영했음. 상세 내역·근거 코드 인용은 `HANDOFF.md`의 "멀티 윈도우/인스턴스 지원 → 구현 완료" 참고.

검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) + 백엔드(`cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`) 전부 통과. `npm run tauri dev` 실기 검증(D-Bus `busctl` tree로 창 개수 확인)도 완료 — single-instance 라우팅/창 생성 자체는 정상 동작. 검증 중 한 차례 `PristineWindow` 재사용이 macOS 게이팅 없이 Linux/Windows의 일반 재실행에도 적용돼 결정 (2)의 "OS 트리거는 새 창"을 어기는 걸 발견 → 자율 루프 중 `cfg!(target_os = "macos")` 게이팅을 추가해 수정하고 재실기 검증(재실행 후 `window/1`·`window/2` 둘 다 존재)까지 완료(상세: `HANDOFF.md`의 "실기 검증(Linux, npm run tauri dev)"/"후속 조치"). macOS 전용 부분(`Opened`/`Reopen`/`ExitRequested`, `PristineWindow` 재사용, 다이얼로그 `set_parent`)은 이 세션이 Linux라 실기 검증 불가 — `RunEvent::Opened`와 같은 처지로 문서에 미검증 남김.

**macOS 세션에서 실기 검증 중 발견/수정한 버그**: 빈(pristine) 창에 파일을 여러 개 한꺼번에 drag&drop하면, 첫 파일이 그 창에 비동기로 로드되는 동안(`watch_file` 호출 전까지 pristine 플래그가 안 지워짐) 나머지 파일들의 `open_new_window` 호출이 거의 동시에 도착해 "지금 드롭 대상이 된 그 창 자신"을 pristine으로 오인해 재사용(`navigate()`)해버리는 레이스가 있었음 — IPC 커스텀 프로토콜이 끊겨 `Load failed` 에러, 결과적으로 창 하나에 파일 하나만 남음. `open_window(app, file, exclude)`에 `exclude` 파라미터를 추가해 "요청을 보낸 창 자신"을 재사용 후보에서 제외하도록 수정(`open_new_window` 커맨드가 자기 창 라벨을 넘김, 다른 4개 호출부는 OS 트리거라 "보낸 창" 자체가 없어 그대로 `None`). 수정 후 사용자가 실기로 재확인, 이 기회에 "drag&drop 다중 파일 → 첫 파일 교체 + 나머지 새 창" 동작 자체를 정식 결정으로 확정(위 (1) 참고). 상세: `HANDOFF.md`.

**Linux에서도 drag&drop 다중 파일 실기 확인 완료(2026-08-14).** 리눅스는 `PristineWindow` 재사용 자체가 `cfg!(target_os = "macos")`로 비활성화돼 있어 위 레이스가 구조적으로 재현될 수 없는 조건이지만, "다중 파일 drag&drop 메커니즘 자체"는 Wayland 마우스 자동화 제약으로 이 저장소의 자동화 세션에서는 못 눌러봤던 부분 — 사용자가 이미 열린 창/빈 창 두 시나리오 모두 직접 drag&drop해서 확인("둘 다 확인했어, 문제없어"). Windows만 아직 미확인으로 남음.

**버그 수정(사용자 리포트): Open/drag&drop으로 연 문서가 타이틀바에 파일명이 안 붙음.** `open_window()`가 제목을 창 **생성 시점**에만 정해서(더블클릭/CLI/"Open With"만 이 경로), 새 창을 안 만드는 툴바 Open/drag&drop(결정 #1: 그 창 내용만 교체)은 제목을 아무도 안 바꿔줌. `main.ts`의 `loadFile()`(모든 문서 로드 경로가 공유)에 `backend.setTitle()` 호출을 추가해 해결 — `BackendApi`에 `setTitle(title)`을 `openUrl`과 같은 이유(Web/Dev도 의미 있는 구현 가능)로 필수 메서드 추가, Tauri 쪽은 새 커맨드 없이 `core:window` API를 직접 호출(`capabilities/default.json`에 `core:window:allow-set-title` 추가 필요 - 이 API는 그 플러그인의 `default` 세트에 없음).

**후속(사용자 리포트): 그래도 화면상 안 바뀜.** `tauri dev` 완전 재시작 후에도 재현. `loadFile()`을 `setTimeout`으로 직접 호출해 "이미 떠 있는 빈 창에 Open/drop"을 GUI 없이 재현하고 `title()` 되읽기를 임시로 추가해 확인한 결과, `setTitle()`은 성공하고 Tauri/GTK 내부 상태(`tao`의 `Window::title()`이 GTK 위젯에서 직접 읽는 라이브 값)까지 정확히 갱신됨 — 우리 구현은 정확함. WebSearch로 확인한 결과 **Tauri 자체의 Linux/Wayland 업스트림 버그**([tauri-apps/tauri#13749](https://github.com/tauri-apps/tauri/issues/13749) — `setTitle()`이 내부 상태/taskbar는 갱신하지만 GTK 헤더바 텍스트 리페인트는 안 함)와 증상이 정확히 일치. 사용자가 "알려진 한계로 받아들이고 넘어가기"로 확정 — 추가 코드 변경 없음. 상세: `HANDOFF.md`.

---

## Open Questions (해당 마일스톤 착수 시점에 결정)

1. **[해결됨] M2 — raw HTML 허용 여부**: `html: false`로 확정. `docs/*.md`를 grep한 결과 raw HTML은 전부 인라인 코드/코드블록 안에서만 등장(`<input type=file>`, `<span class="lm-math">` 등은 문서화 예시일 뿐)해서 실제로 깨지는 문서가 없다. sanitizer 의존성을 추가할 이유가 없으므로 보류.
2. **[해결됨] M5 — `axum`, `dirs` 의존성 승인**: 둘 다 승인. `axum`은 대체 수단이 없어(경량 서버 자체 구현이 더 위험) 그대로, `dirs`는 사용자에게 직접 구현 대안과 함께 확인받아 크레이트 사용으로 확정.
3. **[해결됨] M6 — md 파일 내 상대 경로 이미지 링크 처리**: md 파일의 위치를 기준으로 상대 경로를 resolve하는 게 의미상 맞지만(Dev/Tauri는 실제 파일 경로를 알아서 고칠 수 있음, Web은 브라우저 File API 보안상 파일 경로 자체를 알 수 없어 원천적으로 불가능), **사용자 결정: 지금 상태(모드별로 깨져 있는 현재 동작) 그대로 유지, 수정하지 않음**. 재검토 요청이 없으면 이대로 둔다.

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
npm run tauri dev

# 패키징 (M8)
npm run tauri build
```

마일스톤 종료 조건은 매번 동일하다: 해당 검증 통과 + 린트/빌드 무에러 + Web 모드와 (M5 이후) Dev 모드 양쪽 동작 + 관련 문서 갱신.
