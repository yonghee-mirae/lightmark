# UI Specification

## Layout
```text
Toolbar
Breadcrumb
Content Area (TOC + Viewer)
Status Bar
```

## Toolbar
Open, TOC Toggle, Print, Config Folder, Zoom, About

Web 모드: Config Folder 버튼 숨김 (capabilities.configFile=false)

## TOC
Default Width 280px
Resizable

## Breadcrumb
Heading1 > Heading2 > Heading3

## Viewer
Rendered Markdown Only

## StatusBar
Filename, Theme, Zoom, Auto Reload

Web 모드: Auto Reload → "N/A" 표시 (capabilities.watch=false)
