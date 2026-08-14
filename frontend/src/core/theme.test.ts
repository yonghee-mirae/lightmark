import { describe, expect, it } from 'vitest';
import { computeCssVars, isLightTheme } from './theme';
import { DEFAULT_CONFIG } from '../types/config';

describe('isLightTheme', () => {
  it.each(['github-light', 'solarized-light', 'one-light', 'gruvbox-light-medium'])(
    '%s is light',
    (theme) => expect(isLightTheme(theme)).toBe(true),
  );

  it.each([
    'github-dark',
    'dracula',
    'nord',
    'solarized-dark',
    'one-dark-pro',
    'gruvbox-dark-medium',
    'no-such-theme',
  ])('%s is not light', (theme) => expect(isLightTheme(theme)).toBe(false));
});

describe('computeCssVars', () => {
  it('resolves the configured built-in theme', () => {
    const vars = computeCssVars({ ...DEFAULT_CONFIG, theme: 'github-light' });
    expect(vars['--lm-color-bg']).toBe('#ffffff');
    expect(vars['--lm-color-fg']).toBe('#1f2328');
  });

  it('falls back to github-dark for an unknown theme name', () => {
    const vars = computeCssVars({ ...DEFAULT_CONFIG, theme: 'no-such-theme' });
    expect(vars['--lm-color-bg']).toBe('#0d1117');
  });

  it.each([
    ['dracula', '#282a36'],
    ['nord', '#2e3440'],
    ['solarized-light', '#fdf6e3'],
    ['solarized-dark', '#002b36'],
    ['one-light', '#fafafa'],
    ['one-dark-pro', '#282c34'],
    ['gruvbox-light-medium', '#fbf1c7'],
    ['gruvbox-dark-medium', '#282828'],
  ])('resolves the %s theme', (theme, bg) => {
    expect(computeCssVars({ ...DEFAULT_CONFIG, theme })['--lm-color-bg']).toBe(bg);
  });

  it('uses a legible muted color distinct from the border color', () => {
    const vars = computeCssVars({ ...DEFAULT_CONFIG, theme: 'github-dark' });
    expect(vars['--lm-color-muted']).toBe('#8b949e');
    expect(vars['--lm-color-muted']).not.toBe(vars['--lm-color-border']);
  });

  it('uses system font stacks when no custom font is configured', () => {
    const vars = computeCssVars({ ...DEFAULT_CONFIG, fontFamily: '', codeFontFamily: '' });
    expect(vars['--lm-font-body']).not.toContain('undefined');
    expect(vars['--lm-font-body']).toMatch(/^system-ui/);
    expect(vars['--lm-font-code']).toMatch(/^ui-monospace/);
  });

  it('prepends a configured font, quoting multi-word names', () => {
    const vars = computeCssVars({
      ...DEFAULT_CONFIG,
      fontFamily: 'Pretendard',
      codeFontFamily: 'JetBrains Mono',
    });
    expect(vars['--lm-font-body']).toBe('Pretendard, system-ui, -apple-system, \'Segoe UI\', Roboto, sans-serif');
    expect(vars['--lm-font-code']).toMatch(/^"JetBrains Mono", ui-monospace/);
  });

  it('converts zoom percentage to a CSS multiplier', () => {
    expect(computeCssVars({ ...DEFAULT_CONFIG, zoom: 150 })['--lm-zoom']).toBe('1.5');
    expect(computeCssVars({ ...DEFAULT_CONFIG, zoom: 100 })['--lm-zoom']).toBe('1');
  });
});
