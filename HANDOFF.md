# HANDOFF

작업 이어가기용 현재 상태 요약. (2026-08-13 기준)

**환경: 다음 세션부터 다시 Ubuntu(Linux)에서 진행.** 이번 macOS 세션에서 고친 것들(watcher `canonicalize()`, `core:webview:allow-print` 권한, `@media screen` 오버스크롤 차단, viewer/TOC word-wrap)은 전부 Linux에서도 무해하거나 아예 관찰되지 않는 종류(권한 추가/CSS 표준 속성/canonicalize는 이미 정규 경로인 리눅스에서 그대로 반환)라 **되돌릴 것 없음** — 코드 그대로 가져가도 됨. 반대로 macOS 전용이라 Ubuntu에서는 검증 자체가 불가능한 것: `RunEvent::Opened`(다음에 할 일 참고, 오히려 다음에 macOS로 다시 돌아왔을 때 마무리), 멀티 윈도우 조사 중 나온 "macOS Dock 아이콘 재실행(`RunEvent::Reopen`)" 관련 질문(리눅스엔 직접 대응하는 개념이 없음 — 재개 시 플랫폼별로 갈릴 수 있는 부분으로 기억해둘 것). 나머지(Rust `watcher.rs`/`WatcherRegistry`/`config.rs` 등 멀티 윈도우 조사에서 나온 코드 위치들)는 순수 Rust/아키텍처 문제라 Ubuntu에서도 그대로 이어서 작업 가능.

## 진행 상황

- **M1 (Bootstrap)**: 완료. Vite+TS+Web Components 골격, ESLint/Prettier(Tauri import 격리 규칙 포함), Vitest 셋업.
- **M2 (Markdown Renderer / TOC Engine / Breadcrumb Engine)**: 완료. 아래 "M2 구현 상세" 참고.
- **M3 (Theme Engine / Custom CSS / Font Loader)**: 완료. 아래 "M3 구현 상세" 참고.
- **M4 (Mermaid / KaTeX / Shiki 지연 로딩)**: 완료. 아래 "M4 구현 상세" 참고.
- **M5 (Rust 백엔드 + Dev 서버 + 어댑터)**: 완료. 아래 "M5 구현 상세" 참고.
- **M6 (Tauri 통합)**: **완료, 전체 검증 완료**(+사용자 리포트로 버그 2건 수정: Open 버튼 데드락, Tauri drag&drop). 아래 "M6 구현 상세" 참고. Packaging/Release는 원래 M6에 있었으나 **M8로 분리**(사용자 요청 — 통합과 배포는 성격이 달라서, 배포는 맨 마지막 마일스톤으로). 사용자가 실제 Tauri 앱에서 직접 확인 완료: live reload, Config 4개 버튼(Config Folder/File 열기, Reload/Reset Config), Open 다이얼로그 마지막 위치 기억, CLI 인자로 파일 열기, single-instance 라우팅. **macOS 전환 세션에서 Print 버튼도 실기로 문제 발견/수정/재확인 완료**(아래 "macOS 전환 세션" 참고). `RunEvent::Opened`(dock 드롭/파일 연결)도 이후 사용자가 실기로 확인 완료 — M6은 이제 미확인 항목 전혀 없음.
- **M7 (TOC Toggle / Zoom / About)**: **전부 구현 완료, 전부 사용자 실사용 확인 완료.** TOC Toggle/About은 각각 클릭/오픈해서 확인됨(About은 Close 버튼 제거 이후 최종 상태까지 재확인, "about 관련해서는 모두 확인했어"). 버튼 디자인 전면 개편, 라벨 한 단어화, Config File/Reset Config 기능 삭제(+Reload가 자기 치유), `Reload Config`→`Apply` 라벨, 툴바 높이 축소도 전부 확인됨("좋아. 모두 좋아."/"ok. 모두 좋아.").
  - **Zoom**: 여러 차례 재설계를 거쳐 최종 정착 — (1) `font-size` 확대 대신 브라우저 실제 화면 줌과 같은 CSS `zoom` 속성으로 전환(하위 트리 전체가 한 번에 스케일), (2) 중앙 버튼이 하드코딩된 `100%`가 아니라 `defaultZoom`(config.json `zoom` 기반)을 표시/리셋, (3) Apply가 세션 중 조절한 zoom을 config 값으로 덮어쓰던 버그 수정(세션 zoom은 유지, `defaultZoom`만 config를 따라감). 그 과정에서 나온 task-list 체크박스 zoom 미반영 버그도 수정·확인됨. **최종 동작까지 사용자가 실기로 확인함**("1, 2, 3 모두 확인 완료했어" — 아래 뷰어 폭 제한/경고 상자와 함께).
  - **뷰어 폭 제한(`viewerMaxWidth`)**: `.lm-markdown`의 `max-width`를 완전히 제거(기본은 뷰어 폭 전체 사용, 좌/우 `margin: 1rem`)하고, config 필드 `viewerMaxWidth`(number, px, 기본값 `0`=제한 없음)를 config.json에서만 편집, `lm-statusbar`(파일명 오른쪽)는 `Width: Full`/`Width: {값}px`로 읽기 전용 표시만 하는 방식으로 정착(중간에 고정 860px → `min(860px, 90vw)` → boolean 토글 → 입력창을 거쳐옴). 값을 바꾸면 그 px로 제한되고 좌우 auto margin으로 가운데 정렬(큰 값을 넣어도 여백이 0으로 찌그러지지 않도록 `calc(100% - 2rem)` 캡 처리됨). **사용자가 실기로 확인함.**
  - **경고 상자 디자인 통일**: mermaid/KaTeX(inline+block)/image 렌더링 실패 시 뜨는 빨간 경고 상자가 서로 다른 padding을 쓰던 것을 mermaid 기준으로 통일. **사용자가 실기로 확인함.**
  - 아래 "M7 구현 상세"/"macOS 전환 세션 구현 상세" 참고.
- **M8 (패키징 및 배포)**: 신규 마일스톤(M6에서 분리). 다시 Ubuntu로 돌아와서 원래 Linux 전제(AppImage/`patchelf`/`libfuse2t64`) 계획이 다시 유효함. **앱 아이콘은 완료**(사용자가 `npm run tauri icon`으로 생성한 아이콘 세트 적용, `bundle.icon` 순서 개선, `enableGTKAppId` 활성화 — 아래 "앱 아이콘" 참고, dock 아이콘 표시만 패키징 이후 재검토로 보류). AppImage 등 실제 패키징, 릴리스 빌드 성능 실측(<1s, <30MB)은 아직 미착수.
- **macOS 전환 세션 (2026-08-12)**: 개발 환경을 Ubuntu에서 macOS로 이전. 빌드/테스트 자체는 시스템 패키지 설치 없이 전부 통과했지만, 그 과정에서 macOS 전용 버그 3건(watcher의 FSEvents 경로 불일치, Print 버튼의 Tauri ACL 권한 누락, 문서 끝 스크롤 시 트랙패드 러버밴드로 툴바/상태바가 밀림)을 발견/수정하고 사용자가 Print·러버밴드는 실기로 재확인함. 그 외 사용자 요청으로 config 자기 치유 범위 확장, 구현 안 된 채로 스키마에만 남아있던 config 필드 2개(`autoReload`, `breadcrumbVisible`) 삭제, 상태바 레이아웃 조정, Apply 버튼 no-op 최적화, viewer/TOC 가로 스크롤 방지(word-wrap)까지 진행. 아래 "macOS 전환 세션 구현 상세" 참고.

