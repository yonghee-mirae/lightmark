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

## Code Style
- Small modules
- Single responsibility
- No circular dependencies
