# HANDOFF

작업 이어가기용 현재 상태 요약. (2026-08-11 기준)

## 진행 상황

- **M1 (Bootstrap)**: 완료. Vite+TS+Web Components 골격, ESLint/Prettier(Tauri import 격리 규칙 포함), Vitest 셋업.
- **M2 (Markdown Renderer / TOC Engine / Breadcrumb Engine)**: 완료. 아래 "M2 구현 상세" 참고.
- **M3 (Theme Engine / Custom CSS / Font Loader)**: 완료. 아래 "M3 구현 상세" 참고.
- **M4~M6**: 미착수. `docs/TASKS.md`, `docs/PLAN.md` 참고.

다음 세션은 사용자의 새 지시(M4 착수 등)를 기다리는 상태에서 시작.

## M2 구현 상세

### Markdown 렌더링 (`frontend/src/core/markdown.ts`)
- `markdown-it` 사용, `html: false`(XSS 방지, 실제 문서 중 raw HTML 의존 없음을 grep으로 확인), `linkify: true`.
- 커스텀 룰(플러그인 아님): task-list 체크박스, `$...$`/`$$...$$` 수식 placeholder(`.lm-math`/`.lm-math-block`, 실제 KaTeX 렌더링은 M4에서), heading id 부여/수집.
- 타입: markdown-it 자체 bundled 타입(`Env`, `RendererRule`, `StateBlock`, `StateCore`, `StateInline`)을 사용. 별도 `@types/markdown-it`(DefinitelyTyped)와 타입 충돌이 있어 제거함(`npm uninstall @types/markdown-it`).

### 순수 함수 (Vitest로 테스트, `core/`)
- `slug.ts`: `createSlugger()` — 중복 시 `-1`, `-2` suffix.
- `toc.ts`: `buildToc(headings)` — level 기반 스택으로 nested tree 생성.
- `breadcrumb.ts`: `buildBreadcrumb(headings, activeId)` — 같은 스택 기법으로 ancestor path 계산.

### 활성 heading 추적 (`frontend/src/components/lm-viewer.ts`)
"프레임마다 실행되는 scroll 핸들러 금지" 원칙을 지키며 다음 설계로 정착(여러 버그를 거쳐 확정):

- `IntersectionObserver`, `root: this`(lm-viewer가 자체 스크롤 컨테이너이므로 window를 root로 쓰면 안 됨).
- pane 상단에 얇은 트립와이어 밴드: `rootMargin: '0px 0px -98% 0px'`, `threshold: 0`.
- **enter 이벤트만 신뢰**(`entry.isIntersecting === true`). exit 이벤트는 heading 줄 전체가 지나간 후에야 발생하는 구조적 지연이 있어 무시.
- `scrollend`(프레임당이 아닌, 스크롤 제스처 종료 시 1회) 이벤트에서 `reconcileActiveHeading()` 실행 — 빠른 스크롤이 얇은 밴드를 건너뛰는 경우의 보정. `getBoundingClientRect()` 기반 정확한 계산이며, "top이 pane 상단을 지난 마지막 heading, 없으면 첫 heading" 이 기본값(빠른 스크롤업으로 문서 최상단 복귀 시 첫 heading 포커싱 실패 버그의 원인이자 수정 지점).

해결된 버그 순서(참고용, 전부 수정 완료):
1. 스크롤 다운 시 실제보다 한 단계 앞선 heading이 강조됨 → entries 배치 한계 → 전체 상태를 누적하는 Map으로 수정(부분 수정).
2. 여전히 heading이 화면 최상단 도달 전에 미리 선택됨 → `rootMargin -70%`가 너무 넓고 `root`가 window로 잘못 설정됨 → `root: this` + 얇은 밴드로 수정.
3. heading 줄이 화면에서 벗어난 후에야 focus 전환됨 → geometry 재계산이 exit 이벤트에 의존했던 게 원인 → enter-only 신뢰 방식으로 전환.
4. 빠른 스크롤 시 focus가 못 따라감 → 얇은 밴드를 빠른 스크롤이 건너뜀 → `scrollend` 보정 추가.
5. 빠른 스크롤업으로 문서 처음 복귀 시 가끔 첫 heading이 focus 안 됨 → `reconcileActiveHeading`의 `active` 초기값이 `undefined`였음(pane padding 때문에 첫 heading의 top이 정확히 0이 아님) → 초기값을 `headingEls[0]`으로 변경.