**현재(2026-08-13, Ubuntu 세션 진행 중)**: M7 전부 완료+확인, 인쇄 페이지 잘림 버그는 원인 확정 후 "알려진 한계로 받아들이기"로 종결, `RunEvent::Opened`도 사용자 확인 완료, 앱 아이콘도 적용 완료(dock 표시만 패키징 이후로 보류). **멀티 윈도우/인스턴스 지원 구현 완료 + `npm run tauri dev` 실기 검증까지 완료**(조사 → 설계 결정 4건 → 실제 구현 → 실기 검증, 아래 "멀티 윈도우/인스턴스 지원 → 구현 완료"/"실기 검증" 참고). 검증 중 발견된 설계 범위 이탈(`PristineWindow` 재사용이 결정 #2를 어기고 Linux/Windows 재실행에도 적용되던 문제)은 자율 루프 중 macOS 전용으로 스코프를 좁혀 결정 #2에 맞게 수정, 재검증까지 완료(위 "후속 조치" 참고) — **사용자가 원래대로(일반 재사용) 되돌리길 원하면 알려달라는 요청만 남음**, 그 외엔 막힌 것 없음. **전체 문서 대조 후 TOC Resizable(CLAUDE.md 요구사항인데 미구현 상태였던 것)도 발견 → 구현 → 부수 버그 2건(가로 스크롤바, 스크롤 있을 때 resize 안 됨) 수정까지 사용자 확인 완료.** 남은 건 **M8(패키징)** — 아래 "다음에 할 일" 참고.

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

### Breadcrumb 버그(사용자 리포트, M7 이후 수정됨): 최상단 스크롤 후에도 빈 토스트가 잔류
문서 최상단으로 빠르게 스크롤해서 활성 heading이 없어지면(`setActive(null)`) breadcrumb는 즉시 사라져야 하는데, 실제로는 **이전 heading 활성화 때 걸어둔 `hideTimer`가 그대로 살아있어서** 그 타이머가 끝날 때까지 내용 없는 빈 영역만 계속 보이다가 사라졌음. 원인: `setActive(id)`가 `id`가 있을 때만 `show()`(클래스 추가 + 타이머 재예약)를 호출했고, `id`가 없을 때는 `render()`(내용만 빈 크럼으로 교체)만 하고 끝 — 클래스/타이머는 그대로 방치. 수정: `lm-breadcrumb.ts`에 `hide()`(타이머 즉시 취소 + `lm-breadcrumb-visible` 클래스 즉시 제거)를 신설, `setActive(id)`가 `id`가 falsy면 `hide()`를 호출하도록 함.

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

### 버그 수정(사용자 리포트, M7 이후): mermaid/KaTeX/image 경고 상자 디자인이 서로 다름
"latex, mermaid, image 등이 정상 렌더링되지 못할 때 표시되는 붉은색 상자 디자인이 달라. mermaid의 경우에는 상자 내 약간의 padding이 있는데, latex(inline과 full 모두), image는 padding이 없어. 모두 mermaid와 동일한 디자인으로 변경해줘." — `.lm-render-warning`(mermaid, 항상 독립된 `<p>`)은 `padding: 0.5rem 0.75rem`이 있었는데, `.lm-render-warning-inline`(KaTeX inline/block 수식, 깨진 이미지 - 전부 `<span>`, 일부는 본문 안에 중첩)은 `padding: 0 0.15em`으로 사실상 여백이 없었음 — 원래부터 두 클래스가 별개로 존재했던 이유(인라인 중첩 제약, M4 참고)와 무관하게 시각적 디자인 값 자체가 처음부터 달랐던 것.

수정: `layout.css`에서 `padding`/`border`/`border-radius`/`background`/`color`/`font-size`를 `.lm-render-warning, .lm-render-warning-inline` 공유 셀렉터로 합침(둘 다 완전히 같은 값) — `margin`만 `.lm-render-warning` 전용으로 분리 유지(인라인 요소에는 상하 margin이 의미가 없어서 원래부터 있을 필요가 없었음). 엘리먼트 자체(어디는 `<p>`, 어디는 `<span>`)는 그대로 - 이건 인라인 중첩 안전성 때문이지 디자인과는 무관.

검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.

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
- **macOS `RunEvent::Opened`(파일 연결/dock 드롭)**: 구현 당시(이 세션은 Linux)는 실기 확인 못 함(`#[cfg(target_os = "macos")]`로 감싸서 Linux/Windows 빌드엔 전혀 안 포함됨). **이후 사용자가 실기로 확인 완료**("3은 확인했어. 문제없어.") — 더 이상 미검증 항목 아님.

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

## M7 구현 상세

### TOC Toggle (완료)
- **상태 소유**: `main.ts`가 `tocVisible`(session-only, `let`)로 소유. `readConfig()`가 끝나면 `config.tocVisible`로 초기화(그전엔 `DEFAULT_CONFIG.tocVisible` — 기본값은 이후 `false`로 뒤집힘, 아래 참고). 다른 컴포넌트 상태(예: `hasDocument`, `capabilities`)와 같은 패턴 — 컴포넌트는 자기 상태를 안 갖고 `setXxx()`로 받아서 렌더만 함.
- **토글 배선**: `lm-toolbar`의 TOC Toggle 버튼(더 이상 `disabled` 아님) 클릭 → `lm-toc-toggle` 이벤트 → `main.ts`의 `setTocVisible(!tocVisible)` → `.lm-content` 엘리먼트에 `lm-toc-hidden` 클래스 토글 + `lm-toolbar.setTocVisible()`로 버튼 `aria-pressed` 갱신.
- **CSS**: `layout.css`에 `.lm-content.lm-toc-hidden { grid-template-columns: 1fr; }` + `.lm-content.lm-toc-hidden lm-toc { display: none; }` 추가 — `.lm-content`의 그리드 컬럼(`var(--lm-toc-width) 1fr`)을 명시적으로 `1fr`로 덮어써서 뷰어가 전체 폭을 차지하게 함.
- **config.json에는 쓰지 않음** — `CLAUDE.md`의 "No graphical settings editor" 그대로: `tocVisible`은 시작 상태로만 읽히고, 세션 중 토글은 메모리에만 남는다(앱 재시작하면 config.json의 값으로 돌아감).
- **개선(사용자 요청): 문서를 열기 전엔 버튼 비활성화 + TOC 영역도 숨김.** `main.ts`에 `hasDocument`(session-only, `loadFile()`에서 `true`로 전환, 문서를 닫는 기능이 없어서 되돌아갈 일 없음 — Print 버튼과 같은 관용구) 추가. `updateTocDisplay()`가 `!hasDocument || !tocVisible`로 표시 여부를 계산해서, 문서가 없으면 `tocVisible`(기본값 `true`)과 무관하게 항상 숨김. `lm-toolbar`도 TOC Toggle 버튼에 `${this.hasDocument ? '' : 'disabled'}` 추가(Print 버튼과 동일한 조건 재사용).
- **개선(사용자 요청): 문서를 열기 전 뷰어 안내 문구를 화면 정가운데로, 글자도 크게.** `layout.css`의 `.lm-empty`를 `position: absolute` + `translate(-50%, -50%)`로 전환, 기준은 `.lm-viewer-pane`(이미 `position: relative`) — `lm-viewer` 자신의 padding/스크롤과 무관하게 뷰어 영역 전체 중앙에 옴. `font-size: 1.25rem` 추가.
- **개선(사용자 요청): `tocVisible` 기본값을 `true`→`false`로.** "파일을 열어도 TOC는 기본으로 안 보이고, 토글 버튼을 눌러야만 보이게" — `tocVisible`이 이미 "시작 상태"로 설계돼 있어서(`CONFIG_SPEC.md`), 동작 경로는 그대로 두고 기본값만 뒤집음(config.json에서 `true`로 바꾸면 여전히 시작부터 보이게 할 수 있음). `frontend/src/types/config.ts`/`backend/src/config.rs`/`docs/CONFIG_SPEC.md` 세 곳 동시 수정.
- **검증**: `npm run lint && npm run typecheck && npm run build && npm run test` + `cargo fmt --check && cargo clippy --workspace --all-features && cargo test --workspace` 전부 통과. 브라우저에서 문서를 열기 전엔 버튼이 비활성화되고 TOC 영역이 안 보이며, 문서를 열어도 기본은 계속 안 보이고 버튼을 눌러야만 나타나는 것 확인. **사용자가 실제 앱에서 클릭해보고 정상 동작 확인함**("toc toggle 버튼이 잘 동작하는 건 확인했어").

### About (완료)
- **새 컴포넌트 `lm-about`**(`frontend/src/components/lm-about.ts`): 네이티브 `<dialog>`를 감싸는 얇은 래퍼. `open()`이 `dialogEl.showModal()`을 호출 — 배경 딤(`::backdrop`)/화면 중앙 정렬/Escape로 닫기가 브라우저가 공짜로 처리해줌(직접 구현 안 함). 배경(다이얼로그 박스 바깥) 클릭도 닫히게 처리(클릭 타겟이 `<dialog>` 엘리먼트 자신인 경우로 판별). `index.html`에 `<lm-about>`을 `#app` 그리드 바깥(별도 sibling)에 둬서 그리드 레이아웃에 전혀 영향 없음.
- **버전 소스**: IPC로 백엔드(Tauri/Cargo.toml)에 물어보지 않음 — Web/Dev/Tauri 세 모드 모두 동일한 값을 보여줘야 해서(`docs/PLAN.md` M7: "플랫폼 API에 기대지 않는"), 프론트엔드 자신의 `package.json`을 `tsconfig.json`이 이미 켜둔 `resolveJsonModule`로 직접 import(`core/appInfo.ts`). 앱 이름("LightMark")은 하드코딩 — `package.json`의 `name`은 `lightmark-frontend`(npm 패키지명)라 표시용 이름과 다름.
- **`lm-toolbar`**: About 버튼의 `disabled` 제거, `data-action="about"` → `lm-about` 이벤트로 배선. Print/TOC Toggle과 달리 `hasDocument`로 게이트하지 않음 — 앱 정보 표시는 문서 유무와 무관.
- **CSS**: `.lm-about-dialog`에 테마 변수(`--lm-color-bg/fg/border`)로 테두리/배경 적용. `@media print` 목록에 `lm-about`도 추가(다른 오버레이 엘리먼트와 동일하게 인쇄 시 숨김).
- **검증**: `npm run lint && npm run typecheck && npm run build && npm run test` 전부 통과. 브라우저에서 About 버튼 클릭 시 모달이 뜨고 앱 이름/버전이 보이며, 배경 클릭/Escape로 닫히는 것 확인(Close 버튼은 이후 사용자 요청으로 제거 — 아래 참고). **사용자가 실제 앱에서 열어보고 버그(Close 제거 후 의도치 않은 outline)를 리포트** — 아래 참고. **그 수정(outline 제거 + 다이얼로그 어디를 클릭해도 닫힘) 이후의 최종 상태도 이후 세션에서 사용자가 재확인함**("about 관련해서는 모두 확인했어") — About은 더 이상 미확인 항목 없음.
- **개선(사용자 요청): 이름과 버전 사이에 한 줄 설명 추가.** `core/appInfo.ts`에 `APP_TAGLINE = 'Fast, lightweight, focused Markdown viewer.'` 추가, `lm-about`에서 이름(`h2`)과 버전 사이에 `<p class="lm-about-tagline">`로 표시(`--lm-color-muted`로 톤 다운).
- **개선(사용자 요청): 개발자 표시 추가.** `core/appInfo.ts`에 `APP_AUTHOR = 'Yonghee Yu'` 추가(하드코딩 — `package.json`에 `author` 필드가 없고, `APP_NAME`도 같은 방식으로 이미 하드코딩돼 있어서 일관됨), 버전 아래에 "Developed by {APP_AUTHOR}"로 표시.
- **개선(사용자 요청): 버튼 디자인 전면 개편.** 툴바/About 다이얼로그 버튼이 지금까지 브라우저 기본 스타일 그대로였음("디자인이 너무 별로"라는 리포트). `layout.css`에 `lm-toolbar button, .lm-about-dialog button` 공유 셀렉터로 하나의 flat 스타일 추가 — 테두리 없음, `border-radius: 6px`, hover 시 `--lm-color-border` 배경, `focus-visible` 아웃라인, `disabled` 시 `opacity: 0.4`. TOC Toggle의 `aria-pressed="true"`(눌린 상태)는 accent 배경 + 흰 글자로 별도 강조. `lm-toolbar`도 `display: flex` + `gap: 0.4rem`으로 정돈. 아이콘·그림자는 추가 안 함(`CLAUDE.md`의 "Fast. Lightweight. Focused." 정체성에 맞춰 최대한 단순하게) — 컴포넌트 TS 템플릿은 전혀 안 건드리고 CSS만으로 처리.
- **개선(사용자 요청): 클릭 후 버튼에 포커스가 남지 않도록.** "버튼은 클릭만 가능하고 focus가 남지 않아야" — CSS `:focus-visible`만으로는 부족했음(WebKitGTK 등 일부 엔진은 마우스 클릭도 `:focus-visible`로 잡을 수 있음). `lm-toolbar`의 `dispatchOnClick()`에서 클릭 즉시 `button.blur()` 호출(커스텀 이벤트 디스패치 전) — Open/TOC Toggle/Print/Config 4개/About 전부 이 한 곳에서 공유. About 다이얼로그는 별도 이슈: 네이티브 `<dialog>.close()`가 `showModal()`을 호출했던 엘리먼트(About 버튼)로 포커스를 되돌리는 게 표준 동작이라, `lm-about`의 `close()`에서 `dialogEl.close()` 다음에 `document.activeElement?.blur()`를 추가로 호출해 그 복원된 포커스도 지움. Tab으로 버튼까지 이동했을 때의 `:focus-visible` 링(키보드 접근성)은 그대로 유지 — 실제로 클릭/Enter로 "활성화"한 뒤에만 사라짐.
- **개선(사용자 요청): Close 버튼 제거.** "없는 게 좋겠다"는 피드백 — `lm-about`에서 Close 버튼과 그 클릭 리스너를 삭제, `layout.css`의 `.lm-about-dialog button` 관련 셀렉터들도 같이 정리(더 이상 다이얼로그 안에 버튼이 없어서 죽은 규칙이 됨 — `lm-toolbar button`만 남김). 닫는 방법은 배경 클릭과 Escape(네이티브 `<dialog>` 기본 동작) 두 가지로 유지.
  - **버그(제거로 인한 부작용) + 개선(사용자 요청) 2건**:
    1. **의도치 않은 outline**: Close 버튼(포커스 가능한 자식)이 없어지자 `showModal()`이 `<dialog>` 자신에 포커스를 줘서 브라우저 기본 focus outline이 다이얼로그 테두리에 그려짐. `.lm-about-dialog`에 `outline: none` 추가로 제거(그 안에 실제로 클릭 가능한 인터랙티브 요소가 없으니 outline을 보여줄 이유가 없음).
    2. **"다이얼로그 안/밖 어디를 클릭해도 닫히게, Esc는 유지"**: 기존엔 배경(클릭 타겟이 `<dialog>` 자신인 경우)만 닫혔음 — Close 버튼이 없어진 지금은 다이얼로그 내용 클릭도 딱히 다른 목적이 없어서, `event.target` 체크를 없애고 `<dialog>`에서 일어나는 모든 클릭(내용/배경 구분 없이)을 `close()`로 연결. Escape는 네이티브 `<dialog>` 동작이라 손대지 않음(그대로 유지).

### Zoom (완료, macOS 전환 세션에서 구현)
단계적으로 사용자 확인을 받으며 진행됨:
1. **디자인 확인**: 처음엔 `disabled` 상태의 버튼 하나("Zoom")를 `-`/`0`/`+` 3개로 배치만 먼저 교체(기능은 안 붙임 — "디자인만 먼저 확인할게" 요청). 사용자가 "글자 크기가 같아도 -, 0, +가 각각 보이는 크기가 달라서 통일감이 없다"고 리포트 — 하이픈(`-`)은 짧고 얇은 선, `0`은 숫자 전체 높이를 채우는 타원이라 시각적 무게가 다름. 대안 3개(제대로 된 기호/단어로 교체, 문자는 유지하고 버튼 박스만 정렬, CSS로 직접 그린 아이콘)를 프리뷰와 함께 제시해 사용자가 첫 번째(수학 마이너스 기호 `−`(U+2212) + `100%`)를 선택 — 브라우저/OS zoom 컨트롤의 흔한 색상 패턴이자, 아이콘 없이 툴바가 이미 쓰는 텍스트 스타일 유지.
2. **활성화만 먼저**: "버튼을 활성화 해줘봐" — `disabled` 속성만 제거(클릭 이벤트는 여전히 안 붙임), hover 등 정상 버튼 스타일 확인용.
3. **실제 구현**: `docs/PLAN.md` M7 절의 설계(세션 전용 상태, config.json에 안 씀, `computeCssVars`가 이미 `config.zoom`→`--lm-zoom` 변환)를 그대로 따름.
   - `lm-toolbar.ts`: `ZOOM_MIN`(50)/`ZOOM_MAX`(200)/`ZOOM_STEP`(10)/`ZOOM_RESET`(100) 상수 export(main.ts가 같은 숫자로 클램프하도록 단일 소스). `−`/`+`는 경계값에서 `disabled`, 중앙 버튼은 `${zoom}%`로 현재 배율 표시 + 클릭 시 리셋. `setZoom()`으로 값을 받아 렌더만 함(다른 세션 상태들과 동일 패턴).
   - `lm-statusbar.ts`: 하드코딩됐던 "100%"를 `setZoom()`으로 실제 값 반영.
   - `main.ts`: `zoom`을 `tocVisible`과 동일한 패턴의 세션 전용 상태로 소유. `readConfig()` 완료 시 `config.zoom`으로 초기화. `lm-zoom-out`/`lm-zoom-reset`/`lm-zoom-in` 이벤트 → 클램프 → `applyTheme({ ...currentConfig, zoom })`로 `--lm-zoom` CSS 변수만 재적용(문서 재렌더 없음, Apply 버튼과 달리 mermaid/shiki 등을 다시 굽는 게 아니라 순수 CSS 변수 갱신이라 더 가벼움) + 툴바/상태바 갱신.
   - 검증: `npm run lint && npx tsc --noEmit && npm run build && npm run test`(30개) 전부 통과. 화면 캡처 검증은 하지 않음(위 방침대로).
4. **개선(사용자 요청): 중앙 버튼 라벨을 항상 `100%`로 고정.** "zoom 상태는 상태바에 있으니, 메뉴바의 100% 버튼 라벨은 항상 100%로 유지해줘 — 100%로 돌아간다는 의미를 명확히 하려는 조치." `lm-toolbar.ts`의 중앙 버튼이 `${this.zoom}%`(현재 배율)를 렌더하던 걸 `${ZOOM_RESET}%`(고정값)로 변경 — 실제 배율은 이미 `lm-statusbar`가 보여주므로, 이 버튼은 그 자리에서 "누르면 리셋된다"는 의미만 전달. `setZoom()`은 그대로 유지(`−`/`+`의 경계 disabled 판정에 여전히 필요).
5. **버그 수정(사용자 리포트, 2단계): zoom을 조절해도 task-list 체크박스 크기는 그대로.**
   - **1차 시도 — 불충분**: task-list 체크박스(`core/markdown.ts`가 만드는 평범한 `<input type="checkbox">`)는 브라우저 UA 스타일시트가 크기를 고정 px로 지정해서 `.lm-markdown`의 (줌에 따라 커지는) font-size와 무관하다고 보고, `layout.css`에 `.lm-markdown input[type='checkbox'] { width: 1em; height: 1em; vertical-align: middle; }`를 추가. 사용자가 "사이즈가 바뀌지 않아. 그대로야."로 재리포트.
   - **원인 재확인**: 진짜 원인은 좀 더 구체적이었음 — 폼 컨트롤(`input`/`button`/`select`/`textarea`)은 페이지 font-size를 상속하지 않고 UA 스타일시트가 주는 자체 control font-size를 쓰는 게 기본 동작이라, 방금 추가한 `1em`도 `.lm-markdown`의 줌 반영 font-size가 아니라 그 고정된 control font-size 기준으로 계산되어 여전히 줌과 무관했음.
   - **2차 시도 — 확정**: 같은 규칙에 `font-size: inherit`을 먼저 추가해 `.lm-markdown`의 (이미 줌 반영된) font-size를 체크박스에 끌어온 뒤, 그 값을 기준으로 `1em` width/height가 스케일되도록 수정. `docs/PLAN.md`의 M7 Zoom 절도 같이 갱신.
   - 검증: `npm run lint && npm run typecheck && npm run build && npm run test`(30개) 전부 통과. **사용자가 실제 앱에서 재확인**("체크박스 크기 확인했어. 잘 돼.").
6. **재설계(사용자 요청): 줌 방식을 font-size 확대 → CSS `zoom` 기반으로, `max-width`도 고정값 → 창 폭 연동으로.** 체크박스 버그를 고친 직후 사용자가 방향을 재검토: "글자 크기나 각 컴포넌트의 크기를 조절하는 것보다는 브라우저의 zoom 기능처럼 그냥 화면 확대/축소로 하는 게 좋겠어. markdown 영역의 max-width도 창크기와 연동하고." 이전 방식(`font-size: calc(1rem * var(--lm-zoom))`)의 근본 문제: 텍스트만 커지고 나머지 요소(체크박스가 그랬듯 이미지/표 등도 잠재적으로)는 컴포넌트별로 따로 스케일을 맞춰줘야 하는 구조였음.
   - `layout.css`의 `.lm-markdown`에서 `font-size: calc(...)`를 `zoom: var(--lm-zoom)`으로 교체 — 브라우저 자체 페이지 줌과 동일한 속성이라 텍스트/이미지/표 테두리/체크박스/여백 등 하위 트리 전체가 한 번에 비례 확대/축소됨. 방금 추가했던 `.lm-markdown input[type='checkbox']`(`font-size: inherit`/`width`/`height`) 오버라이드는 불필요해져 삭제(체크박스도 다른 요소와 마찬가지로 `zoom`으로 자동 스케일).
   - `max-width: 860px`(고정값)을 `max-width: min(860px, 90vw)`로 교체 — 창 폭에 비례해 좁아지되(요청한 "창크기와 연동"), 아주 넓은 창에서는 860px을 넘지 않아 한 줄이 과도하게 길어지지 않음(원래 가독성 컬럼 폭 취지 유지). TOC가 보이는 상태에서도 컨테이너보다 넓어질 수 없어(블록 auto 폭의 기본 제약) 별도 분기 불필요.
   - `--lm-zoom`(config.zoom/100 비율) 자체는 안 바뀜 — `theme.ts`/`theme.test.ts` 그대로, CSS에서 소비하는 방식만 바뀜.
   - 검증: `npm run lint && npm run typecheck && npm run build && npm run test`(30개) 전부 통과. `docs/PLAN.md`의 M7 Zoom 절도 같이 갱신.
7. **재조정(사용자 요청): 위 `min(860px, 90vw)`는 의도한 "창 폭 연동"이 아니었음 — 뷰어는 기본으로 표시 가능한 최대 폭을 쓰고, 폭 제한은 사용자가 켤 수 있는 설정으로.** "viewer 영역의 크기를 창 크기에 연동하라는 건 적용되지 않았네. word-wrap 하지 말고 그냥 표시할 수 있는 최대로 하라는 의미였어. 단, 사용자 설정을 추가해서 width를 제한할 수 있도록 해주고, 이 설정은 상태바 파일명 오른쪽에 추가해줘."
   - **Config 필드 신설: `limitViewerWidth`(boolean, 기본값 `false`)** — `frontend/src/types/config.ts`(+`config.test.ts`)/`backend/src/config.rs`/`docs/CONFIG_SPEC.md` 세 곳 동시 반영. TOC Toggle/Zoom과 동일한 세션 전용 상태 패턴 — 토글은 config.json에 안 씀.
   - **`layout.css`**: `.lm-markdown`의 `max-width`를 완전히 제거(기본은 뷰어 패널 실제 폭을 그대로 채움, word-wrap은 그 실제 가장자리에서만 발생). 이전의 `min(860px, 90vw)`는 `.lm-content.lm-width-limited .lm-markdown` 규칙으로 옮겨서, 새 토글이 켜졌을 때만 적용(TOC Toggle이 `.lm-content.lm-toc-hidden`을 쓰는 것과 같은 패턴) — 즉 "창 폭에 비례하는 캡"이라는 이전 아이디어 자체는 버리지 않고, 사용자가 선택할 수 있는 옵션으로 격하됨.
   - **상태바가 처음으로 인터랙티브 컨트롤을 가짐**: 지금까지 `lm-statusbar`는 순수 표시 전용이었는데(클릭 가능한 건 전부 `lm-toolbar`), 사용자가 위치를 "상태바 파일명 오른쪽"으로 명시해서 여기 처음 버튼이 생김. `lm-toolbar`의 클릭 관용구(클릭 시 `blur()` 후 커스텀 이벤트 dispatch, `aria-pressed`로 on/off 표시)를 그대로 재사용 — 라벨 `Width`(한 단어, on일 때 accent 배경, TOC 버튼과 같은 시각 언어). `main.ts`가 `widthLimited` 세션 상태 소유, `lm-width-toggle` 이벤트로 토글 → `.lm-content` 클래스 + `statusbar.setWidthLimited()`.
   - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) + 백엔드(`cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`, 13개) 전부 통과. `docs/PLAN.md`/`docs/CONFIG_SPEC.md`/`docs/UI_SPEC.md` 같이 갱신.
8. **재조정(사용자 요청): 폭 제한을 on/off 스위치가 아니라 값을 직접 입력하는 방식으로, 렌더링된 컨텐츠의 좌/우 여백도 상태에 따라 다르게.** "설정으로 width를 제한하는 건 true/false switch가 아니라 직접 값을 입력할 수 있도록 변경해줘. 그리고 렌더링된 컨텐츠는, width를 제한하지 않았을 때는 좌/우 여백을 좀 더 추가해주고, 제한했을 때는 좌/우 여백을 동일하게 설정해 가운데 위치하게 해줘."
   - **Config 필드 교체: `limitViewerWidth`(boolean) → `viewerMaxWidth`(number, px, 기본값 `0` = 제한 없음)** — `frontend/src/types/config.ts`(+`config.test.ts`)/`backend/src/config.rs`/`docs/CONFIG_SPEC.md` 세 곳 동시 반영.
   - **`lm-statusbar`의 토글 버튼을 숫자 입력창으로 교체**: `<input type="number" min="0" step="10" placeholder="Full">`(위치는 그대로 파일명 오른쪽) — 비우면(또는 `0`) 제한 없음, 값을 입력하면 그 px로 제한. `change`에서만 반응(blur/Enter 커밋, `input`처럼 매 키 입력마다 반응 안 함 - 타이핑 중간값으로 매번 재배치할 이유가 없음). 새 `WidthChangeDetail` export 타입으로 `lm-width-change` 이벤트 detail을 실어보냄(다른 컴포넌트의 `*Detail` 관용구와 동일).
   - **`layout.css`**: `.lm-markdown` 기본 상태에 `margin: 0 2rem` 추가(제한 없을 때 좌/우 여백을 좀 더 - 요청 그대로). `.lm-content.lm-width-limited .lm-markdown`은 `max-width: var(--lm-viewer-max-width)`(main.ts가 `${viewerMaxWidth}px`로 세팅) + `margin-left/right: auto`(좌우 여백이 같아져 가운데 정렬 - 요청 문구 그대로 구현). 더 이상 `min(860px, 90vw)` 같은 자체 계산값 없음 — 폭은 전적으로 사용자가 입력한 값.
   - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) + 백엔드(`cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`, 13개) 전부 통과. `docs/PLAN.md`/`docs/CONFIG_SPEC.md` 같이 갱신.
9. **재조정(사용자 요청): `lm-statusbar`의 숫자 입력창을 읽기 전용 표시로 되돌림.** "상태바에 width 표현이 마음에 안 들어. 여기서 변경하지는 않을거야. 그냥 현재 config 파일에 설정된 값이 뭔지 표시만 하면 돼. 상태바에 표시되는 다른 컨텐츠들과의 수직 정렬에 신경써서 변경해줘. 0이 설정된 경우는 Full로 표시하는 거 좋아." 짐작되는 원인: `<input type="number">`가 filename/zoom 같은 평범한 텍스트 `<span>`들 사이에서 브라우저 기본 폼 컨트롤 테두리/패딩 때문에 높이가 달라 보여 수직 정렬이 어긋났던 것으로 보임(사용자가 정확한 원인을 짚어준 건 아니고, 입력창 자체를 없애는 방향으로 해결됐음) — 평범한 `<span>`으로 바꾸면 그 문제 자체가 구조적으로 사라짐.
   - `lm-statusbar`에서 `<input>`/`change` 리스너/`lm-width-change` 이벤트/`WidthChangeDetail` 타입 전부 제거, `<span class="lm-status-width">`로 교체 — filename/zoom과 동일한 패턴(`setViewerMaxWidth()`가 값만 반영, 값 > 0이면 `${width}px`, 아니면 `Full`).
   - `main.ts`: 더 이상 세션 중 바꿀 방법이 없으므로 별도 `viewerMaxWidth` 변수 없이 `currentConfig.viewerMaxWidth`를 직접 읽도록 단순화. Apply(`lm-reload-config`) 핸들러에도 `updateWidthDisplay()` 호출 추가 — config.json에서 값을 바꾸고 Apply를 누르면 상태바 표시와 실제 레이아웃(`--lm-viewer-max-width`) 둘 다 재시작 없이 갱신됨. 이제 `viewerMaxWidth`는 `tocVisible`/`zoom`과 달리 세션 중 오버라이드가 없는, config.json을 그대로 반영하기만 하는 필드가 됨(오히려 `CLAUDE.md`의 "No graphical settings editor"에 더 가까워짐).
   - `layout.css`: 입력창 전용 스타일(`.lm-status-width`/`.lm-status-width-input`) 삭제 — 평범한 `<span>`이라 filename/zoom처럼 별도 스타일 불필요.
   - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과. 백엔드는 이번 변경에서 안 건드림(기존 `cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`, 13개로 재확인만). `docs/PLAN.md` 같이 갱신.
