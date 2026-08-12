# HANDOFF

작업 이어가기용 현재 상태 요약. (2026-08-12 기준)

## 진행 상황

- **M1 (Bootstrap)**: 완료. Vite+TS+Web Components 골격, ESLint/Prettier(Tauri import 격리 규칙 포함), Vitest 셋업.
- **M2 (Markdown Renderer / TOC Engine / Breadcrumb Engine)**: 완료. 아래 "M2 구현 상세" 참고.
- **M3 (Theme Engine / Custom CSS / Font Loader)**: 완료. 아래 "M3 구현 상세" 참고.
- **M4 (Mermaid / KaTeX / Shiki 지연 로딩)**: 완료. 아래 "M4 구현 상세" 참고.
- **M5 (Rust 백엔드 + Dev 서버 + 어댑터)**: 완료. 아래 "M5 구현 상세" 참고.
- **M6 (Tauri 통합)**: **완료, 전체 검증 완료**(+사용자 리포트로 버그 2건 수정: Open 버튼 데드락, Tauri drag&drop). 아래 "M6 구현 상세" 참고. Packaging/Release는 원래 M6에 있었으나 **M8로 분리**(사용자 요청 — 통합과 배포는 성격이 달라서, 배포는 맨 마지막 마일스톤으로). 사용자가 실제 Tauri 앱에서 직접 확인 완료: live reload, Config 4개 버튼(Config Folder/File 열기, Reload/Reset Config), Open 다이얼로그 마지막 위치 기억, CLI 인자로 파일 열기, single-instance 라우팅.
- **M7 (TOC Toggle / Zoom / About)**: 신규 마일스톤, 미착수. 아래 "다음에 할 일" 참고.
- **M8 (패키징 및 배포)**: 신규 마일스톤(M6에서 분리), 미착수. AppImage 패키징(`patchelf`/`libfuse2t64` 미설치), 릴리스 빌드 성능 실측(<1s, <30MB), macOS `RunEvent::Opened` 실기 검증 등.

다음 세션은 사용자의 새 지시를 기다리는 상태에서 시작 — M7과 M8 중 어느 걸 먼저 할지가 다음 화두.

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
- `scrollend`(프레임당이 아닌, 스크롤 제스처 종료 시 1회) 이벤트에서 `reconcileActiveHeading()` 실행 — 빠른 스크롤이 얇은 밴드를 건너뛰는 경우의 보정. `getBoundingClientRect()` 기반 정확한 계산.

해결된 버그 순서(참고용, 전부 수정 완료):
1. 스크롤 다운 시 실제보다 한 단계 앞선 heading이 강조됨 → entries 배치 한계 → 전체 상태를 누적하는 Map으로 수정(부분 수정).
2. 여전히 heading이 화면 최상단 도달 전에 미리 선택됨 → `rootMargin -70%`가 너무 넓고 `root`가 window로 잘못 설정됨 → `root: this` + 얇은 밴드로 수정.
3. heading 줄이 화면에서 벗어난 후에야 focus 전환됨 → geometry 재계산이 exit 이벤트에 의존했던 게 원인 → enter-only 신뢰 방식으로 전환.
4. 빠른 스크롤 시 focus가 못 따라감 → 얇은 밴드를 빠른 스크롤이 건너뜀 → `scrollend` 보정 추가.
5. 빠른 스크롤업으로 문서 처음 복귀 시 가끔 첫 heading이 focus 안 됨 → `reconcileActiveHeading`의 `active` 초기값이 `undefined`였음(pane padding 때문에 첫 heading의 top이 정확히 0이 아님) → 초기값을 `headingEls[0]`으로 변경.
6. **(M6 테스트 중 사용자 리포트) 첫 heading 앞에 본문이 있으면 문서를 열거나 맨 위로 스크롤할 때 그 heading이 잘못 focus됨** → 5번 수정의 "기본값 = 첫 heading"이 "top을 지난 heading 없음"을 전부 "첫 heading으로 보정"해버려서, "본문이 실제로 앞에 있어 아직 안 도달함"과 "패딩 때문에 top이 정확히 0이 아님"을 구분 못 했음 → 기본값을 **`null`(아무것도 focus 안 됨)**으로 바꾸고, `top <= 0` 대신 `top <= TOP_TOLERANCE_PX`(24px, `padding: 1rem` + 여유분)로 완화 — 패딩만큼만 밀린 진짜 "맨 위" heading은 여전히 잡히고, 본문 몇 줄만큼 밀린 heading은 정확히 걸러짐. `setContent()`(로드 시)와 `reconcileActiveHeading()`(scrollend)가 이제 `computeActiveHeadingId()` 하나를 공유. `lm-toc`/`lm-breadcrumb`의 `setActive`는 이미 `string | null`을 받도록 짜여 있어서 프론트 쪽은 자연스럽게 흘러들어감 — `ActiveHeadingDetail.id`/`lm-viewer.setActive()`만 타입을 `string` → `string | null`로 맞춰줌.
7. **(사용자 리포트) 문서 끝에 여러 heading이 한 화면에 다 보일 때 TOC의 다른 heading을 클릭해도 focus/breadcrumb가 안 바뀜** → 활성 heading 추적이 전부 스크롤 이벤트에 의존하는데, 클릭한 heading이 이미 화면에 보이는 상태(문서 끝, 더 스크롤할 공간이 없음)라 앵커 이동이 실제 스크롤을 전혀 안 유발함 → `scroll`/`scrollend` 자체가 안 나서 갱신 트리거가 없었음 → `lm-toc`가 링크 클릭을 직접 감지해 `lm-toc-select` 이벤트를 dispatch, `main.ts`가 `viewer.focusHeading(id)`를 호출. **1차로는 클릭한 id를 무조건 활성으로 강제했는데, 사용자가 바로 정정**: 문서 끝이라 그 heading을 화면 맨 위까지 못 올리는 경우, 클릭한 heading이 화면 중간에 있는데도 활성으로 표시되는 게 어색하고, 살짝만 스크롤해도 원래 규칙(화면 맨 위 heading)으로 확 바뀌어서 일관성이 없었음 → `focusHeading`을 `scrollIntoView` 후 `computeActiveHeadingId()`로 다시 계산한 결과를 활성으로 쓰도록 수정 — 일반적인 경우는 클릭한 heading과 같은 결과가 나오고, 문서 끝처럼 못 올라가는 경우엔 화면에서 실제로 맨 위인 heading이 선택돼서 스크롤로 도달했을 때와 같은 규칙을 따름. 라이브 리로드 스크롤 앵커 복원과 동작이 같아서 `scrollToHeading` → `focusHeading`으로 이름 바꾸고 두 곳 다 이걸 씀.

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

