# UI Specification

## Layout
```text
Toolbar
Content Area (TOC + Viewer)
Status Bar
```

## Toolbar
Open, TOC, Print, Config, Zoom, About

Web 모드: Config 버튼 숨김 (capabilities.configFile=false)

버튼 라벨은 화면 폭이 좁을 수 있어서 한 단어로 유지(사용자 요청, M7).

Zoom은 버튼 하나가 아니라 3개(`−`/중앙/`+`, M7): 각각 10% 축소/기본 배율로 리셋/10% 확대. 중앙 버튼 라벨은 `config.json`의 `zoom`(앱의 기본 배율)을 표시(현재 배율이 아님 — 배율은 상태바에 이미 표시되므로, 이 버튼은 "누르면 기본 배율로 돌아간다"는 의미만 나타냄) — 고정된 `100%`가 아니라 `zoom`이 다른 값이면 그 값이 표시됨(사용자 요청, 기본값이 100이라 이전엔 고정처럼 보였음). `−`/`+`는 50~200% 경계에서 `disabled`.

## TOC
Default Width 280px
Resizable

## Breadcrumb
Heading1 > Heading2 > Heading3

고정 행이 아니라 Viewer 영역 상단에 떠 있는 토스트. 활성 heading이 바뀔 때만 나타났다가 1.5초 뒤 자동으로 사라짐 (연속으로 바뀌면 타이머 리셋). TOC 영역은 침범하지 않음 (Viewer 폭 기준으로만 오버레이).

폭이 부족하면 단계적으로 축약:
1. 전체 체인 표시
2. 넘치면 첫 heading과 마지막 heading만 표시하고 중간은 `...`로 축약: `First > ... > Last`
3. 그래도 넘치면 First/Last 각각을 말줄임표로 축약: `First... > ... > ...Last`

## Viewer
Rendered Markdown Only

기본은 컬럼 폭 제한 없이 뷰어 폭 전체를 채운다 - word-wrap은 실제 창 가장자리에서만 일어나고, 가독성을 위한 고정 컬럼은 두지 않는다(M7). 좁은 컬럼을 원하면 `config.json`의 `viewerMaxWidth`를 직접 편집한다(그래픽 설정 UI 없음, `CLAUDE.md` Config Rules) - 현재 값은 StatusBar에 읽기 전용으로 표시.

## StatusBar
Filename, 폭 제한 표시(파일명 바로 오른쪽, M7 - `config.json`의 `viewerMaxWidth`를 읽기 전용으로 표시, 편집은 config.json에서만. `Width: Full` 또는 `Width: {값}px`), Theme, Zoom