10. **개선(사용자 요청): 폭 표시에 라벨 추가.** "상태바에 그냥 값만 표시되니까 무슨 의미인지 잘 모르겠어. \"Width: 값\" 이런 식으로 표시해줘." zoom은 `100%`처럼 단위만으로 의미가 통하지만, 폭은 `700px`/`Full`만으로는 무엇의 값인지 알 수 없다는 지적 — `updateWidth()`가 `Width: ${value}`로 라벨을 붙이도록 수정(`Width: Full` / `Width: 700px`). 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.
11. **버그 수정(사용자 리포트): `viewerMaxWidth`에 아주 큰 값을 넣으면 좌/우 여백이 줄어듦.** 큰 값/음수 처리를 물어보는 과정에서, "그대로 둬도 괜찮아. 큰 값을 입력했을 경우에 가로 스크롤이 생기거나 하는 문제가 발생하지는 않는데, 좌우 여백이 줄어드는 문제는 있어. 검토해줘."로 별개 버그 리포트. 원인: `.lm-content.lm-width-limited .lm-markdown`의 `margin-left/right: auto` — 값이 컨테이너 폭에 도달/초과하면 `max-width`가 사실상 컨테이너 폭 그대로를 차지하게 되고(가로 스크롤이 안 생기는 이유 - `max-width`는 컨테이너보다 넓게 만들 수 없음), 그러면 auto margin이 나눠 가질 여유 공간이 없어져서 좌우 여백이 0으로 줄어듦(제한 없음 상태의 기본 `2rem`보다 좁아짐).
    - 수정: `max-width: min(var(--lm-viewer-max-width), calc(100% - 4rem))` — 입력값이 아무리 커도 "컨테이너 폭 - 4rem"을 넘지 못하게 캡을 하나 더 씌워서, auto margin이 항상 최소 `2rem`씩(제한 없음 상태와 동일)은 나눠 가질 여유가 남도록 함. 컨테이너 폭에 아주 가까운(넘지는 않는) 값을 넣었을 때도 같은 이유로 여백이 찌그러지지 않음.
    - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.
12. **개선(사용자 요청): 좌/우 여백을 2rem → 1rem으로 축소.** "지금 설정을 width를 지정 여부와 관계없이 좌우 여백을 각각 2rem씩 확보한거지? 1rem으로 줄여봐줘." 확인된 그대로였음(제한 없음 상태의 `.lm-markdown` 기본 margin, 제한 상태의 `min(..., calc(100% - Nrem))` 캡 둘 다 `2rem` 기준) — 두 곳 다 `1rem`으로 축소(캡의 `calc(100% - 4rem)`도 `calc(100% - 2rem)`으로 같이 축소, "여백의 2배"라는 관계 유지). 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.
13. **버그 수정(사용자 리포트): 메뉴바 zoom 리셋 버튼의 `100%`가 config.json의 `zoom`이 아니라 하드코딩된 값이었음.** "zoom 관련 문제가 있어. 설정 파일에 있는 zoom이 이 앱의 기본 zoom 레벨이야. 따라서 메뉴바의 100%도 고정이 아니라 이 값에 따라 적용돼야 해." — 앞서 "라벨을 항상 100%로 고정"으로 만들었던 결정(위 3번 참고)이 틀렸던 것으로 정정: `100%`는 임의의 고정값이 아니라 `config.zoom`의 기본값(우연히 `100`)이었을 뿐이고, `config.zoom`이 다른 값이면 리셋 버튼도 그 값을 목표로 해야 정확함.
    - `lm-toolbar.ts`: `ZOOM_RESET`(고정 상수) 대신 새 세션 상태 `defaultZoom`(+`setDefaultZoom()`)을 렌더에 사용 — 중앙 버튼 라벨이 `${this.defaultZoom}%`로 바뀜. `-`/`+`의 경계 판정(`this.zoom` 기준)은 안 건드림.
    - `main.ts`: `defaultZoom`을 `zoom`과 같은 패턴(세션 상태, `readConfig()` 완료 시 `config.zoom`으로 초기화)으로 신설. `lm-zoom-reset` 핸들러가 하드코딩된 `ZOOM_RESET` 대신 `defaultZoom`으로 리셋(`ZOOM_RESET`은 `lm-toolbar.ts` 내부 초기값 fallback으로만 남고 main.ts의 import에서는 더 이상 안 씀 - orphan 정리).
    - **부수 발견 및 수정: Apply(Reload Config)가 `--lm-zoom`은 `applyTheme(config)`로 바로 바꾸면서 세션 `zoom`/`defaultZoom` 상태와 그 UI 표시(툴바/상태바)는 갱신을 안 하고 있었음.** config.json에서 zoom을 바꾸고 Apply를 누르면 실제 렌더링은 새 zoom으로 바뀌는데 툴바 `-`/`+`/리셋과 상태바 zoom 표시는 그 전 값을 그대로 보여주는 불일치가 있었음 — `defaultZoom`을 config.zoom과 동기화하는 코드를 만들면서 같은 값을 읽는 이 경로도 같이 점검하다가 발견함(사용자가 직접 지적한 건 아님). Apply 핸들러에 `zoom = config.zoom; toolbar.setZoom(zoom); statusbar.setZoom(zoom); defaultZoom = config.zoom; toolbar.setDefaultZoom(defaultZoom);` 추가해서 실제 렌더링과 표시가 항상 같은 값을 가리키도록 함.
    - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.
14. **버그 수정(사용자 리포트): 문서를 연 상태에서 zoom을 세션 중 바꾼 뒤 config를 고쳐 Apply를 누르면 zoom이 기본값으로 리셋됨.** "문서를 읽은 상태에서 zoom level을 변경하고, 이후 config 파일을 변경해 apply를 누르면, 기본 zoom level로 reset돼. 이 기능을 제외해줘. 사용자가 변경한 zoom level은 유지되도록." — 바로 위(13번) "Apply 시 zoom 동기화" 수정이 원인이었음: config에 다른 필드(테마 등)만 바꾸고 Apply를 눌러도 `zoom`을 무조건 `config.zoom`으로 되돌리고 있었던 것 — 세션 중 수동으로 조절한 zoom까지 함께 덮어써버림.
    - 수정: Apply 핸들러에서 `zoom = config.zoom; toolbar.setZoom(zoom); statusbar.setZoom(zoom);` 세 줄 제거. `applyTheme(config)`도 `applyTheme({ ...config, zoom })`으로 바꿔서 세션 zoom을 그대로 유지한 채(`--lm-zoom`을 안 건드림) 나머지 필드만 적용. `defaultZoom`(리셋 버튼이 가리키는 목표값)만 계속 `config.zoom`으로 갱신 — "리셋하면 어디로 가는지"는 최신 config를 따르되, "지금 보이는 배율"은 세션 중 조절한 값 그대로.
    - 검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.

**최종 확인(사용자)**: 위 zoom 재설계(1~14번, CSS `zoom` 전환/`defaultZoom`/Apply 세션 보존)·뷰어 폭 제한(`viewerMaxWidth`, 상태바 표시, 여백 로직)·mermaid/KaTeX/image 경고 상자 디자인 통일 세 가지 모두 실제 앱에서 확인 완료("1, 2, 3 모두 확인 완료했어"). **M7에 더 이상 미확인 항목 없음.**

## 버튼 라벨 축약 + Config File/Reset Config 기능 삭제 (신규)
- **개선(사용자 요청): 버튼 라벨을 한 단어로.** "화면 폭이 좁을 수 있어서 버튼은 한 단어로 표시하고 싶어" — `TOC Toggle`→`TOC`, `Config Folder`→`Config`, `Reset Config`→`Reset`. `Reload Config`는 그대로 유지 — "Reload"만 쓰면 md 파일 재로딩(자동 live reload)과 config 재로딩이 헷갈릴 수 있다고 사용자가 지적, 좋은 한 단어를 아직 못 찾아서 사용자가 더 생각해보기로 함(제안했던 대안: Resync/Reconfig — 아직 미확정).
- **개선(사용자 요청): 툴바 높이 축소.** "버튼 위/아래 padding과 margin이 좀 커서 메뉴바 높이 전체적으로 좀 커" — `layout.css`의 `lm-toolbar` 수직 padding `0.5rem`→`0.3rem`, 버튼 수직 padding `0.4rem`→`0.25rem`(수평 padding은 유지). 버튼에 `margin: 0`도 명시적으로 추가(브라우저 기본값이 이미 0이라 시각적 변화는 없지만 의도를 코드에 남겨둠).
- **개선(사용자 요청): 뷰어 안내 문구에서 ", or use Open" 삭제.** `"Drop a Markdown file here, or use Open."` → `"Drop a Markdown file here."` (`lm-viewer.ts`의 `renderEmpty()`).
- **개선(사용자 요청, Reset 삭제 이후 확정): `Reload Config` 라벨을 `Apply`로.** "config 관련 다른 버튼들이 없어졌으니, reload는 그냥 적용한다는 의미로 apply로 해도 좋을 것 같아" — Config File/Reset이 없어져서 원래 우려하던 혼동 대상이 줄었고, "지금 config.json을 적용한다"는 효과 중심 이름이 더 낫다고 판단해 채택. `lm-toolbar`의 `CONFIG_ACTIONS` 라벨 문자열만 변경 — `data-action="reload-config"`/`lm-reload-config` 이벤트/`BackendApi.reloadConfig()`/`backend::reload_config()`/Tauri `reload_config` 커맨드 이름은 전부 안 건드림(내부 동작을 정확히 나타내는 이름이라 그대로 두는 게 맞다고 판단 — `Config Folder`→`Config`처럼 라벨과 내부 식별자가 갈라지는 건 이미 있던 패턴).
- **기능 삭제(사용자 요청, 완전 삭제로 확정): Open Config File.** 삭제 전 `CLAUDE.md` Config Rules가 "Open Config Folder / Open Config File / Reload Config / Reset Config" 4개 제공을 명시하고 있어서 문서와 안 맞게 될 걸 먼저 확인 → 사용자가 "완전히 삭제"(버튼만 숨기는 게 아니라)로 확정.
  - **프론트**: `lm-toolbar`의 `CONFIG_ACTIONS`에서 `config-file` 제거, `main.ts`의 `lm-config-file` 리스너 제거. `BackendApi.openConfigFile()`과 `WebBackend`/`DevBackend`/`TauriBackend` 3개 구현 전부 제거.
  - **Tauri**: `src-tauri/src/lib.rs`의 `open_config_file` 커맨드 함수와 `invoke_handler` 등록 제거.
  - **정리(부수)**: `backend::config_path()`가 `open_config_file`의 유일한 외부 소비자였음 — `backend/src/lib.rs`의 `pub use`에서 뺌(함수 자체는 `config.rs`가 내부적으로 `load_config()`에 계속 씀 — 삭제 아니라 재노출만 정리).
  - **문서**: `docs/IPC_SPEC.md`(9→8개 커맨드), `docs/UI_SPEC.md`(툴바 목록), `CLAUDE.md`(Config Rules의 "Open Config File" 항목) 전부 수정.
- **검증**: 프론트(`lint/typecheck/build/test`) + 백엔드(`cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`) 전부 통과.
- **기능 삭제(사용자 요청): Reset Config, 대신 Reload Config가 자기 치유.** Config File 삭제로 "config.json을 지워도 다시 편집할 파일을 만들 방법이 없다"는 gap을 내가 먼저 짚었고("이거 없이는 Reset도 없이는 완전히 새 파일을 만들 방법이 없다"), 사용자가 "config 파일을 삭제하고 reload를 하면 기본 config 파일을 다시 써주는 기능을 추가하고 reset 버튼을 없애는 건 어때?"로 해결책 제안 → 그대로 구현.
  - **`backend::reload_config()`(신설, `backend/src/config.rs`)**: `load_config()`(순수 읽기 - 파일이 없거나 깨졌으면 메모리 기본값만 반환, 디스크에 아무것도 안 씀)와 별개로, 읽기/파싱에 실패하면 기본값을 **실제로 그 경로에 써준다** — 기존 파일이 있었으면(깨진 파일이라도) 먼저 `config.json.bak`으로 백업(옛 `reset_config()`가 하던 백업 습관을 그대로 재사용). 파일 읽기+파싱 로직은 `try_load(path) -> Option<Config>`로 뽑아내서 `load_config()`/`reload_config()` 둘 다 재사용(리팩터, 동작 변화 없음).
  - **`read_config()`/`GET /api/config`는 안 건드림**: 계속 `load_config()`만 호출 — 자기 치유(디스크 쓰기)는 명시적으로 "Reload"를 눌렀을 때만 일어나고, 단순 읽기는 여전히 부작용 없음.
  - **삭제**: `backend::reset_config()` 함수, `src-tauri`의 `reset_config` 커맨드+`invoke_handler` 등록, devserver의 `POST /api/config/reset` 라우트+핸들러, 프론트 `BackendApi.resetConfig()`(Web/Dev/Tauri 3개 어댑터 전부), `lm-toolbar`의 Reset 버튼(`CONFIG_ACTIONS`에서 제거), `main.ts`의 `lm-reset-config` 리스너, `CLAUDE.md` Config Rules의 "Reset Config" 항목, `docs/IPC_SPEC.md`(reset_config 관련 커맨드/Dev Server 표 행/이벤트 설명 문구)까지.
  - **검증**: 백엔드(`cargo fmt --check`/`clippy --workspace --all-features`(+`--features dev-server`도 별도 확인)/`test --workspace`) + 프론트(`lint/typecheck/build/test`) 전부 통과. `reload_config()`의 자기 치유 로직 자체는 새 단위 테스트를 안 붙임 — `load_config()`/구 `reset_config()`도 실제 OS config 디렉터리에 의존하는 부수효과 함수라 원래부터 단위 테스트 대상이 아니었던 것과 같은 이유(`config.rs`엔 순수 serde 직렬화 테스트 2개만 있음).

## 창 크기 (신규)
- **개선(사용자 요청): 앱 최소 크기 제한.** `minWidth`/`minHeight` 추가 — 처음 `600x400`으로 시작했다가 "너무 작다"는 피드백으로 `800x600`, 이후 다시 `640x480`으로 변경. 세 값 다 4:3 비율.
- **개선(사용자 요청): 기본 창 크기를 4:3 비율로.** 기존 `width: 1000, height: 700`(M6에서 800x600 → 1000x700으로 수동 조정했던 값, 4:3이 아니었음)을 `960x720`으로 변경 — `minWidth`/`minHeight`(현재 640x480)와 같은 4:3 비율 유지, 여전히 그보다 크므로 충돌 없음.
- Tauri 전용 설정이라 Web/Dev 모드는 영향 없음(브라우저 탭/창 크기는 OS·브라우저가 관리, 앱이 제어할 수 있는 영역이 아님). `cargo check -p app`으로 스키마 유효성 확인.

## macOS 전환 세션 구현 상세

Ubuntu에서 개발하던 걸 macOS로 이어받은 세션. 개발 도구(Xcode CLT/Rust/Node/Homebrew)는 이미 설치돼 있었고, `pkg-config`만 없었지만 이번 빌드 전체에서 실제로 필요하지 않았음(webkit2gtk 등 Linux 전용 시스템 패키지 자체가 macOS엔 불필요 — WKWebView 네이티브 사용). `cargo build/test/fmt/clippy -p backend`/`-p app`, 프론트 `lint`/`typecheck`/`build`/`test`, `npm run tauri dev` 실기 기동까지 전부 시스템 패키지 설치 없이 바로 통과 — 그 과정에서 아래 macOS 전용 버그 2건을 발견.

### 버그 수정(macOS 전용): watcher가 FSEvents 경로 불일치로 콜백을 아예 못 받음
`backend/src/watcher.rs`의 `event_affects()`가 감시 대상 경로를 문자열 완전일치(`==`)로 비교하는데, macOS의 FSEvents 백엔드는 이벤트 경로를 심볼릭 링크가 해석(canonicalize)된 형태로 돌려준다(예: `/var/...`로 감시를 걸어도 이벤트는 `/private/var/...`로 옴 — `/var`가 `/private/var`의 심링크). Linux(inotify)는 이런 변환이 없어서 이 문제 자체가 존재하지 않았음. `notify` 크레이트로 직접 프로브를 만들어 확인: `target = "/var/folders/.../doc.md"`로 감시했는데 실제 이벤트는 `paths=["/private/var/folders/.../doc.md"]`로 옴. 기존 테스트(`fires_once_for_a_burst_of_writes_to_the_watched_file`)가 정확히 이 케이스(`std::env::temp_dir()`가 `/var/folders/...`를 반환)를 잡아내 macOS에서 실패했음.

**실사용 영향**: 사용자 문서가 `~/Documents/...`처럼 심링크 없는 경로면 문제없지만, `/tmp` 하위나 iCloud Drive(`~/Library/Mobile Documents/...`) 등 심링크를 거치는 위치의 파일은 macOS에서 live reload가 조용히 안 동작할 수 있었음.

수정: `watch_file()`에서 `target`을 `path.canonicalize()`로 정규화(실패 시 원본 경로로 폴백)해서 비교 기준을 FSEvents가 실제로 돌려주는 형태와 맞춤 — Linux에서도 무해(이미 정규 경로라 canonicalize가 그대로 반환). 수정 후 `cargo test -p backend` 13개 전부 통과.