### 버그 수정(사용자 리포트, M6 테스트 중 발견, 확정): Tauri(WebKitGTK)에서 글자가 두꺼워 보임
`fc-match`로 확인: 이 환경엔 `Pretendard`(기본 `fontFamily`)가 설치 안 돼 있고, `system-ui`/`sans-serif`조차 이 시스템의 유일한 sans 폰트(`Noto Sans`)로 매칭됨 — 폰트나 `font-weight`(devtools로 미지정=normal 확인) 문제가 아니라 **같은 폰트/굵기/크기인데 WebKitGTK가 Chromium보다 두껍게 래스터라이즈**하는 엔진 차이.

중간에 `.lm-markdown`(뷰어)에만 좁게 적용했다가 "TOC가 굵어졌다"는 리포트를 "상대적 착시"로 잘못 판단해 넘어갔고, 사용자가 강하게 정정(TOC는 원래 정상이었음)한 시행착오가 있었음 — `.lm-markdown`이 `lm-toc`의 조상이 아니라 일반적인 CSS 상속으로는 설명 안 되는 인과관계라 정확한 이유는 끝내 못 밝혔지만, **매번 Tauri 앱을 완전히 재시작하며(핫리로드 캐시 문제 아님을 확인) 재검증한 결과 최종적으로 `html, body`(전체 적용) 상태에서 뷰어/TOC 둘 다 정상으로 확정**.

수정: `html, body`에 `-webkit-font-smoothing: antialiased` + `-moz-osx-font-smoothing: grayscale` — 앱 전체에 상속으로 한 번에 적용. Chromium/Firefox는 대부분 무시하므로 회귀 위험 없음.

