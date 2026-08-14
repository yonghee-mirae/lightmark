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

const GITHUB_LIGHT: ThemeTokens = { bg: '#ffffff', fg: '#1f2328', border: '#d0d7de', muted: '#656d76', accent: '#0969da' };
const DRACULA: ThemeTokens = { bg: '#282a36', fg: '#f8f8f2', border: '#44475a', muted: '#6272a4', accent: '#bd93f9' };
const NORD: ThemeTokens = { bg: '#2e3440', fg: '#d8dee9', border: '#3b4252', muted: '#4c566a', accent: '#88c0d0' };
const SOLARIZED_DARK: ThemeTokens = { bg: '#002b36', fg: '#839496', border: '#073642', muted: '#586e75', accent: '#268bd2' };
const SOLARIZED_LIGHT: ThemeTokens = { bg: '#fdf6e3', fg: '#657b83', border: '#eee8d5', muted: '#93a1a1', accent: '#268bd2' };
const ONE_DARK: ThemeTokens = { bg: '#282c34', fg: '#abb2bf', border: '#3a3f4b', muted: '#5c6370', accent: '#61afef' };
const ONE_LIGHT: ThemeTokens = { bg: '#fafafa', fg: '#383a42', border: '#e5e5e6', muted: '#a0a1a7', accent: '#4078f2' };
const GRUVBOX_DARK: ThemeTokens = { bg: '#282828', fg: '#ebdbb2', border: '#3c3836', muted: '#928374', accent: '#83a598' };
const GRUVBOX_LIGHT: ThemeTokens = { bg: '#fbf1c7', fg: '#3c3836', border: '#ebdbb2', muted: '#928374', accent: '#076678' };

// Theme name -> tokens (docs/CONFIG_SPEC.md lists the full set). Keys match Shiki's own bundled
// theme ids exactly (docs/PLAN.md M4: Shiki's built-in theme names already line up with ours for
// github-light/dark, so `config.theme` doubles as the syntax-highlighting theme with zero mapping
// - same story for every theme added here). Anything not in this map (a typo, a future theme not
// yet added) falls back to GITHUB_DARK, same as it always has.
const THEMES: Record<string, ThemeTokens> = {
  'github-light': GITHUB_LIGHT,
  'github-dark': GITHUB_DARK,
  dracula: DRACULA,
  nord: NORD,
  'solarized-light': SOLARIZED_LIGHT,
  'solarized-dark': SOLARIZED_DARK,
  'one-light': ONE_LIGHT,
  'one-dark-pro': ONE_DARK,
  'gruvbox-light-medium': GRUVBOX_LIGHT,
  'gruvbox-dark-medium': GRUVBOX_DARK,
};

// The light-side half of THEMES above - everything else (including anything not in THEMES at
// all) is treated as dark. Exported so other consumers that need the same "light vs. dark" call
// for a theme name (e.g. Mermaid's own theme names, which don't line up with ours - see
// core/lazy/mermaid.ts) share this one answer instead of each re-deriving their own theme
// allowlist and risking disagreeing with this fallback.
const LIGHT_THEMES = new Set([
  'github-light',
  'solarized-light',
  'one-light',
  'gruvbox-light-medium',
]);

export function isLightTheme(theme: string): boolean {
  return LIGHT_THEMES.has(theme);
}

function resolveThemeTokens(theme: string): ThemeTokens {
  return THEMES[theme] ?? GITHUB_DARK;
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