### 버그 수정(macOS 전용, 사용자 리포트): Print 버튼이 Ubuntu에선 됐는데 macOS에서 아무 반응 없음
`toolbar`의 Print 버튼은 `main.ts`에서 그냥 `window.print()`를 호출하는데, 이게 플랫폼마다 다르게 처리됨:
- Linux(WebKitGTK): `window.print()`를 엔진이 자체적으로 네이티브 브라우저 API로 처리 — Tauri의 IPC/권한(ACL) 체계를 거치지 않음. 그래서 Ubuntu에서는 항상 됐음.
- macOS(WKWebView): WKWebView가 `window.print()`를 네이티브로 지원하지 않아서, wry/Tauri가 대신 내부 `print` 커맨드로 처리해줌. 이 커맨드는 `core:webview:allow-print` 권한이 명시적으로 있어야 동작 — 없으면 권한 거부로 콘솔에만 경고가 뜨고 화면엔 아무 반응이 없음(정확히 사용자가 본 증상).

`src-tauri/capabilities/default.json`의 `permissions`에 `core:default`/`dialog:allow-open`/`opener:allow-open-path`만 있고 `core:webview:allow-print`가 빠져 있었던 게 원인 — `core:default`가 끌고 오는 `core:webview:default`엔 `allow-get-all-webviews`/`allow-webview-position`/`allow-webview-size`/`allow-internal-toggle-devtools`만 있고 `allow-print`는 포함 안 됨(`src-tauri/gen/schemas/acl-manifests.json`으로 직접 확인).

수정: `capabilities/default.json`의 `permissions`에 `"core:webview:allow-print"` 추가. `cargo build -p app`으로 권한 식별자 자체가 유효함(빌드 스크립트가 파싱 성공)을 확인, **사용자가 실제 macOS Tauri 앱에서 Print 버튼을 눌러보고 정상 동작 확인**.

### 개선(사용자 요청): config.json이 없으면 앱 시작 시에도 자기 치유
기존엔 `read_config()`(앱 시작 시 1회 호출)가 순수 읽기 전용 `backend::load_config()`를 써서, config.json이 없어도 메모리 기본값만 쓰고 디스크에는 아무것도 안 썼음 — 자기 치유(디스크에 기본값을 실제로 쓰기)는 M7에서 신설된 `reload_config()`(Apply 버튼)를 눌러야만 일어났음. 사용자가 "앱이 실행될 때는 항상 config file 존재를 확인해서 없으면 기본값으로 생성"하길 원함 — 단, Apply 버튼의 기존 동작(앱을 실행한 채로 config.json을 삭제하고 Apply를 누르면 재생성)은 그대로 유지하고 싶어함.

수정: `read_config()` Tauri 커맨드와 devserver의 `GET /api/config` 핸들러가 이제 둘 다 `backend::load_config()` 대신 `backend::reload_config()`를 호출 — 앱 시작(Tauri)/서버 요청(Dev) 시점과 Apply 클릭 시점이 동일한 자기 치유 로직을 공유. 순수 읽기 전용이던 `backend::load_config()`는 이 변경으로 외부 호출자가 없어져 삭제(`backend/src/lib.rs`의 re-export도 정리). `docs/IPC_SPEC.md`의 "읽기는 부작용 없음" 문구를 새 동작에 맞게 수정. 실기 확인: `config.json` 삭제 후 `npm run tauri dev`로 앱을 켜자 즉시 기본값으로 파일이 재생성되는 것 확인.

### 정리(사용자 요청): 스키마에만 있고 실제로 구현되지 않은 config 필드 2개 삭제
사용자가 `autoReload: false`로 설정하고 Apply를 눌러도 상태바가 계속 "On"으로 남고 live reload가 계속 동작하는 걸 리포트 — 조사해보니 `autoReload` 필드는 `backend/src/config.rs`/`frontend/src/types/config.ts`/`docs/CONFIG_SPEC.md`에 스키마로만 존재하고, 실제 watch 로직(`main.ts`의 `watchPath()`)이나 상태바 표시(`lm-statusbar.ts`)는 이 필드를 전혀 참조하지 않았음 — 애초에 구현이 빠진 채로 스키마만 남아있던 phantom 필드. 켜고 끄는 토글 기능을 새로 만드는 대신, 사용자가 "이 기능은 굳이 필요 없다"고 판단해 **필드 자체를 삭제**하기로 결정. 상태바의 "Auto Reload: On/N/A" 표시도 같이 삭제(`lm-statusbar.ts`) — 이 표시를 구동하던 `capabilities` prop/`setCapabilities()`/`StatusbarCapabilities` 인터페이스도 이 표시 하나만을 위한 것이어서 같이 정리(orphan 제거), `main.ts`의 `statusbar.setCapabilities(...)` 호출도 제거.

이 발견을 계기로 나머지 config 필드 전체를 실제 사용처 기준으로 재점검(`grep`으로 스키마 정의 파일 밖에서 각 필드가 실제로 읽히는지 확인) — **`breadcrumbVisible`도 완전히 같은 상황**(어디에도 실제 참조가 없음)이라 확인, 같은 방식으로 삭제 확정. breadcrumb 표시/숨김은 원래부터(그리고 지금도) 활성 heading 유무로만 결정되는 게 맞는 설계라 이 필드가 관여할 자리가 없었음.

두 필드 모두 `backend/src/config.rs`(struct 필드 + `Default` impl)/`frontend/src/types/config.ts`(interface + `DEFAULT_CONFIG`)/`frontend/src/types/config.test.ts`/`docs/CONFIG_SPEC.md`에서 제거. `docs/UI_SPEC.md`(StatusBar 필드 목록)/`docs/PLAN.md`(capabilities 기반 UI 분기 설명의 예시 문구)도 Auto Reload 표시 삭제에 맞춰 수정. 남은 필드(`theme`/`customCss`/`fontFamily`/`codeFontFamily`/`zoom`/`tocVisible`/`syntaxHighlight`/`mermaid`/`mermaidTheme`/`katex`/`printUseLightTheme`)는 전부 실제 사용처 확인됨 — `zoom`은 값 자체는 CSS 변수로 정상 적용되지만 툴바 조절 버튼이 없는 상태인데, 이건 `TASKS.md`에 이미 "M7 Zoom 미착수"로 추적 중인 별개 항목이라 phantom 필드는 아님.

### 개선(사용자 요청): 상태바 레이아웃 — zoom을 오른쪽 정렬로
"파일명, 렌더링 시간은 그대로 왼쪽에 두고, 확대 배율을 오른쪽 정렬로 옮겨줘." `lm-statusbar.ts`의 마크업 순서를 `filename → render time(dev-only) → zoom`으로 바꾸고, `layout.css`에 `.lm-status-zoom { margin-left: auto; }` 추가해 zoom만 flex 컨테이너 오른쪽 끝으로 밀어냄(나머지는 기존 `gap`으로 왼쪽에 자연스럽게 붙음).

### 개선(사용자 요청): Apply를 눌러도 config가 안 바뀌었으면 아무 동작도 안 하도록
"config file 변경없이 apply 버튼을 누르면 아무런 동작을 하지 않아야 하는데 rendering 시간이 계속 갱신되고 있어." 기존 `lm-reload-config` 핸들러는 `backend.reloadConfig()` 결과를 받으면 값이 실제로 바뀌었는지 확인 안 하고 무조건 `applyTheme()` + `rerenderCurrentDocument()`(재렌더 → 렌더링 시간도 매번 갱신)를 호출했음. `frontend/src/types/config.ts`에 순수 함수 `configsEqual(a, b)` 추가(Config는 중첩 없는 평평한 원시값 객체라 필드별 `===` 비교로 완전한 동등성 체크) — `main.ts`의 핸들러가 새 config와 현재 `currentConfig`가 동일하면 그대로 `return`, 실제로 값이 바뀐 경우에만 재렌더링. `config.test.ts`에 동일/필드 하나만 다른 경우 테스트 추가.

### 참고: 화면 캡처를 통한 시각적 검증은 더 이상 하지 않음
사용자가 "앞으로 확인은 내가 직접 할거니까 화면을 캡쳐해 검증하는 단계는 하지 마"라고 명시 — 이후로는 UI 변경도 lint/typecheck/build/test 같은 코드 레벨 검증까지만 하고 화면 캡처(Playwright/chromium-cli 등)로 직접 눈으로 확인하는 단계는 생략, 사용자가 직접 확인.

### 버그 수정(macOS 전용, 사용자 리포트, 2단계): 문서 끝까지 스크롤하면 툴바/상태바가 잠깐 화면 밖으로 밀려났다가 돌아옴
macOS 트랙패드의 러버밴드(rubber-band) 오버스크롤 효과. Linux(WebKitGTK)는 이 효과가 기본으로 없어서 Ubuntu에서는 안 보였던 증상.

- **1차 시도(부분적으로만 효과, 사용자가 TOC/툴바/상태바에서는 여전히 재현됨을 리포트)**: `lm-viewer`/`lm-toc`(실제 스크롤이 일어나는 컨테이너)에 `overscroll-behavior: contain` 추가 — 경계에서 스크롤 입력이 부모(문서)로 체이닝되는 것을 막으려는 시도. `lm-viewer`에서는 실제로 해결됐지만, `lm-toc`에서 스크롤하거나 스크롤할 내용이 전혀 없는 툴바/상태바 위에서 스크롤해도 여전히 전체 페이지가 튕겼음.
- **원인 재확인**: 스크롤할 내용이 없는 영역(툴바/상태바)에서도 재현된다는 게 결정적 신호 — 이건 특정 자식 요소의 "스크롤 체이닝"이 아니라, WKWebView의 **메인 프레임(문서 `html`) 자체가 갖고 있는 엘라스틱 바운스**가 트랙패드 스크롤 제스처마다 적용되는 것이었음. 자식 요소의 `overscroll-behavior: contain`은 체이닝만 막을 뿐 문서 루트 자체의 이 성질에는 영향을 못 줌(WebKit이 스크롤 체이닝 억제를 완전히 구현하지 못하는 것으로 보임).
- **2차 시도(확정)**: `html, body`에 `overflow: hidden` + `overscroll-behavior: none` 추가 — `#app`이 고정 `100vh` 레이아웃이라 문서 자체가 화면에서 스크롤할 이유가 원래 없으므로 안전. **`@media screen`으로 범위 한정**이 핵심 — 인쇄 시엔 `#app`/`.lm-viewer-pane`/`lm-viewer`가 `height: auto`/`overflow: visible`로 풀려서 문서 전체가 여러 페이지로 흘러야 하는데, `html`/`body`에 `overflow: hidden`을 무조건 걸면 M3에서 고쳤던 "인쇄 시 한 화면 분량만 나오는" 버그가 재발할 뻔했음 — `@media screen`으로 화면 전용으로 한정해서 그 회귀를 피함. `lm-viewer`/`lm-toc`의 `overscroll-behavior: contain`은 체이닝 억제가 실제로 되는 다른 엔진(Chromium/Firefox, Web/Dev 모드)을 위해 그대로 유지.
- **검증**: 사용자가 실제 macOS 앱에서 뷰어/TOC/툴바/상태바 전부 재확인, "ok. 잘돼."로 확정.

### 개선(사용자 요청): viewer/TOC 영역에 가로 스크롤이 절대 생기지 않도록 word-wrap 적용
러버밴드 수정 확인 직후, 사용자가 "viewer 영역에는 절대 횡스크롤이 생기지 않도록 word-wrap을 철저하게 적용해줘"라고 요청 — 공백 없는 긴 텍스트(URL, 식별자 등)나 넓은 테이블이 뷰어 폭을 넘기면, `overflow-y: auto`가 걸린 요소는 CSS 스펙상 반대쪽 축(`overflow-x`)이 명시 안 돼 있어도(기본값 `visible`) 암묵적으로 `auto`로 승격되기 때문에 실제로 가로 스크롤바가 생길 수 있는 상태였음(코드블록/Mermaid는 이미 자체 내부 스크롤로 처리돼 있어 문제 없음 — 강제 줄바꿈하면 오히려 깨지는 의도된 예외로 그대로 둠).

`frontend/src/styles/layout.css`:
- `.lm-markdown`에 `overflow-wrap: break-word` + `word-break: break-word` 추가 — 상속되는 속성이라 문단/헤딩/링크/리스트/인라인 코드 등 모든 하위 요소에 한 번에 적용됨(오래된 WebKit의 인라인/테이블 셀 줄바꿈 처리가 불완전한 경우를 대비해 표준 `overflow-wrap`과 레거시 `word-break` 둘 다 추가).
- `.lm-markdown table`에 `table-layout: fixed` + `width: 100%` 추가 — `table-layout: auto`(기본값)에서는 위 wrap 속성이 있어도 브라우저가 셀의 줄바꿈 없는 콘텐츠 폭을 먼저 계산해버려서 열이 많은 테이블은 여전히 넘칠 수 있음, `fixed`로 바꿔야 wrap이 실제로 적용됨.
- `.lm-math-block`(KaTeX 블록 수식)에 `overflow-x: auto` 추가 — 수식은 강제로 줄바꿈하면 수식 자체가 깨지므로, 코드블록/Mermaid와 동일한 "블록 자체 내부 스크롤, 뷰어 패널은 안 밀림" 패턴으로 처리.
- 이어서 사용자가 "toc에도 횡스크롤이 생기지 않으면 좋겠어"로 확인 — `lm-toc`에도 동일하게 `overflow-wrap: break-word` + `word-break: break-word` 추가(상속되어 `a`/`li`/`ul` 전부에 적용). 긴(공백 없는) heading 제목이 고정된 `--lm-toc-width` 컬럼을 뚫지 않고 줄바꿈됨.
- 검증: `npm run lint`/`npm run build`/`npm run test`(30개) 전부 통과. 화면 캡처 검증은 하지 않음(위 방침대로) — 사용자가 직접 확인.

## 멀티 윈도우/인스턴스 지원 — 조사 완료 + 설계 결정 4건 확정, 구현 착수 전

**상태 갱신**: 아래 "다시 시작할 때 먼저 사용자에게 물어야 할 것" 4개 질문에 전부 답이 나왔음(진행 상황은 해당 목록 참고) — 조사만 하고 멈췄던 이전 상태에서, 이제 설계/구현을 실제로 시작할 수 있는 상태로 넘어옴.

**상태: 조사(탐색)는 끝났지만 설계 비교는 끝내지 않고 중단함. 구현 계획이 아니라 다음에 이어갈 수 있도록 남겨두는 기록.**

### 배경
M6에서 `tauri-plugin-single-instance`로 "두 번째 실행/다른 .md 파일 열기가 기존 창으로 라우팅+포커스"되는 걸 의도된 동작으로 구현하고 사용자가 직접 확인까지 마쳤었음(위 M6 검증 상태 참고). 그런데 사용자가 "LightMark는 뷰어이니 여러 instance를 동시에 실행할 수 있어야 한다"는 걸 뒤늦게 깨달음 — 지금까지 검증됐던 M6의 그 동작이 정확히 반대 방향이라는 뜻. 구현 전에 계획부터 검토하되, 계획을 다 세우지 말고 조사 결과만 문서화해달라는 요청으로 여기서 멈춤.

### 조사 결과 (탐색 에이전트 2개, 완료됨 — 사실로 취급 가능)
**프론트엔드는 이미 창별로 격리돼 있어서 손댈 필요 없음**: `frontend/src/main.ts`의 모든 모듈 최상위 상태(`currentConfig`/`tocVisible`/`zoom`/`hasDocument`/`currentDoc`/`activeWatchPath`/`unwatch`)는 각 Tauri 창(webview)이 독립된 JS 실행 컨텍스트를 갖기 때문에 자연히 창별로 분리됨. `document.querySelector` 조회들도 그 창 자신의 document 안에서만 동작. Dev 모드의 `?file=` URL 파라미터도 이미 창별로 독립적임.

**"창/프로세스 하나" 전제가 박혀 있는 곳은 전부 Rust/Tauri 레이어**:
- `src-tauri/src/lib.rs:134-144` — `tauri_plugin_single_instance::init(...)` 콜백: 두 번째 실행 시 경로를 추출해 `app.emit("open-path", path)`(전체 webview 브로드캐스트)로 쏘고, `app.get_webview_window("main")`(라벨 하드코딩) + `.set_focus()`. **바로 이게 바뀌어야 하는 부분**.
- `lib.rs:126-129` + `cli.rs`의 `get_initial_path`/`InitialPath` — 전역 `Mutex<Option<String>>` 하나, `.take()`로 소비되는 구조라 첫 창이 가져가면 다른 창은 `None`. 창별 구분이 전혀 없음.
- `lib.rs:15-19`의 `WatcherRegistry(Mutex<HashMap<String, FileWatcher>>)` — 파일 경로로만 키잉된 전역 맵 하나. 주석에 "LightMark only ever watches one document at a time"라고 명시. 창 두 개가 있으면 unwatch 시 서로의 watcher를 지울 수 있음.
- `open-path` 이벤트가 두 곳(`lib.rs:139` single-instance 콜백, `lib.rs:182` macOS `RunEvent::Opened`)에서 전부 `app.emit`(브로드캐스트)로 나감. `RunEvent::Opened`는 `urls.first()`만 써서 macOS에서 여러 파일을 한 번에 "Open With"로 선택해도 첫 번째만 열림.
- `file-changed` 이벤트(`lib.rs:86`)도 브로드캐스트, 프론트가 경로로 필터링(`platform/tauri.ts:26-31`) — 창이 하나니까 지금은 문제없이 보일 뿐.
- `src-tauri/tauri.conf.json`의 `app.windows`는 정적 배열 하나(라벨 미지정 → 기본값 `"main"`). 런타임에 창을 만드는 코드는 어디에도 없음.
- `src-tauri/capabilities/default.json`은 `"windows": ["main"]`으로 고정, `core:window:allow-create`/`core:webview:allow-create-webview-window` 권한 자체가 없음.
- `backend/src/state.rs`(`state.json`)와 `backend/src/config.rs`(`config.json`의 `reload_config()` 자기 치유)는 둘 다 잠금 없는 비원자적 `fs::write` — 지금은 프로세스가 하나뿐이라 괜찮지만, 창이 여러 개(혹은 최악의 경우 프로세스가 여러 개)가 되면 동시 접근 레이스가 실제로 발생할 수 있음.
- 모든 창이 닫혔을 때의 동작(macOS 관례: 앱은 계속 떠 있고 Dock 아이콘 클릭 시 `RunEvent::Reopen`으로 새 창 생성 vs. Windows/Linux의 일반적인 "마지막 창 닫으면 종료")에 대한 처리가 전혀 없음.
- `backend/src/watcher.rs`의 실제 `watch_file`/`FileWatcher`는 자체 공유 상태가 없어서 이미 동시에 여러 개 떠도 안전함 — "파일 하나만" 문제는 전부 `src-tauri`의 `WatcherRegistry`에 있는 것이고 이 크레이트 잘못이 아님.
- 이 동작을 명시하고 검증했던 문서: `docs/PLAN.md:268-271`, `docs/IPC_SPEC.md:17`, `HANDOFF.md`의 M6 관련 문단들 — 나중에 실제로 바뀌면 같이 고쳐야 함.