### Breadcrumb: 고정 행 → 토스트 (UI 변경, 확정됨)
- 원래 PRD/UI_SPEC은 "Toolbar 아래 고정 행"이었으나, 사용자 요청으로 **Viewer 영역 상단에 뜨는 토스트**로 변경. `docs/PRD.md`, `docs/UI_SPEC.md`, `docs/PLAN.md` 모두 갱신됨.
- 구현: `frontend/index.html`에 `.lm-viewer-pane`(position:relative) wrapper 추가, 그 안에 `lm-breadcrumb`(position:absolute, top/left/right)와 `lm-viewer`를 나란히 배치. `#app` grid는 breadcrumb 전용 행을 제거하고 `auto 1fr auto`로 축소.
- `lm-breadcrumb.setActive(id)` 호출 시 `.lm-breadcrumb-visible` 클래스 토글로 fade in, `setTimeout`(`VISIBLE_MS = 1500`, 밀리초)으로 1.5초 후 자동 fade out. 연속 변경 시 타이머 리셋(`clearHideTimer`).
- 스타일은 "라인 없는 floating pill + color-mix 배경"으로 한 차례 바꿨다가, 사용자가 스타일은 원래(전체 폭 bar + `border-bottom`)가 더 좋다고 하여 **스타일만 원복**, 유지시간 1.5초는 유지. 현재 `frontend/src/styles/layout.css`의 `lm-breadcrumb` 규칙이 최종 상태.
- 폭 부족 시 단계적 축약 로직(전체 표시 → `First > ... > Last` → 개별 ellipsis)은 이번 변경과 무관하게 그대로 유지됨.

### main.ts 이벤트 순서 버그(자체 발견, 수정됨)
`viewer.setContent(...)`가 새 문서의 첫 heading에 대한 `lm-active-heading` 이벤트를 동기적으로 발생시키므로, `toc.setToc(...)`/`breadcrumb.setHeadings(...)`가 **반드시 그 전에** 호출되어야 함(안 그러면 이전 문서 데이터 기준으로 활성 heading을 계산하게 됨). `main.ts`의 `loadFile()`에서 순서를 수정함.

## M3 구현 상세

### Theme / Font / Zoom (`frontend/src/core/theme.ts`)
- `docs/PLAN.md` 아키텍처 문서에 명시된 대로 테마/폰트/줌 전부 `core/theme.ts` 한 파일에 둠.
- `computeCssVars(config): Record<string, string>` — 순수 함수, Vitest로 테스트(`theme.test.ts`). 내장 테마는 `github-light`/`github-dark` 2종(색상 토큰 하드코딩), 폰트는 시스템 스택 우선 + 설정된 이름을 앞에 붙임(공백 포함 시 quote 처리, 예: `"JetBrains Mono"`), zoom은 퍼센트를 100으로 나눈 배수.
- `applyTheme(config, root?)` — 유일한 DOM 부수효과 함수. `root.style.setProperty`로 `:root` CSS 변수 주입, `<style id="lm-custom">`을 매번 통째로 교체(customCss), `printUseLightTheme`에 따라 `<html>`에 `.lm-print-light` 클래스 토글.
- `main.ts`에서 시작 시 1회 `backend.readConfig().then(applyTheme)` 호출. Web 모드는 M5 전까지 `DEFAULT_CONFIG`를 즉시 resolve하므로 실질적으로는 상수 적용이지만 경로 자체는 이미 config 기반.

