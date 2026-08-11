import { describe, expect, it } from 'vitest';
import { computeCssVars } from './theme';
import { DEFAULT_CONFIG } from '../types/config';

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
