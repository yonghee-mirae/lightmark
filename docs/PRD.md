# LightMark PRD v1.1

## Vision
Fast. Lightweight. Focused.

LightMark는 Markdown 편집기가 아닌 Viewer이다. 사용자는 선호하는 편집기에서 문서를 작성하고 LightMark는 최적의 읽기 경험을 제공한다.

## Goals
- Cross-platform (Windows/macOS/Linux)
- Live Reload
- Viewer Only
- TOC + Breadcrumb
- Mermaid/KaTeX/Shiki 지원
- JSON 기반 설정
- Lazy Loading
- Print 지원

## Core Features

### Markdown
CommonMark + GFM

### Live Reload
파일 변경 감지 후 500ms 이내 반영 목표

### TOC
좌측 패널, 접기/펼치기, 현재 섹션 강조

### Breadcrumb
Toolbar 아래 현재 위치 표시

### Theme
기본 테마 + 사용자 CSS

### Font
본문/코드 폰트 설정

### Print
Toolbar/TOC 제외 후 인쇄

## Performance Targets
- Startup < 1s
- 10k lines open < 300ms
- Memory < 30MB(일반 문서)

## Non Goals
- Editor
- Collaboration
- Cloud Sync
- PDF Export Engine
