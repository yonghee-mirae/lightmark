# Agent Rules

## MUST
- TypeScript strict mode
- Web Components
- ESM modules
- Platform abstraction
- Lazy loading
- Accessibility considered
- 개발 단계 Tauri 비의존 (Web/Dev 모드에서 단독 실행 가능)
- Core 레이어 단위 테스트 (Vitest)

## MUST NOT
- React
- Vue
- Svelte
- jQuery
- Global state libraries
- Direct Tauri imports outside platform layer (ESLint no-restricted-imports로 강제)
- 프레임마다 실행되는 scroll 핸들러로 레이아웃 재계산 (IntersectionObserver/ResizeObserver로 대체. `scrollend`는 스크롤 제스처 종료 시 1회 보정 용도로만 예외 허용 — 상세: `docs/PLAN.md` M2)

## Code Style
- Small modules
- Single responsibility
- No circular dependencies