### 검토되던(결론 안 남) 방향
`tauri-plugin-single-instance`는 유지(두 번째 Finder 더블클릭이 여전히 같은 OS 프로세스로 합쳐지게 — 프로세스 여러 개로 늘어나는 것과 그로 인한 `config.json`/`state.json` 크로스 프로세스 레이스를 피하고, macOS 문서 앱(TextEdit/Preview 등)의 관례인 "프로세스 하나, 창 여러 개"와도 맞음)하되, 그 콜백과 `RunEvent::Opened`가 "기존 창 포커스" 대신 "새 창 생성"을 하도록 바꾸는 방향이 유력해 보였음. 창이 시작 파일을 아는 방법을 Dev 모드처럼 `?file=<path>` URL 파라미터로 통일하면 `get_initial_path`/`InitialPath`/`onOpenPath`의 절반을 통째로 없앨 수 있어 보임(코드가 오히려 줄어듦). "최소 변경안"과 "통합/정리안" 두 관점으로 비교하는 Plan 에이전트 2개를 병렬로 띄웠으나, 사용자가 "설계안 작성은 종료하고 조사만 문서화해달라"고 해서 둘 다 결론 내기 전에 중단함.

### 다시 시작할 때 먼저 사용자에게 물어야 할 것 (진행 상황 아래)
- ~~툴바의 **Open** 버튼(이미 문서가 열려 있는 상태에서)이 **새 창**을 열게 할지, 지금처럼 그 창 내용을 교체할지~~ — **결정됨(사용자 확인)**: "툴바 Open 버튼이나 창에 drag&drop은 해당 창에서 바로 문서가 바뀌는 게 맞아." 앱 내부 트리거(툴바 Open, 창에 drag&drop)는 **그 창 내용을 교체**. OS 트리거(더블클릭, "Open With" 다중 선택, CLI 인자)는 **새 창** — 이 둘은 별개 결정이라는 전제가 맞았음. 기존 코드(`lm-viewer`의 drop 핸들러가 `loadFile()`로 현재 창 내용 교체, 툴바 Open도 동일)는 그대로 두면 됨 — 새 창을 만드는 로직은 오직 OS 트리거(single-instance 콜백/`RunEvent::Opened`) 쪽에만 추가하면 된다는 뜻.
- ~~macOS에서 창을 전부 닫아도 앱이 계속 떠 있으면서 Dock 클릭으로 새 창을 만들 수 있게 할지~~ — **결정됨(사용자 확인)**: "macOS에서는 창을 모두 닫아도 앱이 떠 있는게 맞아." macOS 관례(`RunEvent::Reopen`으로 Dock 클릭 시 새 창) 그대로 구현. Windows/Linux는 이 관례 자체가 없으니 별개로 "마지막 창 닫으면 종료" 유지(플랫폼별로 갈릴 부분이라고 이미 메모해뒀던 대로).
- ~~macOS "Open With LightMark"로 여러 파일을 한꺼번에 선택했을 때 파일당 창 하나씩 여는 것까지 이번에 같이 고칠지~~ — **결정됨(사용자 확인)**: "여러 파일을 한꺼번에 열면 각각 창이 하나씩 열려야 해." `RunEvent::Opened`의 `urls.first()`만 쓰던 걸 전체 순회하도록 고쳐서, 파일마다 새 창 하나씩 열도록 구현.
- ~~`config.json`/`state.json` 동시 접근 방지를 이번 범위에 넣을지~~ — **결정됨(사용자 확인)**: "state.json 접근은 당연히 동시접근을 막아야지." 이번 범위에 포함 — `backend::state.rs`(state.json)/`backend::config.rs`(`reload_config()`의 config.json 쓰기) 둘 다 지금은 잠금 없는 비원자적 `fs::write`라, 프로세스 내 `Mutex`(또는 그에 준하는 직렬화 장치)로 보호 필요.
- **(macOS 세션에서 추가 확정) drag&drop 다중 파일 → 첫 파일은 그 창 교체, 나머지는 파일마다 새 창**: 위 결정 #1은 "drag&drop"을 단일 파일 기준(그 창 내용 교체)으로만 명시했고, 이 다중 파일 확장은 구현 시점에 "Open With 다중 선택 규칙과 동일하게"라는 이유로 임의로 넓혀졌던 부분이었음 — `PristineWindow` 레이스 버그(빈 창에 드롭하면 하나만 열리던 문제, 아래 "버그 수정" 참고) 때문에 처음엔 오히려 이게 의도된 동작인지 사용자도 확신 못 했던 상태. 버그를 고친 뒤 실기로 "처음부터 복수 창이 열리는 것" 확인 → **사용자가 이 동작을 공식 설계 원칙으로 확정**("버그를 고친김에 이 기능을 설계 원칙으로 할게"). 결정 #1의 "drag&drop = 그 창 내용 교체"는 여전히 유효하지만 "1개 파일을 드롭한 경우"로 범위가 좁혀지고, 다중 파일 드롭은 이제 결정 #3(Open With)과 동일한 "파일마다 새 창" 규칙을 따르는 것으로 명시적으로 확정됨 — 더 이상 임의 확장이 아니라 확정된 결정.

**네 가지 질문 전부 결정됨 — 설계/구현 재개 가능.**

### 구현 완료

사용자가 "구현 계획 세워"로 요청 → Plan 에이전트로 실제 Tauri v2.11.5 소스(`~/.cargo/registry`에 받아져 있는 `tauri-2.11.5`/`tauri-runtime-wry-2.11.4`/`tauri-utils-2.9.3`/`tao-0.35.3`)를 직접 읽어 API를 하나하나 검증한 뒤, 그 초안을 Plan 에이전트로 한 번 더 비평받아 실제 버그 5개(macOS 콜드스타트 시 빈 창 하나가 더 뜨는 레이스, `prevent_exit()`이 프로그램적 종료까지 막아버리는 문제, 창 닫을 때 watcher가 정리 안 되는 누수, `?file=`이 새로고침마다 재실행되는 문제, `url` 크레이트 direct dependency 누락)와 락 설계의 허점 몇 가지를 미리 잡아내고서 구현. 계획 전문은 `/home/tramamte/.claude/plans/elegant-fluttering-steele.md`에 남아있음.

**핵심 메커니즘: 모든 창이 IPC pull 대신 자기 URL로 초기 파일을 받음.** `get_initial_path`(전역 `Mutex<Option<String>>` pull)를 없애고, 창을 만들 때(첫 창 포함) URL 자체에 `?file=<percent-encoded>`를 실어 보냄 — `main.ts`의 기존 `?file=` 처리(원래 Dev 전용, `capabilities.watch`로 게이팅돼 있어 Tauri에도 이미 적용 가능했음)가 그대로 이걸 받아준다. `tauri-2.11.5/src/manager/webview.rs`(쿼리스트링이 `Url::join`을 그대로 통과)와 `src/protocol/tauri.rs`(prod 커스텀 프로토콜이 애셋을 찾기 전에 `?`/`#`를 명시적으로 잘라냄)를 직접 읽어서 dev/prod 모두에서 동작함을 확인.

**`src-tauri/src/lib.rs`**:
- `tauri.conf.json`의 창 설정에 `"create": false` 추가(배열 자체는 안 지움 — `WindowConfig::create`가 존재하고 그 자체 문서 주석이 `WebviewWindowBuilder::from_config`와 짝지어 쓰라고 안내함). `open_window(app, file: Option<&str>)` 헬퍼가 이 설정을 복제해 `label`/`title`/`url`만 창마다 다르게 채워 만듦 — title/size/minSize/resizable 등을 Rust 리터럴로 중복 선언하지 않아도 되고 스키마 검증도 그대로 받음.
- 창 라벨은 모듈 레벨 `static NEXT_WINDOW: AtomicU32`(managed state로 안 감쌈 — `State`로 감싸봐야 얻는 게 없음)로 `win-0`, `win-1`, ... 순서 부여. "비어있는 win-N 찾기" 방식은 검토했지만 TOCTOU 레이스가 있어 기각(창 생성이 진짜로 동시에 일어날 수 있음 — single-instance 콜백 스레드 하나, macOS 다중 선택 루프가 또 다른 스레드).
- **macOS 콜드스타트 레이스(Plan 에이전트가 잡아낸 버그)**: `setup()`은 `application:openURLs:`(`RunEvent::Opened`)보다 먼저 실행돼서, 더블클릭으로 실행해도 일단 빈 창 하나가 만들어지고 그 직후 파일이 든 두 번째 창이 뜨는 문제가 생길 뻔함. `PristineWindow(Mutex<Option<String>>)`로 "아직 아무것도 안 실린 시작 창"의 라벨을 기억해뒀다가, 실제 파일 오픈 요청이 오면 새 창을 만드는 대신 그 창을 `navigate()`로 재사용 — 재사용 즉시(또는 `watch_file`에 그 창 라벨로 첫 요청이 들어오는 시점에, 수동으로 그 창에 파일을 연 경우까지 커버) 플래그를 지워서, 나중에 무관한 파일-열기가 이미 다른 용도로 쓰이고 있는 창을 조용히 가로채는 일이 없도록 함.
- **`prevent_exit()` 과잉 적용(Plan 에이전트가 잡아낸 버그)**: `RunEvent::ExitRequested`가 "마지막 창 닫힘"뿐 아니라 `AppHandle::exit(0)` 같은 프로그램적 종료에도 뜬다(`code: Some(_)`) — `code.is_none()`일 때만 `prevent_exit()`을 부르도록 게이팅해서 진짜 종료 요청까지 막아버리는 걸 방지. Cmd+Q는 이 경로 자체를 안 타므로(`terminate:`로 바로 감) 영향 없음.
- **`WatcherRegistry`를 파일 경로 대신 창 라벨로 재키잉** — 두 창이 같은 파일을 봐도 서로의 watcher를 안 지움. `watch_file`/`unwatch_file`에 `WebviewWindow`를 주입받아 `.label()`로 자동으로 알아냄(프론트 API는 안 바뀜 — `unwatch_file`은 이제 `path` 인자 자체가 없어짐, 프론트도 그에 맞춰 안 보냄).
- **창 닫을 때 watcher 누수(Plan 에이전트가 잡아낸 버그)**: 지금까지 `unwatch_file`을 호출해주는 코드가 창 닫힘에 안 걸려 있었음 — 창 하나일 땐 최대 누수 1개로 유계였지만, 라벨로 재키잉한 뒤로는 프로세스 수명 내내 안 지워지는 무한 누수가 될 뻔함. `.on_window_event`로 `WindowEvent::Destroyed`를 잡아서 그 라벨의 watcher/pristine 플래그를 정리.
- `file-changed` 이벤트를 전체 브로드캐스트에서 `app.emit_to(EventTarget::webview_window(label), ...)`로 좁힘 — N개 창이 매번 저장할 때마다 다 깨서 경로 비교할 필요 없음(프론트의 기존 경로 필터는 watch/unwatch 레이스 방지용으로 그대로 유지).
- `open_file`의 네이티브 다이얼로그에 `window: WebviewWindow` 주입 + `.set_parent(&window)` — 창이 여러 개면 어느 창에 딸린 다이얼로그인지가 실제로 중요해짐(특히 macOS의 시트 동작).
- 새 IPC 커맨드 `open_new_window(path)` 추가 — 한 창에 파일을 여러 개 drag&drop했을 때, 첫 파일은 그 창 내용을 교체(프론트에서 기존 방식대로)하고 나머지 파일 각각에 대해 이 커맨드로 새 창을 연다.
- single-instance 콜백은 `tauri::async_runtime::spawn`으로 감쌈 — 이 콜백이 도는 스레드가 플랫폼마다 달라서(Linux: zbus 워커, macOS: 이미 tokio task, **Windows: 메인 스레드 자체, 그것도 tao의 `DispatchMessage` 도중 플러그인의 숨은 창 WndProc 안에서 재진입적으로**) 세 플랫폼 다 이벤트 루프의 깨끗한 지점에서 처리되도록 통일 — Windows의 재진입 안전성을 Plan 에이전트도 완전히 확신 못 했던 지점이라 값싼 보험.
- `capabilities/default.json`의 `"windows"`를 `["main"]` → `["win-*"]`로. Rust 쪽 창 생성 자체에는 새 권한이 전혀 필요 없음(`WebviewWindowBuilder::build()` 소스 확인 — ACL은 프론트→IPC 경계만 검사, 백엔드 자체 창 생성은 무관).

**`backend/src/config.rs`/`backend/src/state.rs`**: `Mutex<()>` 하나만으로는 부족하다는 것도 Plan 에이전트가 짚어줌 — (1) 쓰기뿐 아니라 읽기도 락 안에서 하지 않으면, 다른 프로세스/스레드의 쓰기 도중 읽어서 "깨진 파일"로 오판 → `reload_config()`의 자기 치유가 **멀쩡한 config를 기본값으로 덮어써버리는** 부작용이 있음. (2) 프로세스 내 `Mutex`는 axum dev-server(별도 프로세스)에는 애초에 아무 효과가 없음 — 그래서 새 `backend/src/fsutil.rs`의 `atomic_write()`(임시 파일에 쓰고 `rename`, 같은 파일시스템에서 원자적)를 같이 적용: `Mutex`는 프로세스 내 read-modify-write 순서를, `atomic_write`는 프로세스 경계를 넘어선 파일 내용 원자성을 각각 담당. (3) `.lock().unwrap()` 대신 `.unwrap_or_else(|e| e.into_inner())`로 poisoning 처리 — 한 창의 IPC 스레드가 패닉해도 다른 모든 창의 config 접근이 영구히 막히지 않도록.

**프론트엔드**: `getInitialPath?()` 삭제(위 URL 방식으로 대체), `onOpenPath?()` → `onFileDrop?(cb: (paths: string[]) => void)`로 개명(더 이상 `open-path` 이벤트를 안 받으므로 순수 drag&drop 전용이 됨) + `openWindow?(path)` 추가. `main.ts`: `?file=` 읽은 직후 `history.replaceState(null, '', location.pathname)` 추가(Plan 에이전트가 잡아낸 버그 — 없으면 `tauri dev`의 Vite 전체 리로드나 Cmd+R/devtools 리로드마다 처음 열었던 파일이 지금 보고 있는 문서 위에 다시 열려버림), drag&drop으로 여러 파일이 오면 첫 파일은 `openPath()`로 그 창 교체, 나머지는 `backend.openWindow?.(path)`로 새 창(macOS 다중 선택 규칙과 동일하게).

**검증**: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) + 백엔드(`cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`, 백엔드 13개 + `app` crate 4개) 전부 통과. macOS 전용 부분(`Opened`/`Reopen`/`ExitRequested`, pristine-윈도우 재사용, 다이얼로그 `set_parent`)은 이 세션이 Linux라 실기 검증 불가 — 기존 `RunEvent::Opened`와 같은 처지(문서에 미검증으로 남겨둠). 나머지(멀티 창 자체, drag&drop 다중 파일, watcher 재키잉, `?file=` 재로드 안전성)는 실제 `npm run tauri dev`로 검증 예정.

### 실기 검증(Linux, `npm run tauri dev`) — 완료, 발견 사항 1건

`npm run tauri dev`를 백그라운드로 띄우고 `busctl --user list`(D-Bus에 `dev.lightmark.viewer`/`dev.lightmark.viewer.SingleInstance` 등록 확인)와 GTK Application의 D-Bus 창 트리(`busctl --user tree dev.lightmark.viewer` → `/dev/lightmark/viewer/window/N`, 창 개수를 셀 수 있음)로 확인:

- **기본 실행(파일 없이) → 창 1개**: 확인됨. `open_window(app, None)` 1회 호출, D-Bus 트리에 `window/1` 하나만 등록.
- **두 번째 실행(파일 인자) → single-instance 라우팅 자체는 정확히 동작**: 같은 바이너리를 파일 인자와 함께 다시 실행하면 두 번째 프로세스는 즉시 종료하고, 첫 프로세스가 `tauri_plugin_single_instance` 콜백을 받아 `open_window`를 호출하는 것까지 확인(크래시 없음, `async_runtime::spawn` 경유 정상 동작).
- **발견된 실제 동작(버그라기보다 설계 범위의 문제)**: 위 두 번째 실행에서 **새 창이 열리지 않고, 아직 아무 파일도 안 실린 첫 창(`PristineWindow`)이 재사용됨** — `open_window`에 임시로 `eprintln!` 트레이스를 넣어 직접 확인(`creating new window win-0 (file=None)` → 두 번째 실행 시 `reusing pristine window win-0`, D-Bus 트리도 재실행 전후로 `window/1` 그대로 1개). 트레이스는 확인 후 원복, `git diff`로 반영 안 됐음을 확인.
  - `PristineWindow` 재사용은 원래 **macOS 콜드스타트 레이스**(`setup()`이 `RunEvent::Opened`보다 먼저 실행돼서 생기는, 같은 실행 안에서의 찰나의 경합)만 겨냥해 설계된 것인데, 실제 구현은 플랫폼이나 "그 경합 순간"으로 범위가 좁혀져 있지 않고 **"아직 빈 채로 남아있는 창이 있으면 언제든(같은 실행이든 한참 뒤 별도 실행이든) 재사용"**하는 일반 규칙임 — `watch_file`이 그 창 라벨로 처음 불릴 때(=실제로 뭔가 열릴 때)까지 플래그가 안 지워지기 때문.
  - 실사용 시나리오: 사용자가 LightMark를 파일 없이 띄워두고 잠시 그대로 두었다가(창은 비어 있음), 나스틸러스에서 다른 문서를 더블클릭하면 — 결정 #2("OS 트리거는 새 창")를 문자 그대로 적용하면 "빈 창은 그대로 두고 문서가 든 새 창이 하나 더 뜬다"가 기대값일 수 있는데, 지금 구현은 "그 빈 창에 문서를 그냥 실어버림"(창 개수는 늘지 않고 1개 유지)으로 동작함.
  - 이게 실제로 나쁜 동작인지는 관점에 따라 갈림 — 빈 창을 그대로 두고 쓸모없는 창을 하나 더 띄우는 것보다, 어차피 비어있던 창을 재활용하는 게 오히려 자연스러운 UX일 수 있음. 다만 계획서/결정 #2의 문구("OS 트리거 → 새 창")를 엄격히 따지면 벗어나는 동작임.
