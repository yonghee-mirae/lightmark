# Architecture

## Principles
1. Frontend First
2. Browser Development First
3. Tauri is Packaging Layer
4. Platform Abstraction Mandatory

## Stack
Frontend: HTML + CSS + TypeScript + Web Components + Vite
Backend: Rust
Packaging: Tauri

## Structure
```text
Cargo.toml             # workspace: backend, src-tauri
package.json           # @tauri-apps/cli만 — frontend/package.json은 Tauri를 모른다
backend/               # Tauri 비의존 (순수 로직 + dev server binary)
src-tauri/             # Tauri IPC 바인딩 (얇은 셸, 로직 없음)
frontend/
  src/
    core/
    components/
    platform/
docs/
```

## Components
- lm-toolbar
- lm-breadcrumb
- lm-toc
- lm-viewer
- lm-statusbar

## Adapters
BackendApi -> WebBackend | DevBackend | TauriBackend

Frontend는 Tauri API를 직접 import하지 않는다.

## Development Modes
개발 단계는 Tauri 비의존. 배포 시에만 Tauri로 결합한다.

| Mode | Run | BackendApi | Watch |
|---|---|---|---|
| Web | npm run dev | WebBackend | 미지원 |
| Dev | cargo run -p backend --features dev-server + npm run dev | DevBackend | SSE |
| Tauri | npm run tauri dev | TauriBackend | file-changed |