### 중요 함정: 인라인 스타일 vs `!important`
`applyTheme`이 `<html>`에 색상 변수를 **인라인 스타일**로 주입하기 때문에, 인쇄 시 라이트 테마를 강제하는 `@media print { .lm-print-light { --lm-color-bg: ... } }` 규칙은 `!important`가 없으면 절대 이기지 못함(인라인 스타일이 특이도와 무관하게 우선). `frontend/src/styles/layout.css`의 `.lm-print-light` 블록에 전부 `!important`를 붙여 해결함.

### 버그 수정: dark 모드에서 empty-state 안내문이 안 보임
`.lm-empty`(뷰어의 "Drop a Markdown file here, or use Open.")가 `--lm-color-border`를 글자색으로 재사용했던 게 원인 — border는 구분선용 저대비 색이라 dark 테마(`#30363d` on `#0d1117`)에서 거의 안 보임. `theme.ts`에 별도 `--lm-color-muted`(secondary text, `github-light: #656d76` / `github-dark: #8b949e`) 토큰을 추가해 `.lm-empty`가 이걸 쓰도록 수정. `tokens.css`의 pre-JS 기본값에도 동일 반영.

### 결정: 기본 테마는 light mode (`github-light`)
`DEFAULT_CONFIG.theme`을 `github-dark` → `github-light`로 변경(사용자 확인 후 확정). `docs/CONFIG_SPEC.md` 스키마 예시, `frontend/src/types/config.test.ts`도 같이 갱신. `theme.ts`의 "알 수 없는 테마 이름일 때 폴백" 값은 건드리지 않고 그대로 `github-dark` — 이건 앱의 기본 테마가 아니라 잘못된 config 값에 대한 방어 로직이라 별개로 취급.

### Zoom / Print CSS (`frontend/src/styles/layout.css`)
- `--lm-zoom`은 `.lm-markdown { font-size: calc(1rem * var(--lm-zoom)); }`로만 적용 — 툴바/상태바는 이 변수를 참조하지 않아 자연히 고정됨.
- `@media print`: `lm-toolbar`/`lm-toc`/`lm-statusbar`/`lm-breadcrumb`을 `display: none !important`로 숨기고, `.lm-markdown pre`에 `break-inside: avoid`(+legacy `page-break-inside: avoid`)로 코드블록 페이지 분할 방지.
- **결정(사용자 확인): 툴바 Zoom 버튼 배선은 M5 이후로 명시적으로 미룸.** Web 모드에서 `WebBackend.readConfig()`가 항상 `DEFAULT_CONFIG`만 반환해 실제 config.json이 반영될 대상이 없기 때문 — M5 "Config System"이 붙으면 그때 배선한다(`docs/PLAN.md` M3/M5 절 참고). M3 검증("zoom 50~200% 레이아웃 정상")은 `DEFAULT_CONFIG.zoom`을 코드에서 임시로 바꿔 눈으로 확인하는 방식으로 대체함. Print 버튼도 동일하게 미배선(브라우저 Ctrl+P로 `@media print` 규칙은 이미 검증 가능).

## 표준 작업 규칙 (이번 세션에서 재확인됨)
- **git commit은 사용자가 직접 함.** 명시적으로 요청받지 않으면 절대 커밋하지 말 것.
- 코드 변경 후 검증: `npm run lint && npm run typecheck && npm run build && npm run test` (frontend/ 기준). 문서(.md)만 변경한 경우는 해당 없음.
- `docs/PLAN.md`의 Open Question 중 M2 관련(raw HTML 미사용)은 해결됨. M5의 `axum`/`dirs` 의존성 승인은 아직 미결.

## 다음에 할 일 (사용자 지정 대기)
M4(Mermaid/KaTeX/Shiki 지연 로딩)가 `docs/PLAN.md` 순서상 다음이지만, 아직 사용자의 명시적 지시는 없음 — 다음 세션은 사용자의 새 요청으로 시작해야 함.
