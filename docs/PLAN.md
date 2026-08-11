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

---

### M4 — 지연 로딩 (Mermaid / KaTeX / Shiki)

세 로더 모두 동일한 형태: **렌더 결과에 대상 노드가 있을 때만** `await import()`. `core/lazy/*.ts`는 각각 모듈 레벨 캐시 프로미스를 들고 있어 중복 로드를 막는다.

- Mermaid: `pre > code.language-mermaid`가 1개 이상일 때만
- KaTeX: M2가 심어둔 `.lm-math` 노드가 있을 때만. CSS도 동적 주입
- Shiki: 코드블록 존재 시. 문서에 실제로 등장한 언어만 로드. 하이라이팅은 렌더 완료 후 비동기로 덮어써서 첫 페인트를 막지 않는다

Config의 `mermaid`/`katex`/`syntaxHighlight`가 false면 import 자체를 하지 않는다.

**검증**: 세 요소가 없는 문서를 열었을 때 Network 탭에 해당 청크 요청이 없음(각 기능당 1회씩 확인). `npm run build` 후 청크가 분리되어 있고 초기 번들에 포함되지 않음.

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
