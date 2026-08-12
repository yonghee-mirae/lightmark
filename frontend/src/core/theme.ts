// Config -> :root CSS variables, custom CSS injection, font stacks (docs/PLAN.md M3).
//
// `computeCssVars` is pure and Vitest-tested. `applyTheme`/`applyCustomCss` are the DOM-touching
// part (same split as core/markdown.ts vs. lm-viewer.ts in M2) and stay thin enough not to need
// their own tests.

import type { Config } from '../types/config';

interface ThemeTokens {
  bg: string;
  fg: string;
  border: string;
  muted: string;
  accent: string;
}

const BODY_FONT_FALLBACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const CODE_FONT_FALLBACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// `border` is a divider color, not a text color - it's too low-contrast to read as text (this is
// exactly what made dark mode's empty-state placeholder unreadable). `muted` is a separate,
// legible secondary-text color for that kind of use.
const GITHUB_DARK: ThemeTokens = {
  bg: '#0d1117',
  fg: '#e6edf3',
  border: '#30363d',
  muted: '#8b949e',
  accent: '#2f81f7',
};

// Built-in themes only (docs/PLAN.md M3: "github-light, github-dark 2종").
const GITHUB_LIGHT: ThemeTokens = { bg: '#ffffff', fg: '#1f2328', border: '#d0d7de', muted: '#656d76', accent: '#0969da' };

// Anything other than the one known light theme falls back to dark tokens - this covers an
// unrecognized/custom `theme` value (typo, future theme not yet added here) the same way as a
// genuinely dark theme, rather than silently landing on light. Exported so other consumers that
// need the same "light vs. dark" call for a theme name (e.g. Mermaid's own theme names, which
// don't line up with ours - see core/lazy/mermaid.ts) share this one answer instead of each
// re-deriving their own theme allowlist and risking disagreeing with this fallback.
export function isLightTheme(theme: string): boolean {
  return theme === 'github-light';
}

function resolveThemeTokens(theme: string): ThemeTokens {
  return isLightTheme(theme) ? GITHUB_LIGHT : GITHUB_DARK;
}

// System font stack first; a configured custom name is prepended, quoted if it contains a space
// (CSS requires quoting multi-word font-family names, e.g. "JetBrains Mono"). No web font
// bundling (startup cost) - this only ever produces a font-family list.
function buildFontStack(customFont: string, fallback: string): string {
  if (!customFont) {
    return fallback;
  }
  const name = customFont.includes(' ') ? `"${customFont}"` : customFont;
  return `${name}, ${fallback}`;
}

export function computeCssVars(config: Config): Record<string, string> {
  const tokens = resolveThemeTokens(config.theme);
  return {
    '--lm-color-bg': tokens.bg,
    '--lm-color-fg': tokens.fg,
    '--lm-color-border': tokens.border,
    '--lm-color-muted': tokens.muted,
    '--lm-color-accent': tokens.accent,
    '--lm-font-body': buildFontStack(config.fontFamily, BODY_FONT_FALLBACK),
    '--lm-font-code': buildFontStack(config.codeFontFamily, CODE_FONT_FALLBACK),
    '--lm-zoom': String(config.zoom / 100),
  };
}

export function applyTheme(config: Config, root: HTMLElement = document.documentElement): void {
  const vars = computeCssVars(config);
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
  // Printing forces the light theme regardless of the active one; see the `.lm-print-light`
  // `!important` override in styles/layout.css (needed to beat the inline vars set above).
  root.classList.toggle('lm-print-light', config.printUseLightTheme);
  applyCustomCss(config.customCss);
}

function applyCustomCss(css: string): void {
  let styleEl = document.getElementById('lm-custom');
  if (!(styleEl instanceof HTMLStyleElement)) {
    styleEl = document.createElement('style');
    styleEl.id = 'lm-custom';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}