- **drag&drop 다중 파일, 같은 파일을 두 창에서 열고 하나 닫기, `?file=` 리로드 안전성**: 코드 리뷰로는 정상(watcher는 창 라벨로 재키잉되고 `Destroyed`에서 정리됨, `history.replaceState`가 `?file=` 재실행을 막음)이지만, 실제 마우스 drag&drop이나 창 닫기 같은 GUI 조작은 이 세션의 Wayland 네이티브 창을 `xdotool`/`wmctrl`로 제어할 수 없어서(X11 전용 도구라 Wayland 네이티브 창을 못 찾음) 자동으로 재현하지 못함 — 방침대로 시각적 확인은 사용자 몫으로 남김.
- 검증 후 `cargo fmt --check`/`cargo build -p app`/`cargo test --workspace`(13+4개) 재확인, 임시 트레이스 원복 상태로 전부 통과.

**후속 조치(자율 루프 중 결정, 사용자 응답 대기 없이 진행): `PristineWindow` 재사용을 macOS 전용으로 스코프 좁힘.** 이건 새로운 결정을 내린 게 아니라, 이미 사용자가 확정한 결정 #2("OS 트리거는 새 창")를 코드가 어기고 있던 걸 그 결정에 맞게 고친 것 — `open_window`의 재사용 분기를 `if cfg!(target_os = "macos") { ... }`로 감쌈(`PristineWindow` 구조체/기록/정리 로직 자체는 그대로 — Linux/Windows에서는 그냥 소비되지 않는 죽은 기록이 될 뿐, 무해함). 다시 `npm run tauri dev`로 재현: 기본 실행(창 1개, `window/1`) → 두 번째 실행(파일 인자) → `busctl --user tree`에 `window/1`과 `window/2`가 **둘 다** 존재하는 것으로 수정 확인(이전엔 재실행 후에도 `window/1` 하나뿐이었음). `cargo fmt`/`cargo build -p app`/`cargo clippy --workspace --all-features`/`cargo test --workspace`(13+4개) 전부 통과. macOS 쪽 동작(콜드스타트 레이스 회피)은 이 변경으로 전혀 안 바뀜 — 여전히 Linux 세션이라 실기 검증 불가, 다음에 macOS로 돌아갔을 때 확인.

**macOS 세션에서 실기 확인**: CLI 재실행으로 빈 창을 재사용하는 동작이 실제로 재현됨(빈 창이 있으면 재사용, 없으면 새 창) — 사용자가 이 동작 자체를 리포트하며 "지금 이대로 유지"로 확정(코드 변경 없음). 위 "다음에 할 일" 참고.

### 버그 수정(사용자 리포트, macOS 실기 검증 중 발견): 빈 창에 md 파일 여러 개를 한꺼번에 drag&drop하면 하나만 열리고 `Load failed` IPC 에러

"빈 창에서 처음 복수 md 파일을 drop하면 콘솔 로그로 `IPC custom protocol failed, ... TypeError: Load failed`가 나오고 하나만 열리는데, 이후 그 창에 다시 복수 md 파일을 drop하면 복수 창이 열려." — 첫 드롭에서만 재현되고 두 번째 드롭부터는 정상 동작하는 게 원인 규명의 핵심 힌트였음.

**원인**: 빈(pristine) 창에 파일 N개를 드롭하면, 첫 파일은 프론트에서 `openPath(first)`로 비동기 처리(readFile → loadFile → watchPath → `watch_file` IPC 호출까지 거쳐야 그 창의 pristine 플래그가 지워짐)되는데, 그 직후 나머지 파일들에 대한 `open_new_window` IPC 호출이 거의 동시에(동기적으로) 나간다. `watch_file`이 아직 pristine 플래그를 못 지운 상태에서 `open_new_window`가 먼저 도착하면, Rust `open_window()`가 "아직 pristine인 창"으로 **지금 드롭 대상이 된 그 창 자신**을 찾아내서 그 창을 다른 파일로 `navigate()`시켜버림 — 페이지가 전환되는 도중이라 IPC 커스텀 프로토콜이 끊겨 `Load failed`가 뜨고, 결과적으로 창 하나에 경쟁에서 이긴 파일 하나만 남음. 이건 원래 "콜드스타트 레이스"만 잡으려던 `PristineWindow` 재사용 로직이 "방금 내가 드롭한 바로 그 창"까지 재사용 후보로 포함하고 있었던 게 근본 원인 — 자기 자신을 재사용 대상에서 제외하는 로직이 없었음.

**확인 과정**: 사용자에게 결정 record 재검토를 먼저 요청 — `HANDOFF.md`의 결정 #1 원문("툴바 Open 버튼이나 창에 drag&drop은 해당 창에서 바로 문서가 바뀌는 게 맞아")은 drag&drop을 "그 창 내용 교체"로만 정의했고 다중 파일 시 나머지를 새 창으로 여는 것에 대한 언급이 없었음 — 그 "나머지는 새 창" 확장은 결정 #3(macOS Open With 다중 선택)의 구현 시점에 "동일 규칙 적용"이라는 이유로 drag&drop에도 임의로 넓혀졌던 것. 사용자가 "복수 창은 Open With에서만"이라고 기억한 게 맞았음. 원인이 확실치 않은 상태였어서 "drag&drop 다중 파일은 원래 단일 파일만 처리하도록 되돌리기(관련 코드 전부 제거)" vs "직접 확인 후 결정" 중 사용자가 후자를 선택 → `main.ts`에 임시 진단 로그(`console.log`로 드롭된 경로 개수, `openWindow` 실패 시 에러 노출) 추가 → 사용자가 실기로 재현해서 정확한 에러 메시지와 "두 번째 드롭부터는 정상"이라는 패턴까지 리포트해줌 — 이것으로 "경로 배열 자체는 다 들어옴, pristine 재사용 레이스가 원인"이라고 확정.

**수정**: `open_window(app, file, exclude)`에 `exclude: Option<&str>` 파라미터 추가 — pristine 창 레이블이 `exclude`와 같으면 재사용하지 않고 그냥 새 창을 만듦. `open_new_window` IPC 커맨드에 `window: WebviewWindow`를 주입받아(`open_file`/`watch_file`/`unwatch_file`과 동일 패턴) 자기 자신의 라벨을 `exclude`로 넘김. 다른 4개 호출부(single-instance 콜백, `.setup()`, `RunEvent::Opened`, `RunEvent::Reopen`)는 전부 OS 트리거라 "요청을 보낸 창" 자체가 없으므로 `exclude: None` — 기존 동작(콜드스타트 레이스 회피, 사용자가 방금 확정한 "빈 창 무기한 재사용") 전혀 안 바뀜. `main.ts`의 임시 진단 로그는 원복.

검증: `cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`(13+4개) + 프론트 `lint`/`typecheck`/`build`/`test`(30개) 전부 통과. **사용자가 재확인 완료**("처음부터 복수창이 열리는 것 확인했어") — 이 기회에 drag&drop 다중 파일 → 파일마다 새 창 동작 자체를 정식 설계 원칙으로 확정함(위 "다시 시작할 때 먼저 사용자에게 물어야 할 것" 목록에 결정 추가).

### 버그 수정(사용자 리포트, macOS 실기 검증 중 발견): 앱이 완전히 꺼진 상태에서 Finder로 `.md` 파일을 열면 그 파일이 든 창 위에 빈 창이 하나 더 뜸

`Opened`(더블클릭/파일 연결/Open With)를 실기로 검증하려면 Launch Services에 등록된 실제 `.app` 번들이 필요해서(raw dev 바이너리는 Finder가 "이 파일을 열 수 있는 앱"으로 인식 못 함) `npm run tauri build -- --debug`로 임시 디버그 번들을 만들고 `lsregister -f`로 등록해서 검증 진행. "앱이 이미 백그라운드에서 떠 있는 상태(창은 다 닫혀 있음)에서 열면 파일 하나만 정상적으로 열리고, 완전히 꺼진 상태(콜드스타트)에서 열 때만 재현된다"는 사용자의 정확한 관찰이 원인 규명의 핵심 힌트였음.

**진단 과정**: 처음엔 `log::info!`로 추적하려 했으나 콜드스타트 재현에서는 그 로그 자체가 하나도 안 찍힘(`.setup()`이 빈 창을 만드는 로그만 보임, `Opened`나 파일 있는 `open_window` 호출 로그는 아예 없음) — `tauri_plugin_log`가 `.setup()` 도중에야 등록되는데, 만약 `Opened`가 `.setup()`보다 먼저 처리된다면 그 시점엔 로거가 아직 없어서 로그 자체가 조용히 버려진다는 가설을 세움. `log`/`stdout`/`stderr`(GUI로 띄운 프로세스는 콘솔 자체가 없어 캡처 불가, `eprintln!`도 확인해봤지만 안 잡힘) 어디에도 의존하지 않는, `/tmp`에 직접 파일을 append하는 임시 추적 함수를 만들어 `single_instance` 콜백/`.setup()`/`run()`의 모든 이벤트/`open_window` 진입점에 심어서 재현 — **정확한 순서가 나옴**: `RunEvent::Opened`(파일 있음) 처리 완료(창 1개 생성) → **그 다음에야** `.setup()` 진입 → `.setup()`이 아무것도 모른 채 빈 창을 또 생성. 기존 코드 주석("`setup()`이 `Opened`보다 항상 먼저 실행된다")이 이번 실행에서는 정반대였음을 실측으로 확정.

**수정**: `.setup()`이 창을 만들기 전에 `NEXT_WINDOW`(창 생성마다 증가하는 전역 카운터)가 아직 `0`인지 먼저 확인 — `0`이 아니면 이미 다른 경로(`Opened`)가 창을 만들었다는 뜻이므로 자기는 만들지 않음. `PristineWindow` 재사용 로직(반대 순서 — `.setup()`이 먼저 이기는 경우)은 그대로 유지해서 양쪽 순서 모두 커버, 그 doc comment도 "순서가 보장 안 됨"으로 정정. Linux/Windows는 `Opened` 자체가 없어서(`.setup()`만 창을 만듦) 이 경쟁이 존재하지 않아 영향 없음. 진단 코드(`debug_trace` 함수, 각 지점의 임시 로그)는 원인 확정 후 전부 원복.

검증: `cargo fmt --check`/`clippy --workspace --all-features`/`test --workspace`(13+4개) 전부 통과. **사용자가 디버그 번들로 재현 → 수정 → 재현 안 됨(창 하나만 뜸)까지 실기로 재확인 완료.** 테스트용 디버그 번들(`target/debug/bundle`)과 로그 파일은 확인 후 정리.

## 인쇄 시 컨텐츠 잘림 방지 (신규)

**버그 수정(사용자 리포트): 인쇄 시 페이지가 넘어가는 지점에서 컨텐츠가 중간에 잘림.** "인쇄할 때 페이지가 넘어가는 부분에서 일부 컨텐츠가 중간에 걸려 잘리는 문제가 있어." 기존에는 `@media print`에 `.lm-markdown pre`(코드블록)만 `break-inside: avoid`가 있었고, 다른 블록 요소들은 브라우저가 페이지 경계에서 그냥 반으로 잘라 다음 페이지로 이어붙였음.

수정: `layout.css`의 `@media print`에서
- `.lm-markdown pre`/`img`/`blockquote`/`li`/`tr`, `.lm-mermaid`(다이어그램), `.lm-math-block`(KaTeX 블록 수식)를 한 셀렉터로 묶어 전부 `break-inside: avoid`(+legacy `page-break-inside: avoid`) — 이 "원자적" 블록들은 남은 공간에 안 들어가면 통째로 다음 페이지로 넘어감(페이지 하단에 약간의 빈 공간이 생길 수 있지만, 잘리는 것보다 나음). 기존에 코드블록 전용으로 있던 규칙을 이 목록에 합쳐서 정리(중복 규칙 제거).
- `h1`~`h6`에 `break-after: avoid`(+`page-break-after: avoid`) 추가 — 헤딩만 페이지 맨 아래 홀로 남고 본문은 다음 페이지로 넘어가 버려서 헤딩과 내용이 분리돼 보이는 걸 방지(내용과 "붙어서" 페이지가 넘어가도록).

검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.

**후속 리포트(사용자): "일반 텍스트나 수식이 잘리는 경우도 있어. 결국 모든 컨텐츠가 잘릴 수 있다는 거 아닐까?"** — 정확한 지적이었음. 일반 단락 텍스트나 인라인 수식(`.lm-math`, block 아닌 쪽)은 애초에 `break-inside: avoid`를 걸어줄 특정 요소가 마땅치 않아서, 요소 하나하나를 쫓아가는 위 방식은 근본적으로 한계가 있었음.

**원인으로 판단했으나 틀렸음, 되돌림**: `.lm-markdown { zoom: var(--lm-zoom); }`(M7의 CSS `zoom`)이 인쇄 시에도 그대로 적용돼 페이지 분할 계산을 흐트러뜨리는 게 근본 원인이라고 보고 `@media print`에 `.lm-markdown { zoom: 1; }`을 추가했었음. **사용자가 바로 정정**: "아냐. 이 문제가 아냐. 화면 zoom level에 따라 인쇄 크기도 달라지는 건 마음에 드는 기능이었어. 이건 원복해. 문제는 첨부처럼 페이지가 나뉘면서 하나의 컨텐츠가 위 아래로 잘리는 현상이야." — zoom이 인쇄 크기에 그대로 반영되는 건 의도된, 선호하는 동작이었고 이 버그의 원인이 아니었음. `.lm-markdown { zoom: 1; }`을 삭제해 원복(1차 수정의 요소별 `break-inside`/`break-after` 규칙은 그대로 유지).

검증(zoom 원복 후): 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.

**진단(직접 재현): WebKitGTK가 `break-inside`/`page-break-inside: avoid`를 사실상 전혀 지키지 않는다.** 사용자가 보내려던 스크린샷을 이 세션에서는 못 받았지만("ㄱ" 모양 ASCII 그림으로 대신 설명 — 박스 모서리 도형이 페이지 경계에서 위/아래로 잘리는 모습), 실제 앱과 동일한 WebKitGTK 4.1(Ubuntu 24.04 번들 버전, 2.52.3)로 직접 재현해서 확인함.

- **재현 방법**: `npm run dev`(Vite) + `python3` + PyGObject(`WebKit2` 4.1)로 실제 `WebKitWebView`를 띄우고 `samples/all-features.md`를 `lm-file-drop` 이벤트로 주입, `WebKitPrintOperation`(GTK의 "Print to File" 백엔드로 PDF 직접 export)으로 인쇄 → `pdftoppm`으로 PNG 변환해서 페이지별로 직접 확인(Chromium 헤드리스로도 같은 문서를 확인했으나, 폰트 메트릭 차이로 페이지 나뉘는 위치 자체가 달라져서 이 버그가 우연히 재현 안 됨 — 실제 버그 검증에는 WebKitGTK 쪽 결과가 유효함).
- **확인된 사실**: `.lm-math-block`(KaTeX 블록 수식, `break-inside: avoid` 있음)이 페이지 2→3 경계에서 정확히 반으로 잘림(시그마 기호와 분수가 위/아래로 분리) — 사용자가 그린 "ㄱ" 그림과 정확히 일치하는 현상. `.lm-math-block`뿐 아니라 그 안의 KaTeX 자체 래퍼(`.katex-display`, `.katex`)에도 동일하게 `break-inside: avoid`를 중복 선언해봤지만 효과 없음. `.lm-math-block`을 `display: table`로 바꿔도 효과 없음(둘 다 실험 후 되돌림, 코드에는 안 남음).
- **결정적 확인**: 원래 있던 문서에 필러 문단을 끼워 넣어 코드블록(`.lm-markdown pre`, `break-inside: avoid` 있음)과 mermaid 다이어그램(`.lm-mermaid`, `break-inside: avoid` 있음)이 페이지 경계에 걸리도록 강제로 재배치했더니, **이것들도 똑같이 위/아래로 잘림**. 즉 원래 문서에서 mermaid/표/blockquote가 안 잘렸던 건 `break-inside: avoid`가 작동해서가 아니라, 우연히 페이지 경계에 걸리지 않았을 뿐이었음.
- **결론 및 사용자 결정(받아들이고 넘어가기): 이 WebKitGTK 버전은 `break-inside`/`page-break-inside`(레거시 포함)를 사실상 존중하지 않는다** — 요소 종류나 CSS 값을 아무리 바꿔도 CSS만으로는 고칠 수 없는, 엔진 자체의 인쇄 페이지네이션 한계로 보임(비-Mac WebKit 포트의 인쇄 지원이 Blink/Gecko보다 약하다는 건 알려진 문제 범주). 진짜 고치려면 JS로 각 "보호 대상" 요소의 위치를 계산해서 페이지 경계에 걸릴 것 같으면 그 앞에 강제로 여백을 넣어 다음 페이지로 밀어내는 수동 페이지네이션(자체 구현 또는 Paged.js 같은 라이브러리)이 필요한데, 세 가지 선택지(직접 JS 구현/Paged.js 도입/한계로 받아들이기)를 제시한 결과 **"알려진 한계로 받아들이고 넘어가기"로 확정** — 추가 코드 변경 없음.
- 기존 요소별 `break-inside`/`break-after` 규칙(1차 시도)은 그대로 코드에 남아있음 — 이 WebKitGTK 버전에서는 효과가 없는 것으로 확인됐지만, 다른 엔진(Chromium 등, 실제로 페이지 경계에 걸리는 경우)이나 향후 WebKitGTK 버전 업데이트에서는 여전히 유효할 수 있어 해로울 게 없어 제거하지 않음.

## 앱 아이콘 (신규, M8)