**알려진 업스트림 이슈(참고용, 이후 재발 시 볼 것)**: [tauri-apps/tauri#14286](https://github.com/tauri-apps/tauri/issues/14286) — WebKitGTK(Linux)가 지정된 font-weight보다 약 +100 무겁게 렌더링하는, 아직 미해결인 업스트림 버그(computed style은 정상인데 실제 래스터라이즈만 두꺼움 — 이번에 겪은 증상과 일치). 사용자가 직접 발견한 "TOC에 스크롤바가 생길 때만 굵어짐" 현상은 이 이슈나 [관련 정리 글](https://medium.com/@dasunnimantha777/fonts-render-too-bold-in-rust-tauri-wails-on-linux-a-webkitgtk-bug-and-how-to-fix-it-8b6a0b27b613)이 명시한 "스크롤/overflow/compositing과 무관"이라는 설명과는 안 맞는 별개 각도라 완전히 설명은 못 함. 그 글의 "정식" 해결법(weight 300 폰트를 직접 번들링해 `@font-face`로 등록, +100 오프셋을 상쇄하도록 일부러 가벼운 weight 지정)은 `CLAUDE.md`의 "웹폰트 번들 금지" 원칙과 충돌해서 적용 안 함 — 지금은 `-webkit-font-smoothing`만으로 충분하다고 확인해서 여기서 멈춤.

### 결정: 기본 테마는 light mode (`github-light`)
`DEFAULT_CONFIG.theme`을 `github-dark` → `github-light`로 변경(사용자 확인 후 확정). `docs/CONFIG_SPEC.md` 스키마 예시, `frontend/src/types/config.test.ts`도 같이 갱신. `theme.ts`의 "알 수 없는 테마 이름일 때 폴백" 값은 건드리지 않고 그대로 `github-dark` — 이건 앱의 기본 테마가 아니라 잘못된 config 값에 대한 방어 로직이라 별개로 취급.

### 개선(사용자 요청): 기본 config 값 3개 변경
`fontFamily`/`codeFontFamily` 기본값을 `Pretendard`/`JetBrains Mono`(둘 다 이 환경엔 미설치 — 위 WebKitGTK 폰트 굵기 조사에서 `fc-match`로 확인한 사실)에서 제네릭 CSS 키워드 `sans-serif`/`monospace`로 변경. `buildFontStack`이 이미 이 값을 시스템 폰트 스택 앞에 붙이는 구조라 동작은 그대로(`sans-serif, system-ui, ...`처럼 값이 중복되지만 해롭지 않음) — 특정 폰트가 설치돼 있어야 한다는 전제가 없어짐. `printUseLightTheme` 기본값도 `false` → `true`로 변경. 세 곳(`frontend/src/types/config.ts`의 `DEFAULT_CONFIG`, `backend/src/config.rs`의 `Config::default()`, `docs/CONFIG_SPEC.md` 스키마 예시) 동시 수정 — `config.rs` 파일 상단 주석이 명시하는 "세 군데 항상 값 일치" 규칙 그대로 유지. `frontend/src/types/config.test.ts`의 `DEFAULT_CONFIG` 스냅샷도 같이 갱신. 검증: 프론트/백엔드 전체 검증 스위트 재통과(프론트 22 tests 변화 없음, 백엔드 13 tests 변화 없음).

### Zoom / Print CSS (`frontend/src/styles/layout.css`)
- `--lm-zoom`은 `.lm-markdown { font-size: calc(1rem * var(--lm-zoom)); }`로만 적용 — 툴바/상태바는 이 변수를 참조하지 않아 자연히 고정됨.
- `@media print`: `lm-toolbar`/`lm-toc`/`lm-statusbar`/`lm-breadcrumb`을 `display: none !important`로 숨기고, `.lm-markdown pre`에 `break-inside: avoid`(+legacy `page-break-inside: avoid`)로 코드블록 페이지 분할 방지.
- **결정(사용자 확인): 툴바 Zoom 버튼 배선은 M5 이후로 명시적으로 미룸.** Web 모드에서 `WebBackend.readConfig()`가 항상 `DEFAULT_CONFIG`만 반환해 실제 config.json이 반영될 대상이 없기 때문 — M5 "Config System"이 붙으면 그때 배선한다(`docs/PLAN.md` M3/M5 절 참고). M3 검증("zoom 50~200% 레이아웃 정상")은 `DEFAULT_CONFIG.zoom`을 코드에서 임시로 바꿔 눈으로 확인하는 방식으로 대체함. Print 버튼도 동일하게 미배선(브라우저 Ctrl+P로 `@media print` 규칙은 이미 검증 가능).

## M4 구현 상세

### 지연 로더 (`frontend/src/core/lazy/{mermaid,katex,shiki}.ts`)
- 셋 다 같은 형태: 모듈 레벨 캐시 프로미스(`let xPromise: Promise<...> | null = null; xPromise ??= import(...)`) + "대상 DOM 노드가 있을 때만" 가드. 노드가 없으면 `import()` 자체가 실행되지 않고 즉시 return.
- 실제 라이브러리 추가: `mermaid`, `katex`, `shiki` — 셋 다 `CLAUDE.md` Frontend Allowed 목록에 있어 승인 불필요, `package.json` dependencies에 추가됨.
- 호출 지점: `lm-viewer.ts`의 `setContent()`가 HTML을 DOM에 심은 직후 `enhance()`에서 **mermaid → shiki → katex** 순서로 실행(await 체인). mermaid를 먼저 하는 이유: shiki가 코드블록을 찾을 때 `language-mermaid` 블록이 이미 `<svg>`로 교체돼 있어야 잘못 하이라이트하지 않음(shiki 쪽에도 별도로 `language-mermaid` 제외 필터가 있어 이중 방어).
- Config 플래그(`mermaid`/`katex`/`syntaxHighlight`) 체크는 `lm-viewer.ts`(호출할지 여부), 대상 노드 존재 체크는 각 `lazy/*.ts` 내부 — main.ts가 `currentConfig`(M3에서 추가)를 `RenderOptions`로 묶어 `viewer.setContent(html, headings, options)`에 넘김.

### 라이브러리별 함정/설계 포인트
- **Shiki는 자체적으로 이미 언어별 지연 로딩을 구현한다.** `import('shiki')`(fine-grained가 아닌 barrel)를 해도 내부 언어/테마 목록은 전부 `() => import('@shikijs/langs/...')` 클로저라 실제 쓴 언어만 fetch됨 — 우리 쪽에서 "문서에 등장한 언어만 골라서 import" 로직을 따로 만들 필요가 없었음. 테마 이름도 Shiki 내장 테마가 `github-light`/`github-dark`로 우리 Config 값과 그대로 일치.
- **KaTeX CSS**: `Promise.all([import('katex'), import('katex/dist/katex.css')])`로 JS와 같이 동적 import — Vite가 code-split해서 실제 사용 시점에만 `<link>` 주입. 수동 DOM 조작 불필요.
- 셋 다 개별 블록 단위 try/catch: 오타 언어명(shiki), 문법 오류 있는 mermaid 소스, 잘못된 KaTeX 수식 — 전부 원본을 그대로 두고 넘어감(임의 사용자 마크다운이라 실제로 발생하는 입력).
- **버그 수정(사용자 리포트): mermaid는 render() 실패를 try/catch로 못 잡는다.** `mermaid.render()`는 문법 오류가 있어도 reject하지 않고 대신 내장 "error diagram"(빨간 에러 아이콘 + `Syntax error in text` + `mermaid version X.Y.Z` SVG)을 정상 resolve해버려서, 화면에 저 에러 이미지가 그대로 나왔다(`samples/all-features.md`의 의도적으로 깨진 mermaid 블록에서 재현). 수정: `mermaid.render()` 전에 `mermaid.parse(source, { suppressErrors: true })`로 먼저 검증하고 `false`면 render()를 호출하지 않음(node로 직접 확인: 깨진 소스는 `false`, 정상 소스는 `{diagramType, config}` 반환 — parse는 DOM 없이도 동작).
- `npm run build` 확인: `mermaid`, `katex` 각각 별도 청크, Shiki도 언어별(`typescript-*.js`, `python-*.js`, `cpp-*.js` 등) + 테마별 청크로 쪼개져 있고 초기 `index-*.js`(~127KB)에는 전혀 포함 안 됨 — M4 검증 기준 중 "빌드 후 청크 분리" 항목은 이걸로 확인. "네트워크 탭에 요청 없음" 항목은 코드 레벨로 확인(각 로더가 노드 존재 체크를 `import()` 호출보다 먼저 하도록 짜여 있어 구조적으로 보장됨) — 실제 헤드리스 브라우저로 네트워크 캡처까지는 하지 않았음(도구 제약, 별도 자동화 설치는 과함으로 판단).

### 실패 시 ⚠️ 경고 표시 (사용자 요청)
- mermaid: `core/lazy/warning.ts`의 `renderWarning(message)`가 `<p class="lm-render-warning">⚠️ ...</p>`를 원본 `<pre>` 앞에 삽입. mermaid 블록은 항상 block 컨텍스트라 안전.
- KaTeX: 기본값인 `throwOnError: false`는 던지지 않고 KaTeX 자체의 (눈에 잘 안 띄는) 에러 span을 렌더해버려서 mermaid와 같은 문제가 있었음 — `throwOnError: true`로 바꿔 실제로 던지게 하고 catch에서 노드 자체의 텍스트/클래스를 그 자리에서 바꿈(`node.textContent = '⚠️ Invalid math: ...'` + `.lm-render-warning-inline`). `.lm-math`가 인라인(`<span>`, 문단 안)일 수도 있어서 새 엘리먼트를 형제로 끼워넣지 않고 노드 자체를 바꾸는 방식을 택함 — DOM 중첩 규칙 위반 없음.
- CSS는 테마 토큰과 무관하게 고정된 빨간 계열 색(`#d1242f`) — 경고는 라이트/다크 상관없이 똑같이 눈에 띄어야 함.
- `samples/all-features.md`에 의도적으로 깨진 inline/block 수식 예제(`\notarealcommand{x}`)를 추가해서 이 경로도 같이 테스트 가능하게 해둠.

### 뒤늦게 발견/수정: 이미지 lazy loading이 어느 마일스톤에도 없었음
`CLAUDE.md`의 "Images: Use lazy loading" 규칙이 M1~M4 어디에도 작업 항목으로 배정돼 있지 않아 빠져 있었음(사용자가 "존재하지 않는 이미지는 어떻게 보여?"라고 물어보다가 드러남 — 그때 보니 `<img>`에 `loading="lazy"`도 없고 `max-width` CSS도 없었음). 세 가지 같이 처리:
- `core/markdown.ts`: `lm_image_attrs` core 룰 추가 — 모든 `image` 토큰에 `loading="lazy"` + `class="lm-image"` 부여(task list/heading id 룰과 같은 패턴, 렌더러를 새로 안 만들고 토큰에 속성만 얹음).
- `layout.css`: `.lm-image { max-width: 100%; height: auto; }`.
- `core/images.ts`(신규, **`core/lazy/`가 아님** — 임포트할 외부 라이브러리가 없어서 지연 로딩 캐시 프로미스 패턴이 필요 없음): `<img>`마다 `error` 이벤트 1회 리스닝, 실패 시 브라우저 기본 "깨진 이미지" 아이콘 대신 `.lm-render-warning-inline`(mermaid/KaTeX와 동일 스타일)로 교체. `lm-viewer.ts`의 `setContent()`에서 HTML 심은 직후 **동기적으로** 호출(비동기 `enhance()`보다 먼저 — 에러 리스너는 로드 시작 전에 붙어 있어야 함).
- `samples/all-features.md`에 깨진 이미지 예시(`/no/such/image.png`) 추가.

### 버그 수정(사용자 리포트): `theme`을 `github-dark`로 바꾸면 mermaid 다이어그램 선이 잘 안 보임
100번째 줄 "Shiki는 우리 `theme` 값이 내장 테마 이름과 그대로 일치해서 매핑 불필요"는 **mermaid엔 적용되지 않음** — mermaid는 자체 테마 이름 체계(`default`/`dark`/`forest`/`neutral`/`base`)를 쓰는데, `mermaid.initialize()`가 `theme` 옵션 없이 호출돼서 앱 테마와 무관하게 항상 mermaid 기본 테마(`default`, 밝은 배경 전제 — 짙은 글자/선)로만 렌더링됐던 게 원인. 수정: `core/lazy/mermaid.ts`에 순수 함수 `mermaidThemeOf(appTheme)` 추가, `mermaid.initialize({ startOnLoad: false, theme: mermaidThemeOf(appTheme) })`로 전달. `renderMermaid(container, appTheme)`으로 시그니처 변경 — 호출부(`lm-viewer.ts`의 `enhance()`)는 이미 갖고 있던 `options.theme`을 그대로 넘겨주기만 하면 됨.

**후속 질문(사용자): 인식 안 되는 테마 이름은?** `config.theme`은 검증 없는 순수 문자열이라 `github-light`/`github-dark`가 아닌 값도 넣을 수 있는데, `theme.ts`의 `resolveThemeTokens`는 그런 미인식 값을 전부 다크 토큰으로 폴백한다. 1차로 짠 `mermaidThemeOf`는 `appTheme === 'github-dark'`만 `'dark'`, **그 외 전부(미인식 값 포함) `'default'`**로 보내서 — 미인식 테마 이름을 쓰면 앱은 다크인데 mermaid만 라이트로 어긋나는, 방금 고친 것과 같은 종류의 버그가 재발할 뻔했음. 수정: `theme.ts`에서 `isLightTheme(theme)`(`theme === 'github-light'`인지만 확인)를 export하고 `resolveThemeTokens`도 이걸로 다시 쓰게 해서 폴백 판단을 한 곳으로 모음, `mermaidThemeOf`가 이걸 가져와 씀 — 이제 미인식 이름이면 앱 전체와 mermaid가 항상 같은 방향(다크)으로 폴백.

**재질문(사용자): `customCss`로 배색을 바꾼 경우 mermaid 라이트/다크를 별도로 지정할 수 있어야 하지 않나?** 맞는 지적이었음 — `mermaidThemeOf`는 `theme` 값만 보고 자동으로 고르는데, `customCss`(`<style id="lm-custom">`)는 우리 CSS 변수/셀렉터만 덮어쓸 뿐 `theme` 필드 자체는 안 바뀌어서, `customCss`로 실제 배색을 뒤집어도 `mermaidThemeOf`는 알 방법이 없었음(mermaid는 `render()` 시점에 SVG 내부 색을 직접 구워서 반환하므로 `customCss`가 사후에 mermaid 색을 덮어쓸 수도 없어 — 자동 감지가 유일한 경로였음). 그래서 자동 감지를 대체할 명시적 설정을 신설: **`CONFIG_SPEC.md`에 `mermaidTheme` 필드 추가**(`"auto"`(기본값)/`"light"`/`"dark"`) — `"light"`/`"dark"`는 `theme` 값과 무관하게 mermaid 선택을 강제하고, 그 외(`"auto"`, 미설정, 오타)는 기존 `theme` 기반 자동 감지를 그대로 유지. `mermaidThemeOf(appTheme, mermaidThemeSetting)`으로 파라미터 추가, `renderMermaid`/`RenderOptions`/`main.ts`의 `loadFile()`까지 값을 그대로 흘려보냄. `frontend/src/types/config.ts`(`DEFAULT_CONFIG`)/`backend/src/config.rs`(`Config::default()`)/`docs/CONFIG_SPEC.md` 세 곳 동시 수정(항상 값 일치 규칙). `mermaidThemeOf`/`isLightTheme` 둘 다 순수 함수라 Vitest로 테스트(`mermaid.test.ts` 6개 분기: auto 3개 + 명시적 강제 2개 + 미인식 설정값이 auto와 동일 처리 1개, `theme.test.ts` 기존 케이스로 `isLightTheme` 커버).

## M5 구현 상세

### 의존성 승인 (Open Questions #2 해결)
`axum`(대체 불가, 그대로 승인), `dirs`(사용자에게 직접 구현 대안과 함께 물어봐서 크레이트 사용으로 확정 — `dirs::config_dir()`이 `CONFIG_SPEC.md`의 3개 OS 경로와 정확히 일치).

### 워크스페이스/크레이트 구조
- 루트 `Cargo.toml`: `members = ["backend"]`만(src-tauri는 M6에서 추가).
- `backend/Cargo.toml`: `axum`/`tokio`/`futures-core`가 전부 `optional = true` + `dev-server` feature로만 켜짐. `cargo build -p backend`(기본, feature 없이)로 이 세 개가 전혀 컴파일 안 되는 것 확인 — Tauri 릴리스 빌드가 이 lib에 의존해도 async 런타임을 안 끌고 온다는 뜻.
- `backend/src/{file,watcher,config}.rs` + `bin/devserver.rs`(`required-features = ["dev-server"]`).

### `watcher.rs`: 자체 구현 디바운스
별도 디바운서 크레이트 없이 `std::thread` + `mpsc::channel`로 직접: 관련 이벤트가 오면 100ms 동안 추가 이벤트가 없을 때까지 계속 기다렸다가(`recv_timeout` 루프) 한 번만 콜백. 파일이 아니라 **부모 디렉토리를 감시**하고 `event.paths`에 정확한 대상 경로가 있는지로 필터링(에디터 write-replace 저장 패턴 대응). 통합 테스트로 "빠른 연속 쓰기 3번 → 콜백 1번" 확인, 3회 반복해서 flaky 여부 체크(안정적).

### 버그 수정(사용자 리포트): 파일을 열기만 해도 화면이 계속 깜빡임
원인: `event_affects()`가 경로만 확인하고 `event.kind`를 안 봤음 — `notify`의 `EventKind::Access`(파일/핸들 open/read/close, 내용 변경 없음)도 경로만 맞으면 그대로 콜백을 호출했다. 에디터가 파일을 **열기만** 해도(수정 안 해도) OS가 access 이벤트를 내고, 열려 있는 동안 계속 날 수도 있어서 "계속 깜빡이는" 증상으로 나타남. 수정: `event.kind.is_create() || event.kind.is_modify()`를 같이 확인해서 access 이벤트 무시. 합성 `Event`로 단위 테스트 추가 + 실제로 `cat`/`vim -c :q`(읽기만)로는 SSE 이벤트 안 오고 실제 수정(`echo >>`) 시에만 오는 것 재현 확인.

### `config.rs`
`#[serde(rename_all = "camelCase", default)]`를 구조체 전체에 붙여서 부분 JSON을 필드별 어노테이션 없이 처리(누락된 필드는 `Config::default()`에서 채워짐). `reset_config()`은 기존 파일을 `config.json.bak`로 복사(덮어쓰기, 히스토리 아님) 후 기본값 저장 — 실제로 실행해서 백업/복원 확인(테스트 후 `~/.config/LightMark`는 삭제해서 실제 환경 원복함).

### `bin/devserver.rs`
- `tower-http` 없이 `middleware::from_fn`으로 CORS 헤더 직접 처리(`Access-Control-Allow-Origin: http://localhost:5173` 고정) — 프론트 요청이 전부 커스텀 헤더 없는 "simple request"라 preflight 처리 불필요.
- `/api/events?path=` — `docs/IPC_SPEC.md` 표에 없던 세부사항(쿼리 파라미터)을 구현하며 채움.
- **"연결 종료 = unwatch"의 구현 방식**: `WatchStream` 구조체가 `mpsc::Receiver`와 `FileWatcher`를 같이 소유. 클라이언트가 끊으면 axum이 이 스트림을 drop → `FileWatcher`도 같이 drop되어 `notify` watcher가 실제로 멈춤. 별도 unwatch 로직 없이 Rust ownership으로 자연히 해결됨. `curl`로 SSE 연결 후 강제 종료해도 서버가 안 죽는 것으로 확인.
- 모든 엔드포인트 `curl`로 직접 테스트: health(200), file(200 정상/404 없음), config get/reload/reset(+백업), SSE(느린 연속 쓰기 2번 → "changed" 이벤트 정확히 2번, 디바운스 정상 동작).

### 프론트엔드 어댑터
- **`platform/dev.ts`(신규)**: `IPC_SPEC.md` Dev Server 표에 `open_file` 행이 없다는 걸 근거로 `openFile()`은 미지원 처리 — 실제 파일은 `readFile(path)`로 열고, 그 경로는 main.ts가 `?file=` URL 쿼리 파라미터로 받음(브라우저엔 네이티브 열기 다이얼로그가 없어서). `openConfigFolder`/`openConfigFile`도 표대로 미지원.
- **`createBackend()`가 비동기로 바뀜**: 헬스체크(`GET /api/health`, 300ms 타임아웃)로 Dev 모드 판별이 본질적으로 비동기라 `platform/backend.ts`의 팩토리를 `Promise<BackendApi>`로, `main.ts` 최상단에서 top-level `await`로 받음(`tsconfig` target ES2022라 바로 동작). Tauri 분기는 M6에서 추가, 지금은 Dev/Web만.
- **Live reload 스크롤 앵커**: `lm-viewer.ts`에 `getActiveId()`/`scrollToHeading(id)` 공개 메서드 추가. `main.ts`의 `reloadFile()`이 재렌더 전 활성 heading을 저장했다가 재렌더 후 그 heading으로 되돌림.
- 헤드리스 Chrome으로는 `createBackend()`가 Dev 모드를 정확히 감지하는 것(`{watch:true, configFile:false}`)까지만 콘솔 로그로 확인했고, `?file=` → 렌더까지의 전체 파이프라인 최종 DOM은 헤드리스 `--dump-dom`의 타이밍 한계로 캡처 못 했었음 — **이후 사용자가 실제 브라우저로 직접 열어서 정상 동작 확인함**(watcher의 access-event 버그를 리포트/재확인하는 과정에서 자연히 `?file=` 플로우 전체가 검증됨).

### 버그 수정(사용자 리포트, M6 Reload Config 배선 이후): config.json을 바꾼 뒤 Reload Config를 눌러도 반영이 안 됨(재시작해야만 반영)
사용자가 `mermaidTheme`을 바꾸고 물어봄: "한계인가?" — 조사해보니 한계가 아니라 배선이 빠진 것이었음. `main.ts`의 `lm-reload-config`/`lm-reset-config` 핸들러는 `currentConfig` 갱신 + `applyTheme(config)` 호출까지만 함. `applyTheme`은 CSS 변수/`.lm-print-light` 클래스/`customCss`만 갱신하는 함수라 색상/폰트/zoom/printUseLightTheme 같은 건 실시간 반영되지만, mermaid/Shiki처럼 **렌더링 시점에 결과를 SVG/DOM에 직접 구워 넣는(bake)** 값(`mermaidTheme`, `mermaid`/`katex`/`syntaxHighlight` on-off, `theme`이 Shiki 코드 색에 주는 영향)은 `enhance()`가 다시 실행돼야만 바뀌는데, `enhance()`는 `loadFile()`이 호출될 때만 실행되고 Reload/Reset Config는 `loadFile()`을 아예 안 부름 — 그래서 이미 열려 있는 문서는 그대로 남고, 앱을 재시작(= 파일을 다시 열게 됨)해야 우연히 반영되는 것처럼 보였을 뿐이었음.

수정: `main.ts`에 현재 열려 있는 문서의 원본 내용을 저장하는 `currentDoc`(`loadFile()`이 호출될 때마다 갱신)을 추가하고, 문서가 열려 있으면 그걸로 `reloadFile()`(live reload가 이미 쓰던, 읽던 위치를 보존하며 재렌더하는 함수)을 재사용하는 `rerenderCurrentDocument()`를 신설 — Reload/Reset Config 핸들러 양쪽에서 `applyTheme()` 다음에 호출. 문서가 안 열려 있으면 `currentDoc`이 `null`이라 아무 일도 안 함. 새 테스트 파일은 없음(`main.ts`는 원래부터 core/lazy 같은 순수 로직 파일이 아니라 DOM 와이어링 레이어라 단위 테스트 대상이 아님 — 기존 설계 그대로).

### M3 Zoom 버튼 배선 — 정정
M3 절에 "M5에서 Config System 붙으면 같이 처리한다"고 적어뒀었는데, M5에서도 배선 안 함 — Config **쓰기**(config.json 저장) 커맨드 자체가 없어서(`CLAUDE.md` "No graphical settings editor" 규칙, `read`/`reload`/`reset`만 존재) 아직 의미가 없음. `docs/PLAN.md`에 이 정정 반영해둠.

## M6 구현 상세

### 시스템 패키지 (Ubuntu 24.04 기준, 실제 설치/확인함)
```bash
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config
```
AppImage용 `patchelf`/`libfuse2t64`는 **설치 안 함** — 사용자가 패키징은 별도로 진행하기로 함. Ubuntu 24.04는 64비트 time_t 전환으로 패키지명이 `libfuse2`가 아니라 `libfuse2t64`인 것도 확인해둠(일반 Tauri/AppImage 가이드가 `libfuse2`라고 안내하는 것과 다름 — 그대로 따라하면 설치가 안 됨).

### 프로젝트 구조
- **루트 `package.json` 신설**: `@tauri-apps/cli`만 devDependency, `"tauri": "tauri"` 스크립트 하나. `frontend/package.json`은 안 건드림(Browser Development First 유지).
- **`src-tauri/`는 `npx tauri init --ci`로 스캐폴딩** — 아이콘까지 자동 생성됨. `identifier`(`dev.lightmark.viewer`)와 창 크기(1000x700)만 수동 수정.
- **루트 `Cargo.toml`**: `members = ["backend", "src-tauri"]`로 확장.
- **`src-tauri/src/cli.rs`(신규)**: CLI 인자에서 파일 경로를 뽑는 순수 함수 `extract_path_arg(args, cwd)` — `backend/src/watcher.rs`의 `event_affects`와 같은 패턴(Tauri 앱 없이 단위 테스트 가능, 4개 테스트).

### 9개 IPC 커맨드 (`src-tauri/src/lib.rs`, 전부 `backend::*` 위임, 로직 없음)
- `read_file`/`read_config`/`reload_config`/`reset_config`: `backend::*` 1줄 호출.
- `watch_file`/`unwatch_file`: `HashMap<String, backend::FileWatcher>`를 **경로로 키잉**(`IPC_SPEC.md`가 이미 경로 기반 시그니처였고, LightMark는 문서 하나만 보므로 별도 id 불필요 — 같은 경로 재감시는 이전 `FileWatcher`가 drop되면서 자연히 정리됨).
- `open_file`/`open_config_folder`/`open_config_file`: 유일하게 로직이 있는 예외 — `tauri-plugin-dialog`(네이티브 파일 선택)와 `tauri-plugin-opener`(폴더/파일을 OS 기본 앱으로 열기) 사용. `PLAN.md`가 이미 "dialog/opener 권한"이라고 명시해둔 부분이라 새 승인 없이 사용.
- **`get_initial_path`(신규, IPC_SPEC.md의 9개 밖)**: Dev 모드의 `?file=` 쿼리 파라미터와 같은 역할 — CLI 인자/파일 연결로 실행된 경로를 프론트가 시작 시 1회 pull(레이스 회피). 두 번째 실행은 `tauri-plugin-single-instance`가 `open-path` 이벤트로 push(이미 실행 중이라 레이스 없음).
- **macOS `RunEvent::Opened`(파일 연결/dock 드롭)는 구현했지만 미검증** — 이 세션은 Linux라 실제 macOS 컴파일/동작 확인 못 함(`#[cfg(target_os = "macos")]`로 감싸서 Linux/Windows 빌드엔 전혀 안 포함됨). macOS 릴리스 전 실기 확인 필수.

### 프론트엔드
- **`platform/tauri.ts`(신규)**: `@tauri-apps/api`의 `invoke`/`listen`으로 `BackendApi` 구현. `capabilities: {watch:true, configFile:true}` — Tauri가 이 두 값이 모두 `true`인 첫 backend.
- **`BackendApi`에 선택적(optional) 메서드 2개 추가**: `getInitialPath?()`/`onOpenPath?()` — Web/Dev는 구현 안 함(계약 자체는 안 바뀜, 타입 확장만).
- **`createBackend()` 판별 순서**: Tauri(`window.isTauri`) → Dev(헬스체크) → Web. Tauri를 제일 먼저 확인하는 이유: `tauri dev`도 내부적으로 Vite dev 서버를 쓰기 때문에 `import.meta.env.DEV`가 똑같이 true라, 옆에서 devserver가 우연히 떠 있으면 Dev로 잘못 판별될 수 있음.
- **`platform/tauri.ts` import는 동적(`await import('./tauri')`)** — Web/Dev 빌드에 `@tauri-apps/api`가 아예 안 들어감. 빌드 결과로 확인: 메인 청크(~128KB)엔 Tauri 관련 코드 없고, 별도 4KB `tauri-*.js` 청크로 완전히 분리됨.
- **`lm-toolbar.ts`**: Print 버튼 배선(`window.print()` — M6 검증 문구에 "인쇄" 단계가 있어서). `capabilities.configFile`이 true일 때 Config Folder/Config File/Reload Config/Reset Config 4개 버튼 전부 노출(그동안 `CLAUDE.md`가 요구한 이 4개 기능의 UI 진입점이 하나도 없었음 — Tauri가 처음으로 `configFile:true`를 주면서 드러난 부분). TOC Toggle/Zoom/About은 M6 범위 밖이라 그대로 `disabled`.
- **`main.ts`**: `lm-open` 핸들러가 이제 dialog로 연 파일도 `watchPath()` 호출(Web/Dev는 `capabilities.watch`가 false라 그냥 no-op). Print/Config 4개 버튼의 이벤트 리스너 추가. Tauri의 `getInitialPath?()`/`onOpenPath?()` pull/push 로직 추가.
- **개선(사용자 요청): 문서 열기 전엔 Print 버튼 비활성화** — `lm-toolbar`에 `hasDocument` 상태 추가, `loadFile()`에서 `setHasDocument(true)` 호출(문서 닫는 기능이 없어서 다시 false가 될 일은 없음).
- **버그 수정(사용자 리포트): PDF로 인쇄하면 화면에 보이던 한 화면 분량만 나옴** → `#app`/`.lm-content`/`lm-viewer`가 전부 화면용 고정 높이+overflow 제약(스크롤 가능한 패널을 만들기 위한 것)인데 `@media print`가 이걸 안 풀어줘서 인쇄도 "한 뷰포트 분량"만 렌더링됨 → `@media print`에서 `#app`을 `height: auto`, `.lm-content`/`.lm-viewer-pane`/`lm-viewer`를 `overflow: visible`(+`lm-viewer`는 `height: auto`)로 재정의해서 전체 문서가 여러 페이지에 자연스럽게 흐르도록 수정. `.lm-content`의 그리드 컬럼도 TOC 숨김에 맞춰 1열로 좁힘.

### 검증
- `cargo build/test/fmt/clippy -p app`(워크스페이스 전체 포함) 전부 통과. 프론트 lint/typecheck/build/test 전부 통과(22 tests, 변화 없음).
- **`npm run tauri dev`를 실제로 백그라운드로 띄워서 확인**: 이 세션이 실제 GUI 있는 X/Wayland 데스크톱 환경이라 프로세스가 25초+ 크래시 없이 떠 있는 것까지 확인함. 다만 xdotool/wmctrl/스크린샷 도구가 없어서 **창 내용이 실제로 렌더링되는지, Open 다이얼로그가 뜨는지 등은 시각적으로 확인 못 함** — 사용자가 직접 열어서 최종 확인 필요.
- `npm run tauri build`(전체 번들링)는 patchelf/libfuse2t64 미설치로 이번엔 실행 안 함 — 사용자가 그 패키지들 설치 후 별도로 진행.

### 버그 수정(사용자 리포트, M6 완료 보고 후): Open 버튼 누르면 앱이 멈춤
`open_file`이 일반 `fn`이었던 게 원인 — Tauri는 `async fn`으로 선언하지 않은 커맨드를 **IPC 처리 스레드에서 그대로** 실행한다(별도 스레드로 안 옮김 — `tauri-macros`의 기본 `ExecutionContext::Blocking`이 딱 이 뜻, 이름과 반대로 헷갈리기 쉬움). Linux에서 그 스레드는 GTK 메인 루프 스레드라, `blocking_pick_file()`이 다이얼로그 응답을 기다리는 동안 다이얼로그를 그릴 메인 루프 자체가 멈춰서 데드락. 수정: `open_file`을 `async fn`으로만 바꿈(본문 그대로, `.await` 불필요 — 선언만으로 Tauri가 백그라운드 워커 스레드로 옮겨줌). `open_config_folder`/`open_config_file`도 의심했지만 `tauri-plugin-opener`가 `open::that_detached`(프로세스 완전 분리, 대기 안 함)를 쓰는 걸 소스로 확인해서 그대로 둠.

### 버그 수정(사용자 리포트, 2단계): Tauri에서 drag&drop으로 파일 열기가 안 됨
- **1차 시도 — 틀렸음, 되돌림**: `tauri.conf.json`에 `"dragDropEnabled": false`를 추가했었다. `@tauri-apps/cli` 스키마의 "Disabling it is required to use HTML5 drag and drop"라는 문구를 보고 한 결정이었는데, 그 문구는 **"on Windows"**로 한정된 얘기였다. Linux(WebKitGTK)에서 이 옵션을 끄면 Tauri의 가로채기가 없어지면서 **WebKitGTK 자체의 기본 동작**(드롭된 파일로 페이지 전체가 네비게이션되어 렌더링 안 된 raw text로 덮임)이 대신 발동한다 — 그래서 재현 결과가 "`lm-toc`에 드롭하면 전체 화면이 raw text로 바뀌고, `lm-viewer`에 드롭하면(여기는 `preventDefault`가 있어서 네비게이션은 막히지만) `dataTransfer.files`에 애초에 읽을 파일이 안 실려서 아무 일도 안 일어남"이었다.
- **2차 시도 — 확정**: `dragDropEnabled`는 기본값(`true`)으로 원복. 대신 `platform/tauri.ts`의 `onOpenPath(cb)`에 `getCurrentWebview().onDragDropEvent()`(`@tauri-apps/api/webview`) 리스너를 추가 — `type: 'drop'` 이벤트가 오면 Rust가 읽어준 실제 파일 경로(`paths[0]`)로 `cb()`를 호출. CLI 인자/파일 연결로 열 때 이미 쓰던 것과 정확히 같은 경로(`main.ts`의 `backend.onOpenPath?.((path) => openPath(path))`)를 재사용하는 것이라 `lm-viewer.ts`/`main.ts`는 전혀 안 건드림. `dragDropEnabled`가 다시 `true`라 OS 드롭이 DOM에 도달하기 전에 Tauri가 항상 가로채므로 `lm-viewer.ts`의 기존 DOM 드롭 처리와 경쟁하지 않음(Tauri에서는 그냥 안 쓰이는 코드가 되고, Web/Dev에서는 그대로 유일한 경로).

### 개선(사용자 요청): Open 다이얼로그가 마지막으로 연 디렉터리를 기억
Tauri 전용(Web은 `<input type=file>`이 브라우저 보안상 시작 디렉터리 지정 불가, Dev는 다이얼로그 자체가 없음) — `src-tauri/src/lib.rs`의 `open_file`에서만 처리.
- **`config.json`이 아닌 별도 `state.json`으로 분리**: `CLAUDE.md`의 "No graphical settings editor"는 문서화된, 사람이 직접 편집하는 `config.json`(`CONFIG_SPEC.md`) 얘기고, 앱이 스스로 기억하는 이런 내부 편의 상태까지 금지하는 취지는 아니라고 판단해서 파일을 분리 — `config.json`은 계속 "사람이 손으로 편집하는 파일"로만 유지.
- **`backend/src/state.rs`(신규)**: `AppState { last_opened_dir: Option<PathBuf> }`를 `backend::config_dir()`와 같은 디렉터리의 `state.json`에 저장. `config.rs`의 `load_config()`처럼 읽기 실패 시 그냥 빈 상태로 넘어감(이 파일이 없거나 깨져도 앱이 안 죽음). 결정 로직은 순수 함수 `resolve_initial_dir(remembered, exists_fn, home)`로 분리(`watcher.rs`의 `event_affects`와 같은 패턴, 단위 테스트 가능) — "기억된 디렉터리가 있고 지금도 존재하면 그걸, 아니면(기억 없음 또는 삭제됨) 홈 디렉터리"를 반환. 홈 디렉터리는 이미 승인된 `dirs` 크레이트의 `dirs::home_dir()` 재사용(새 의존성 없음).
- **`open_file`**: 다이얼로그를 만들 때 `backend::initial_open_dir()`이 있으면 `FileDialogBuilder::set_directory()`로 지정. 파일을 성공적으로 고르면 그 부모 디렉터리를 `backend::save_last_opened_dir()`로 최선 노력 저장(쓰기 실패해도 파일 열기 자체는 실패시키지 않음).
- 검증: `backend/src/state.rs`에 `resolve_initial_dir`의 3가지 분기(기억된 디렉터리 존재/삭제됨/기억 없음)와 `AppState` serde round-trip 테스트 5개 추가. `cargo fmt/clippy/test --workspace` 전부 통과. 프론트 변경 없음(전부 `open_file` 커맨드 내부 로직이라) — lint/typecheck/build/test(22개, 변화 없음) 재확인만.

## 표준 작업 규칙 (이번 세션에서 재확인됨)
- **git commit은 사용자가 직접 함.** 명시적으로 요청받지 않으면 절대 커밋하지 말 것.
- 코드 변경 후 검증: 프론트 `npm run lint && npm run typecheck && npm run build && npm run test`, 백엔드 `cargo fmt --check && cargo clippy --workspace --all-features && cargo test --workspace`.
- `docs/PLAN.md`의 Open Questions 전부 해결됨(M2 raw HTML, M5 axum/dirs, M6 이미지 상대 경로).
- 테스트하면서 실제 `~/.config/LightMark`에 파일이 생겼던 것 삭제해서 원복함 — devserver/Tauri 앱을 다시 띄워서 수동 테스트할 때 이 디렉토리가 다시 생기는 건 정상.

## M6 검증 상태
사용자가 실제 Tauri 앱에서 전부 직접 확인 완료: live reload, Config 4개 버튼, Open 다이얼로그 마지막 위치 기억, CLI 인자로 파일 열기(`npm run tauri dev -- -- <path>`), single-instance 라우팅(두 번째 실행/다른 .md 파일 열기가 기존 창으로 라우팅+포커스). M6은 더 이상 미확인 항목 없음.

## 결정됨 (재검토 요청 없으면 이대로): md 파일 내 상대 경로 이미지 링크
md 파일 위치 기준으로 resolve하는 게 의미상 맞지만(Web은 브라우저 File API 보안상 원천적으로 불가능, Dev/Tauri는 고칠 수 있음), **사용자가 지금 상태(모드별로 깨져 있는 현재 동작) 그대로 유지하기로 결정** — 수정하지 않음. `docs/PLAN.md` Open Questions #3 참고.

## 다음에 할 일 (사용자 지정 대기)
- **M7(신규, 아직 미착수)**: TOC Toggle / Zoom / About 버튼 — M1부터 계속 `disabled`로 미뤄오던 것들. 사용자가 "파일을 열어도 활성화 안 됨"이라고 리포트해서(버그가 아니라 원래 미구현 상태였다고 설명함), 세 개 다 새 마일스톤으로 분리해서 진행하기로 확정. 범위/설계는 `docs/PLAN.md` M7 절 참고(TOC Toggle/Zoom 둘 다 config.json에는 안 쓰고 세션 동안만 유지, About은 플랫폼 API 없이 인페이지 표시).
- **M8(신규, 아직 미착수, M6에서 분리)**: 패키징/배포. 원래 M6에 같이 있었는데, "통합은 끝났고 배포는 성격이 다르니 마지막 마일스톤으로 분리"하자는 사용자 요청으로 M6과 분리 확정. `patchelf`/`libfuse2t64` 설치 후 `npm run tauri build`로 AppImage 등 패키징(필요하면 `tauri.conf.json`의 `bundle.targets`로 범위 조정), 릴리스 빌드로 시작 시간/메모리 실측, macOS `RunEvent::Opened` 실기 검증까지 포함.
- M7과 M8 중 어느 걸 먼저 할지는 아직 사용자 지정 안 됨.
