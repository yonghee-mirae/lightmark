# Development Tasks

## Milestone 1
- [x] Bootstrap Vite TS
- [x] Setup Web Components
- [x] Setup ESLint/Prettier (Tauri import 격리 규칙 포함)
- [x] Setup Vitest

## Milestone 2
- [x] Markdown Renderer
- [x] TOC Engine
- [x] Breadcrumb Engine

## Milestone 3
- [x] Theme Engine
- [x] Custom CSS
- [x] Font Loader

## Milestone 4
- [x] Mermaid Lazy Load
- [x] KaTeX Lazy Load
- [x] Shiki Lazy Load

## Milestone 5
- [x] Rust Watcher
- [x] Config System
- [x] Dev Server (Tauri 비의존, axum+SSE)
- [x] Adapter Layer (Web / Dev / Tauri) — Tauri는 M6에서

## Milestone 6
- [x] Tauri Integration

## Milestone 7
- [x] TOC Toggle
- [x] Zoom
- [x] About

## Milestone 8
- [x] App Icon — `npm run tauri icon`으로 생성, `tauri.conf.json`의 `bundle.icon`이 이미 같은 경로를 참조
- [x] Packaging (macOS) — `npm run tauri build`로 `.app`/`.dmg` 생성, ad-hoc 서명 자동 적용(Apple Developer 계정 없이 소수 배포용).
- [x] Packaging (Linux) — 배포 타깃을 deb 하나로 제한(사용자 결정, `bundle.targets: ["deb"]`). `npm run tauri build`로 `.deb` 생성, 메타데이터(Maintainer/Description/Homepage)·바이너리 이름(`app`→`lightmark`) 정리 후 실제 설치까지 확인.
- [ ] Release — 성능 실측은 사용자 판단("충분히 좋음")으로 생략 확정. Windows 패키징만 남음(실제 Windows 머신에서 네이티브로 진행 예정, 크로스 빌드는 기각).