사용자가 `npm run tauri icon ./app-icon.png`(1024x1024 소스, 저장소 루트 `app-icon.png`)를 직접 실행해서 `src-tauri/icons/` 아래 전체 아이콘 세트(32x32/128x128/128x128@2x/icon.icns/icon.ico + Windows Store/Android/iOS용 나머지 크기들)를 재생성함 — 이미 커밋까지 완료된 상태에서 "앱에 아이콘 적용 먼저 하자"는 요청으로 확인 작업 진행.

- **`tauri.conf.json`의 `bundle.icon`은 코드 변경이 필요 없었음** — `tauri init --ci` 스캐폴딩(M6) 때부터 이미 `icons/32x32.png`/`icons/128x128.png`/`icons/128x128@2x.png`/`icons/icon.icns`/`icons/icon.ico`를 정확히 그대로 참조하고 있어서, `tauri icon` 명령이 그 자리에 파일만 다시 생성하면 자동으로 적용됨(개별 창에는 별도 `icon` 필드가 없음 — Tauri v2 스키마에 `bundle.icon`만 존재, 확인함).
- **검증**: `file` 명령으로 `icon.icns`(Mac OS X icon)/`icon.ico`(Windows icon resource)/`icon.png`(512x512 PNG)가 전부 유효한 포맷인지 확인. `cargo check -p app`/`cargo fmt --check`/`cargo clippy --workspace --all-features` 전부 통과 — config 자체의 유효성(Tauri가 빌드 시 `tauri.conf.json`을 파싱/검증)도 같이 확인됨.
- **실제 창/번들 아이콘 표시 여부는 육안 확인 필요**: `npm run tauri dev`로 뜬 창의 타이틀바/작업표시줄 아이콘, 추후 `npm run tauri build`(M8의 다른 작업, 아직 미착수)로 만든 번들의 아이콘은 이 세션에서 시각적으로 확인 안 함(방침대로 사용자 몫).
- 프론트엔드 브라우저 탭 파비콘은 이번 요청과 별개(Tauri 네이티치 아이콘 vs. 브라우저 파비콘) — `frontend/index.html`에 현재 파비콘 링크가 없다는 것만 확인해둠, 필요하면 별도로 요청.

### 버그 수정(사용자 리포트): `npm run tauri dev`로 확인했는데 dock에 아이콘이 적용 안 됨

`tauri.conf.json`의 `bundle.icon` 소스코드(`tauri-codegen`의 `find_icon()`)를 직접 읽어서 두 가지를 확인:

1. **작은 개선**: Linux(Unix)의 "기본 창 아이콘"은 `bundle.icon` 배열에서 `.png`로 끝나는 **첫 번째** 항목을 그대로 쓴다(`config.bundle.icon.iter().find(predicate)`) — 배열에 `icons/32x32.png`가 `icons/icon.png`(512x512)보다 먼저 있어서, 창 자체의 아이콘이 지금까지 아주 작은 32x32짜리로 박혀 있었음. `icons/icon.png`를 배열 맨 앞에 추가해서 고쳤다(창/타이틀바/alt-tab용 아이콘이 더 선명해짐 — 다만 이건 "dock" 문제의 직접적 원인은 아님, 아래 참고).
2. **진짜 원인**: `tauri-2.11.5/src/app.rs`를 보면, GTK의 application ID(Wayland에서 데스크톱 셸이 실행 중인 창을 `.desktop` 파일과 매칭하는 데 쓰는 값)는 **`app.enableGTKAppId`(스키마 확인: 정확히 이 대소문자, camelCase 아님)가 `true`일 때만** `identifier`(`dev.lightmark.viewer`) 값으로 설정되고, 기본값은 `false` — 즉 지금까지는 **앱에 GTK app_id 자체가 전혀 없었음**. 사용자 세션이 Wayland(`XDG_SESSION_TYPE=wayland`, 확인함)라서, GNOME Shell의 dock은 실행 중인 창을 app_id로 `.desktop` 파일과 매칭해 아이콘을 찾는데, app_id가 아예 없으니 아무 `.desktop` 파일이 있어도 매칭될 수가 없었음 — `.desktop` 파일 유무와 무관한, 더 근본적인 원인.

**수정**: `tauri.conf.json`의 `app`에 `"enableGTKAppId": true` 추가. `cargo check -p app`/`cargo fmt --check`/`cargo clippy --workspace --all-features`/`cargo test --workspace`(13개) 전부 통과. **실기로 재확인**: `npm run tauri dev`를 재시작한 뒤 `busctl --user list`로 확인 — 이전에는 없던 `dev.lightmark.viewer`(+ `.SingleInstance`) D-Bus 이름을 앱이 실제로 세션 버스에 등록한 것을 확인함(= app_id가 이제 실제로 적용됨).

**사용자 승인 하에 로컬 전용 파일 추가(저장소에 커밋 안 됨)**: `~/.local/share/applications/dev.lightmark.viewer.desktop`(`Icon=`은 `src-tauri/icons/icon.png` 절대경로, `StartupWMClass=dev.lightmark.viewer`로 app_id와 매칭) — dev 모드로 띄운 창도 dock이 바로 인식할 수 있도록. 이 파일은 사용자 머신에만 있는 개발 편의용이고, 실제 배포되는 앱은 M8에서 `npm run tauri build`로 패키징하면 `bundle.icon`/`identifier` 기반으로 `.desktop` 파일이 자동 생성되므로 별도 조치 불필요.

### 후속 리포트(사용자, 2건): dock 아이콘 여전히 안 보임 + Apps 목록 아이콘 클릭해도 앱 실행 안 됨

"`npm run tauri dev` 명령으로는 여전히 icon이 보이지 않는데, .desktop 파일을 만들어서 apps에 포함된 앱 목록에서는 아이콘이 보여. 그런데 앱 목록에서는 아이콘을 클릭해도 앱이 실행되지 않네." — 둘 다 원인 확인/수정:

- **아이콘 클릭해도 실행 안 됨**: `desktop-file-validate`로 확인해보니 처음 만든 `Exec=bash -c 'npm run tauri dev'`가 Desktop Entry 스펙상 잘못된 따옴표 처리였음(`error: value ... contains a reserved character ''' outside of a quote`) — GLib 런처가 아예 파싱에 실패해서 클릭해도 조용히 아무 일도 안 일어났던 것. `Exec=npm run tauri dev`(불필요한 `bash -c` 래핑 제거)로 단순화하고, `Path=/home/tramamte/src/rust/lightmark`(작업 디렉터리)를 추가해서 `package.json`/`tauri.conf.json`을 제대로 찾도록 함. `gio launch ~/.local/share/applications/dev.lightmark.viewer.desktop`(더블클릭 시뮬레이션)로 vite+tauri dev+앱 전체가 실제로 정상 기동하고 `busctl --user list`에 `dev.lightmark.viewer`가 뜨는 것까지 확인.
- **`npm run tauri dev`로 띄운 창의 dock 아이콘은 여전히 안 보임**: GNOME Shell의 Wayland 앱 아이콘 매칭은 실행 중인 창의 app_id를 `.desktop` **파일명**(확장자 제외)과 직접 비교하는 걸 우선시하고, `StartupWMClass`는 X11 시절 창 위주의 보조 수단일 뿐 — 파일명이 `lightmark-dev.desktop`이라 실제 app_id(`dev.lightmark.viewer`)와 안 맞았던 게 원인. 파일명을 정확히 `dev.lightmark.viewer.desktop`으로 변경(내용의 `StartupWMClass=dev.lightmark.viewer`는 보조 수단으로 그대로 유지)해서 해결 — 이제 파일명 자체가 app_id와 완전히 일치하므로, 터미널에서 직접 `npm run tauri dev`로 띄우든 Apps 목록/`gio launch`로 띄우든 같은 app_id를 쓰는 한 매칭돼야 함.

검증 후 앱을 `gio launch`로 다시 띄워둔 상태로 남겨뒀으나, **사용자가 재확인 후 "여전히 안 보여"로 리포트** — 자동화된 진단 도구(xprop/wmctrl)로는 네이티브 Wayland 창을 못 봐서 더 이상 추론만으로는 원인을 좁히기 어려운 상태(GNOME Shell의 Looking Glass Eval은 기본 비활성화라 개발자 도구를 켜야 직접 조회 가능한데, 이건 사용자 계정 설정을 바꾸는 일이라 먼저 물어봄). **사용자가 "일단 미뤄둘게. 패키징 이후 다시 보자"로 보류 결정** — M8 패키징(AppImage/deb/rpm)이 진짜 `.desktop` 파일을 자동 생성하고 나면, 지금 겪는 "dev 모드 전용" 문제 자체가 사라질 가능성이 높아서 그때 다시 보는 게 합리적. 지금까지 한 변경(`enableGTKAppId`, `bundle.icon` 순서, 로컬 `.desktop` 파일)은 전부 무해하니 그대로 둠 — 로컬 `.desktop` 파일은 원래도 저장소에 커밋 안 되는 사용자 머신 전용 파일.

## 버그 수정(사용자 리포트): 새 창이 뜰 때 TOC가 잠깐 보였다가 사라짐

"지금 창이 새로 뜰 때 잠깐 toc 화면이 보였다가 사라져. 기본값을 안 보이는걸로 해서, 처음 깜빡임을 없애줘."

**원인**: `frontend/index.html`의 정적 마크업 `<div class="lm-content">`에는 애초에 숨김 클래스가 없어서, `layout.css`의 기본(클래스 없는) 상태가 그대로 페인트됨 — `.lm-content`는 기본이 2단 그리드(`grid-template-columns: var(--lm-toc-width) 1fr`)이고 `lm-toc { display: block; }`도 태그 셀렉터라 커스텀 엘리먼트가 아직 upgrade되기 전부터 바로 적용돼서, 첫 페인트에 TOC가 보임. `main.ts`는 `<script type="module">`이라 파싱 이후에 실행되고, 게다가 `const backend = await createBackend();`라는 top-level await 때문에(Tauri 모드에서는 `./tauri` 동적 import까지 포함) `updateTocDisplay()`(TOC를 실제로 숨기는 유일한 코드)가 실행되기까지 진짜 지연이 있음 — 그 사이의 간극이 눈에 보이는 깜빡임이 됨. `updateTocDisplay()` 자체의 로직(`hasDocument`가 `false`인 동안은 `tocVisible` 값과 무관하게 항상 숨김)은 원래도 맞았음 — DOM에 반영되는 시점만 늦었던 것.

**수정**: `frontend/index.html`의 `<div class="lm-content">`를 `<div class="lm-content lm-toc-hidden">`로 정적 마크업 단계에서부터 미리 숨겨진 상태로 시작하도록 변경(1줄). `updateTocDisplay()`는 상태가 바뀔 때마다(초기 로드, config 로드 완료, 파일 열림, 토글 클릭) 이 클래스를 무조건 다시 계산해서 갱신하므로, 마크업에 미리 넣어둔 클래스와 충돌 없음 — TOC 토글 기능 자체는 전혀 안 바뀜.

검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과.

## 문서 전체 업데이트 (신규)

"문서 전체 업데이트" 요청으로 `docs/PRD.md`/`ARCHITECTURE.md`/`CONFIG_SPEC.md`/`IPC_SPEC.md`/`UI_SPEC.md`/`TASKS.md`/`PLAN.md`를 실제 코드와 다시 전수 대조(탐색 에이전트로 1차 감사 후 직접 확인). CONFIG_SPEC의 필드 목록(12개 전부)/IPC_SPEC의 커맨드 8개/컴포넌트 목록/멀티 윈도우 서술/TASKS 체크 상태/print·zoom·TOC-깜빡임 관련 서술은 전부 코드와 일치 확인, 별도 수정 없음. 실제로 어긋난 것들 수정:

- **`docs/PLAN.md`의 "BackendApi (계약 고정)" 스니펫**: "현재 기준"이라고 써놨는데 정작 멀티 윈도우 지원에서 이미 지워진 `getInitialPath?()`/`onOpenPath?()`를 그대로 보여주고 있었음 — `onFileDrop?()`/`openWindow?()`로 교체.
- **`frontend/src/platform/tauri.ts`의 헤더 주석**: "7 IPC commands"라고 돼 있었는데 멀티 윈도우 지원에서 `open_new_window`가 추가돼 실제로는 8개 — 숫자만 수정.
- **`frontend/src/types/config.ts`의 `viewerMaxWidth` 주석**: "lm-statusbar의 width input을 통해 사용자가 입력"이라고 돼 있었는데, 이 입력창은 이미 M7 중 읽기 전용 표시로 되돌아간 지 오래(HANDOFF.md 상단 M7 항목 참고) — config.json 편집 전용이라는 실제 동작으로 주석 수정.
- **`docs/UI_SPEC.md`의 StatusBar 서술**: "Filename, 폭 제한 표시, Theme, Zoom"으로 `Theme`이 남아있었는데, `lm-statusbar.ts`에는 filename/폭 제한/zoom(+dev 전용 perf)만 있고 테마 표시는 애초에 구현된 적이 없음(코드의 "Theme field is filled in by the theme engine (M3)"라는 주석만 남아있던 계획 단계 흔적) — `Theme` 항목 삭제, 그 주석도 같이 정리.
- **`docs/PLAN.md`의 M1 디렉토리 구조 스니펫**: 멀티 윈도우 지원에서 추가된 `backend/src/fsutil.rs`가 빠져있어서 한 줄 추가.

검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) + `cargo fmt --check` 전부 통과.

**발견했던 것 — TOC Resizable 미구현, 사용자 확인 후 구현 완료**: `CLAUDE.md`(프로젝트 최상위 지침)의 UI Rules가 TOC 요구사항으로 "toggleable, **resizable**, hierarchical, active section highlighting"을 명시하고 `docs/UI_SPEC.md`도 "Resizable"이라고 적어뒀는데, 실제 코드(`lm-toc.ts`, `layout.css`)엔 리사이즈 핸들/드래그 로직이 전혀 없고 TOC 폭은 `--lm-toc-width: 280px` 고정값뿐이었음 — TOC Toggle(M7)은 구현됐지만 Resizable은 애초에 구현된 적이 없었음. 문서만 코드에 맞춰 조용히 낮추면(예: "Resizable" 삭제) `CLAUDE.md`가 못박은 요구사항을 임의로 낮추는 셈이라 사용자에게 확인 → **"지금 구현"으로 결정**, 아래 "TOC Resizable 구현" 참고.

### TOC Resizable 구현 (신규)

Zoom/TOC Toggle과 같은 전례(세션 전용, config.json에 안 씀)를 그대로 따름 — `CLAUDE.md`의 "No graphical settings editor"는 config.json 자체의 편집 경로 얘기고, 세션 중 UI로 조절 가능한 값(zoom, TOC 표시 여부)은 이미 그 규칙과 별개로 취급돼왔음. TOC 폭도 같은 성격이라 별도 config 필드 신설 없이 세션 전용으로 구현 — 앱을 다시 시작하면 `tokens.css`의 기본값(280px)으로 돌아감.

- **`frontend/src/components/lm-toc.ts`**: light DOM 구조를 `this` 직속 텍스트/리스트 하나에서 `.lm-toc-list`(TOC 항목 `<ul>`을 담는 컨테이너) + `.lm-toc-resize-handle`(드래그 핸들) 두 자식으로 분리 — `setToc()`가 매번 `replaceChildren()`으로 통째로 지우던 걸 `.lm-toc-list`만 지우도록 바꿔서, 리사이즈 핸들이 파일을 열 때마다(=`setToc()` 재호출마다) 같이 지워지지 않게 함. 핸들은 `pointerdown` → `setPointerCapture()` → `pointermove`(드래그 시작 폭 + 이동량, `MIN_WIDTH`(160)~`MAX_WIDTH`(560)로 클램프해서 `document.documentElement.style.setProperty('--lm-toc-width', ...)`) → `pointerup`/`pointercancel`(해제)의 표준 포인터 캡처 패턴 — `document` 레벨 리스너를 따로 안 둬도 핸들 밖으로 나간 드래그까지 그대로 추적되고, 컴포넌트가 사라져도 별도 정리가 필요 없음.
- **`frontend/src/styles/layout.css`**: `lm-toc`에 `position: relative`(핸들의 위치 기준점) 추가. `.lm-toc-resize-handle`은 `lm-toc`의 오른쪽 경계에 걸치는 6px짜리 투명한 스트립(`cursor: col-resize`, `touch-action: none`으로 터치 드래그가 페이지 스크롤로 오인되는 것 방지), hover/active 시에만 `--lm-color-accent`로 옅게 틴트. 기존 `lm-toc > ul` 셀렉터(최상위 리스트 전용 패딩)는 `<ul>`이 이제 `.lm-toc-list` 안에 한 단계 더 들어가 있으므로 `.lm-toc-list > ul`로 수정.

검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과. `npm run tauri dev`로 앱이 크래시 없이 뜨는 것까지 확인(`busctl` 창 1개)했으나, 실제 마우스 드래그로 폭이 바뀌는지는 이 세션의 Wayland 환경에서 마우스 조작 자동화가 안 돼서 직접 못 눌러봄 — 사용자가 직접 드래그해서 확인 필요.

### 버그 수정(사용자 리포트): TOC에 세로 스크롤이 있으면 resize가 안 되고, 하면 안 된다고 이미 못박은 가로 스크롤바가 생김

"새로 스크롤이 있는 상태에서는 resize가 안 되고, 절대 하지 말라고 한 가로 스크롤바가 생겼어."

**원인 진단(헤드리스 Chrome CDP로 직접 재현·측정, 추측 아님)**: `npm run dev`(Vite, Web 모드) + 헤드리스 Chrome을 CDP로 띄워 `lm-toc.setToc()`에 헤딩 200개를 주입해서 실제로 스크롤이 생기는 상태를 만들고 `getBoundingClientRect`/`scrollWidth`/`elementFromPoint` 등으로 직접 측정:

