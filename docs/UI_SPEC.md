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

## StatusBar
Filename, Theme, Zoom, Auto Reload

Web 모드: Auto Reload → "N/A" 표시 (capabilities.watch=false)
