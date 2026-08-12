import { describe, expect, it } from 'vitest';
import { mermaidThemeOf } from './mermaid';

describe('mermaidThemeOf', () => {
  it('maps the app dark theme to mermaid\'s dark theme when set to auto', () => {
    expect(mermaidThemeOf('github-dark', 'auto')).toBe('dark');
  });

  it('maps the app light theme to mermaid\'s default theme when set to auto', () => {
    expect(mermaidThemeOf('github-light', 'auto')).toBe('default');
  });

  // Matches theme.ts's own fallback (unknown theme name -> dark tokens) so an unrecognized/custom
  // `theme` value doesn't end up dark everywhere else but light-themed mermaid diagrams.
  it('falls back to mermaid\'s dark theme for an unknown/custom app theme when set to auto', () => {
    expect(mermaidThemeOf('no-such-theme', 'auto')).toBe('dark');
  });

  // The escape hatch for customCss repainting the app a different color scheme than `theme` says
  // - an explicit setting overrides the theme-based guess entirely, in either direction.
  it('forces mermaid\'s dark theme when explicitly set to dark, even if the app theme is light', () => {
    expect(mermaidThemeOf('github-light', 'dark')).toBe('dark');
  });

  it('forces mermaid\'s default theme when explicitly set to light, even if the app theme is dark', () => {
    expect(mermaidThemeOf('github-dark', 'light')).toBe('default');
  });

  it('treats an unrecognized mermaidTheme setting the same as auto', () => {
    expect(mermaidThemeOf('github-dark', 'not-a-real-setting')).toBe('dark');
  });
});