- **가로 스크롤 원인**: 처음 구현에서 핸들을 `.lm-toc-resize-handle { position: absolute; right: -3px; ... }`로 `lm-toc` 자기 경계 밖으로 3px 튀어나오게 배치했었음 — `lm-toc`가 `overflow-y: auto`인 상태에서 자식이 박스 밖으로 넘치면, `overflow-wrap`/`word-break` 수정 때 이미 한 번 겪었던 것과 같은 "overflow-x가 암묵적으로 auto가 되는" 계산이 다시 발동해서 진짜 가로 스크롤바가 생김 — 실측(`toc.scrollWidth > toc.clientWidth`)으로 확인.
- **세로 스크롤 있을 때 resize 안 되는 원인**: 같은 배치 때문에 핸들의 히트 영역이 실제 세로 스크롤바가 그려지는 자리와 겹쳐서, 그 자리를 클릭하면 브라우저가 스크롤바 쪽으로 입력을 먼저 가로챔 — 핸들까지 포인터 이벤트가 아예 도달을 못 함.
- **수정**: `.lm-toc-list`(스크롤되는 리스트, `flex: 1 1 auto`)와 `.lm-toc-resize-handle`(고정폭 6px)을 `lm-toc { display: flex }`의 서로 겹칠 수 없는 형제 자식으로 재배치 — 절대 위치 대신 flex 레이아웃이라 둘이 물리적으로 같은 픽셀을 차지할 수 없음. `.lm-toc-list`엔 `overflow-x: hidden`도 추가(벨트+브레이스).
- **2차 발견(같은 헤드리스 테스트로 잡음): flex/grid item의 `min-height: auto` 함정.** 위 구조로 바꾸고 다시 측정해보니, 이번엔 `lm-toc` 자체의 높이가 `.lm-content` 그리드 셀 고정 높이(439px)가 아니라 컨텐츠 전체 높이(4572px)로 늘어나 있었음 — TOC 자체가 스크롤되는 대신 화면 전체를 그만큼 밀어버리는 상태. 원인: `overflow-y: auto`를 `lm-toc`(그리드 아이템) 자신에게 직접 걸어두면 그 자동 최소 크기가 0으로 계산되는데, 스크롤 담당을 자식(`.lm-toc-list`)으로 옮기면서 `lm-toc` 자신은 그 계산 혜택을 못 받게 됨 — 그리드 아이템의 기본 `min-height: auto`가 살아나 컨텐츠 높이만큼 그리드 셀을 밀어버림. `lm-toc`에 `min-height: 0` 명시로 수정.
- **재검증(같은 헤드리스 테스트)**: 수정 후 `lm-toc` 높이는 다시 439px로 고정, `.lm-toc-list.scrollHeight(4572) > clientHeight(439)`로 실제 내부 스크롤 확인, `toc.scrollWidth === toc.clientWidth`로 가로 스크롤 없음 확인, 핸들 중심 좌표에서 `document.elementFromPoint()`가 정확히 `lm-toc-resize-handle`을 반환하는 것까지 확인(세로 스크롤이 있는 상태에서도 핸들이 히트됨) — 두 리포트 모두 실측으로 해결 확인.

검증: 프론트(`lint`/`typecheck`/`build`/`test`, 30개) 전부 통과 + 위 헤드리스 Chrome 실측. 실제 마우스 드래그 자체는 여전히 사용자 몫(이 세션 환경에서 자동화 불가).

**최종 확인(사용자): "좋아. 모두 해결됐네."** — TOC Resizable 자체와 위 두 버그 수정(가로 스크롤바 생김, 세로 스크롤 있을 때 resize 안 됨) 모두 실제 앱에서 확인 완료.

## 개선(사용자 요청, 신규): 상태바 렌더링 시간 표시를 항상 켜둠

사용자가 "상태바에 렌더링 시간 표시 기능이 사라졌다"고 리포트 — 버그가 아니라 M2부터 있던 의도된 동작이었음(`lm-statusbar.ts`의 `.lm-status-perf`가 `import.meta.env.DEV`로 게이팅돼 있어서 `npm run tauri dev`/`npm run dev`에서만 보이고, `npm run tauri build`로 만든 빌드(아까 `Opened` 버그 검증용으로 만든 디버그 번들 포함)에서는 항상 안 보임 — 사용자가 그 디버그 번들을 보고 있었던 것). 설명을 듣고 사용자가 "이 기능은 그냥 항상 켜두는 게 좋겠다"고 요청 → `import.meta.env.DEV` 게이팅 제거, 빌드 모드와 무관하게 항상 표시. `docs/UI_SPEC.md`(StatusBar 필드 목록에 렌더링 시간 추가)/`docs/PLAN.md`(M2 검증 문구의 "dev 전용" 표현 정정)도 같이 수정.

검증: 프론트 `lint`/`typecheck`/`build`/`test`(30개) 전부 통과.

## macOS 패키징 (신규, M8) — 팀원 등 소수 배포용

Apple Developer Program(유료, 연 $99) 미가입 상태 — 서명/공증(notarization) 없이 소수 배포하는 방향으로 확정. 이번엔 팀원 전부 Apple Silicon이라 유니버설 바이너리는 불필요, arm64 전용으로 진행.

- **빌드**: `npm run tauri build`(릴리스 프로필) → `src-tauri/target/release/bundle/macos/LightMark.app`(15MB 바이너리) + `.../dmg/LightMark_0.1.0_aarch64.dmg`(6.6MB).
- **서명**: 추가 조치 없이 `adhoc,linker-signed`로 자동 서명됨(Apple Silicon에서 Mach-O 바이너리는 최소 ad-hoc 서명이 있어야 실행되는데, 컴파일/링크 과정에서 자동으로 붙음 — `codesign -dv`로 확인). Apple 발급 Developer ID 서명이 아니라서 Gatekeeper 경고는 그대로 남음 — 받는 사람이 `xattr -cr`로 quarantine 속성을 지우거나 시스템 설정에서 "그래도 열기"로 우회해야 함(안내문 전달).
- **실기 확인**: 바이너리를 직접 실행해서 크래시 없이 살아있는 것 확인. `open`/`open -a` 명령으로는 이 자동화 세션에서 조용히 실패했음(Launch Services 미등록 관련 세션 한정 이슈로 추정 — 아까 `Opened` 버그 디버그 번들 때는 `lsregister -f`로 등록해서 `open -a`가 잘 됐었음) — 실제 최종 사용자는 Finder 더블클릭으로 열 것이라 문제 없음.

## 개선(사용자 요청, 신규): 키보드 단축키 추가

`Cmd`(macOS)/`Ctrl`(Windows/Linux) 조합 6종 추가 — `Cmd+O`(Open)/`Cmd+P`(Print)/`Cmd+B`(TOC 토글)/`Cmd+=`·`Cmd+-`·`Cmd+0`(Zoom)/`Cmd+,`(Config 폴더)/`Cmd+Shift+R`(Apply). 사용자에게 범위를 먼저 확인(멀티 셀렉트 질문)받아 About은 제외.

- `main.ts`에 `window.addEventListener('keydown', ...)` 하나로 구현 — 각 단축키가 해당 툴바 버튼과 **똑같은 커스텀 이벤트**(`lm-open`/`lm-print`/`lm-toc-toggle`/`lm-zoom-*`/`lm-config-folder`/`lm-reload-config`)를 `toolbar` 엘리먼트에 직접 dispatch — 동작 로직은 단일 소스(버튼 클릭 핸들러)를 그대로 재사용. 다만 `disabled` 버튼 속성은 프로그램적 dispatch를 막지 못하므로, 각 버튼이 이미 갖고 있는 게이트 조건(`hasDocument`/`capabilities.configFile`)을 단축키 핸들러에도 그대로 복제.
- `metaKey || ctrlKey`로 판단(플랫폼 감지 없이 둘 다 허용 — macOS에서 Ctrl+O도 같이 되는 것 정도는 무해).
- **`Cmd+T`(TOC에 자연스러워 보이는 후보)는 의도적으로 안 씀** — 실제 브라우저(Web/Dev 모드)에서 새 탭 열기로 예약된 진짜 브라우저 단축키라 페이지 JS의 `preventDefault()`로도 못 막음(Cmd+W/Cmd+N/Cmd+Q와 같은 부류) — 대신 VS Code 등의 "사이드바 토글" 관례인 `Cmd+B` 채택. **`Cmd+R`도 피함** — 일반적인 페이지 새로고침 단축키와 겹쳐서 Apply엔 `Cmd+Shift+R` 사용.
- `docs/UI_SPEC.md`에 전체 단축키 표 추가.

검증: 프론트 `lint`/`typecheck`/`build`/`test`(30개) 전부 통과.

### 버그 수정(사용자 리포트): Apply(`Cmd+Shift+R`)만 동작 안 함, 나머지 5개는 정상

**원인**: 판별 기준이 `event.key`(활성 입력 소스/레이아웃이 만들어내는 "문자")였는데, 한국어 입력 소스가 켜져 있으면 Shift+R 조합의 `event.key`가 `'R'`이 아니라 한글 자모로 나옴(한글 2벌식에서 Shift는 "대문자"가 아니라 쌍자음을 만드는 용도라 매핑이 다름) — 그래서 `case 'R':`가 조용히 매칭 실패. Shift가 없는 나머지 5개(Cmd+O/P/B/,/0, Cmd+=/-)는 이 문제가 없어서 전부 정상 동작했던 것.

**수정**: 판별 기준을 `event.key`에서 `event.code`(활성 레이어/입력 소스와 무관하게 항상 같은 값을 주는 "물리적 키 위치", 예: `KeyR`, `Equal`, `Digit0`)로 전부 교체. Shift 여부는 `code`에 안 실리므로 `KeyR` 케이스에서 `event.shiftKey`를 별도로 확인. 덕분에 `Equal` 하나로 `Cmd+=`/`Cmd+Shift+=`(=`Cmd++`) 둘 다 자연스럽게 커버되어 기존의 `'='`/`'+'` 두 케이스도 하나로 줄었음.

검증: 프론트 `lint`/`typecheck`/`build`/`test`(30개) 전부 통과. **사용자가 6개 단축키 전부 재확인 완료**("확인했어. 다 잘 되네").

## 재패키징

키보드 단축키/상태바 렌더링 시간 변경사항을 포함해 `npm run tauri build`로 macOS 릴리스 번들 재생성. 위 "macOS 패키징" 절차 그대로(ad-hoc 서명 자동, 바이너리 직접 실행으로 크래시 없음 확인) — 새로 기록할 내용 없음, 결과물(`.app`/`.dmg`) 경로만 동일하게 갱신됨.

## `README.md` 신규 작성 (사용자 요청)

저장소 루트에 사용자 대상 `README.md`를 처음으로 작성함(그 전까지 없었음). 요청받은 항목 그대로: 앱 이름/버전/개발자(`core/appInfo.ts`의 `APP_NAME`/`APP_VERSION`/`APP_AUTHOR`와 일치), 소개, 특징, 기능, 설치(macOS만 — Windows/Linux는 "추후 추가"로 명시), 단축키(`docs/UI_SPEC.md`의 표 재사용). 이어서 사용자가 "설정파일 수정 방법도 추가해줘"로 한 섹션 더 요청 → 위치(OS별 3개 경로)/Config 버튼으로 여는 법/Apply로 재시작 없이 적용/파일 깨짐·삭제 시 자동 복구/필드 12개 전체를 타입·기본값·설명 표로 정리해서 추가(`docs/CONFIG_SPEC.md`/`backend/src/config.rs`의 스키마와 대조해서 작성, 값 일치 확인).

**유지보수 참고(다음 세션들을 위해)**: `README.md`는 이제 기능/설정 필드/단축키가 바뀔 때마다 `docs/UI_SPEC.md`/`docs/CONFIG_SPEC.md`와 함께 갱신해야 하는 대상임 — 지금까지는 `docs/*.md`만 챙기면 됐지만 앞으로는 이 파일도 같이 봐야 함. 검증 대상은 아님(마크다운 산문이라 lint/build 대상 없음) — 내용이 코드/스펙과 실제로 일치하는지는 매번 직접 대조 필요.

## 다음에 할 일 (사용자 지정 대기)

**진짜 남은 것:**
- **멀티 윈도우/인스턴스 지원의 GUI 조작 부분 실기 확인(진행 중)**: macOS 세션에서 실기 확인 진행 — CLI 재실행으로 새 창이 뜨는 것 확인됨. 그 과정에서 `PristineWindow`(빈 창 재사용)가 macOS에서 실제로 관찰됨: 빈 창이 있는 상태에서 문서를 열면 그 빈 창이 재사용(창 개수 안 늘어남)되고, 그 다음 문서부터는 진짜 새 창이 열림 — 사용자가 직접 겪고 리포트, **"지금 동작(플랫폼 무관 없이 macOS에서 무기한 재사용) 그대로 유지"로 확정**(플랫폼 무관 일반화나 콜드스타트 순간으로 범위 축소 둘 다 기각). 코드 변경 없음. **drag&drop 다중 파일도 실기 확인 완료**(빈 창에 여러 파일을 드롭하면 pristine 재사용 레이스로 하나만 열리던 버그 발견/수정 → 재확인까지 완료, 위 "버그 수정" 참고) — 이 동작(첫 파일은 창 교체, 나머지는 새 창)을 정식 설계 원칙으로 확정.

**창 닫기 시 watcher 정리도 실기 확인 완료.** `ps -M`으로 프로세스 스레드 수를 관찰하니 창을 닫아도 스레드 수가 즉시 줄지 않고 서서히 줄어드는 게 보여서, 우리 코드가 정리를 놓치는 건지 확인이 필요했음 — `backend::FileWatcher`에 임시 `Drop` 로그, watcher 백그라운드 스레드의 `rx.recv()` 루프가 실제로 끝나는 지점에도 임시 로그를 추가해서 재현. **결과: 두 로그가 창을 닫는 순간 거의 동시에 찍힘** — `.on_window_event`의 `Destroyed` 핸들러가 `WatcherRegistry`에서 `remove()`하는 순간 `FileWatcher`(그리고 그 안의 `notify::RecommendedWatcher`, 백그라운드 스레드까지)가 정확히 동기적으로 즉시 정리된다는 뜻. `ps -M`에서 보였던 "서서히 줄어드는" 스레드는 이 watcher와 무관한, Tauri/WebKit 자체의 내부 스레드풀(WebKit 자체 스레드, Tokio 워커 등) 정리 지연으로 판단 — LightMark 코드의 문제가 아니고, 애초에 우리가 제어할 수 있는 영역도 아님. 진단 코드는 확인 후 원복(`git diff` 없음 확인).

**`?file=` 리로드 안전성도 실기 확인 완료.** CLI 재실행으로 창에 파일(PRD.md)을 연 뒤 그 창에서 다른 파일(ARCHITECTURE.md)로 전환, `tauri dev`가 떠 있는 상태에서 프론트 소스를 저장해 Vite 전체 리로드를 유발 → 리로드 후 PRD.md가 되살아나지 않고 빈 화면(드롭 안내)으로 남는 것 확인(`history.replaceState`가 `?file=`을 즉시 지워서 리로드 시 재실행되지 않는다는 설계 의도가 실제로 동작함).
- **macOS 전용 코드 경로 실기 확인**: `ExitRequested`(마지막 창 닫아도 프로세스 생존 — `ps aux` 확인), `Reopen`(창 없을 때 Dock 클릭 시 새 창), Open 다이얼로그 `set_parent`(창 2개 중 포커스된 창에 정확히 시트로 붙음) **3가지는 `npm run tauri dev`로 실기 확인 완료** — 전부 의도대로 동작. `Opened`(더블클릭/파일 연결/Open With)는 버그를 발견/수정하고 재확인까지 완료 — 아래 "실기 검증" 다음의 "버그 수정(콜드스타트)" 참고.
- **drag&drop 다중 파일(첫 파일 교체 + 나머지 새 창) 동작을 Linux/Windows에서도 실기 확인 필요.** 오늘 고친 레이스 버그(`open_window`의 pristine 재사용 로직)는 `cfg!(target_os = "macos")`로 게이팅돼 있어서 코드상으로는 Linux/Windows에 아예 안 타는 분기이고, 그래서 이론적으로는 두 OS 모두 애초에 이 버그 없이 "파일마다 새 창"이 바로 됐어야 함 — 하지만 이 정확한 시나리오(창에 여러 파일 한꺼번에 drag&drop)는 Ubuntu 세션에서 Wayland 환경의 마우스 자동화 제약으로 실기 테스트를 못 했고(CLI 재실행 방식의 새 창 생성만 확인됨), Windows는 아예 아직 한 번도 테스트한 적 없음. 코드 리뷰상의 추론일 뿐 실기 확인은 안 된 상태 — Linux나 Windows로 넘어가면 반드시 직접 드래그&드롭해서 확인.
- **M8(패키징 및 배포)**: macOS 쪽은 소수 배포용 `.app`/`.dmg` 빌드 완료(위 "macOS 패키징" 참고). Linux는 여전히 `patchelf`/`libfuse2t64` 설치 후 AppImage 등 패키징 미착수(Ubuntu로 돌아갔을 때). 릴리스 빌드 시작 시간/메모리 실측(<1s/<30MB)은 두 플랫폼 다 미착수.
- **dock 아이콘 미표시**: 보류 중 — M8 패키징이 끝난 뒤 실제 설치된 앱으로 재검토(위 "앱 아이콘" 섹션 참고).

**종결된 것 (참고용, 더 이상 진행 안 함):**
- M7(TOC Toggle/Zoom/About) — 전부 완료 및 사용자 확인.
- 인쇄 시 컨텐츠 잘림 버그 — WebKitGTK가 `break-inside`를 지원 안 하는 게 근본 원인, "알려진 한계로 받아들이기"로 사용자가 확정.
- 멀티 윈도우/인스턴스 지원의 single-instance 라우팅/창 생성 자체(빈 창 1개 기본 실행, 재실행 시 크래시 없이 `open_window` 호출, 재실행이 새 창을 여는 것) — `busctl` D-Bus 트리로 실기 확인 완료(위 "실기 검증"/"후속 조치" 참고).
- TOC Resizable(구현 + 가로 스크롤바/세로 스크롤 시 resize 안 되던 버그 2건) — 사용자가 실제 앱에서 확인 완료("좋아. 모두 해결됐네.").
- macOS 전용 코드 경로 4가지(`ExitRequested`/`Reopen`/`set_parent`/`Opened`) — 전부 디버그 번들·`npm run tauri dev`로 실기 확인 완료. `Opened`는 콜드스타트 시 빈 창이 하나 더 뜨는 버그를 발견/수정하고 재확인까지 완료(위 "버그 수정" 참고).
- 키보드 단축키 6종 — 사용자가 실제 앱에서 전부 확인 완료(Apply만 한국어 입력 소스 관련 버그가 있어서 `event.code` 기반으로 수정 후 재확인, 위 "버그 수정" 참고).
