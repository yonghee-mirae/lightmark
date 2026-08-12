import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, configsEqual } from './config';

describe('DEFAULT_CONFIG', () => {
  it('matches the docs/CONFIG_SPEC.md schema', () => {
    expect(DEFAULT_CONFIG).toEqual({
      theme: 'github-light',
      customCss: '',
      fontFamily: 'sans-serif',
      codeFontFamily: 'monospace',
      zoom: 100,
      tocVisible: false,
      syntaxHighlight: true,
      mermaid: true,
      mermaidTheme: 'auto',
      katex: true,
      printUseLightTheme: true,
    });
  });
});

describe('configsEqual', () => {
  it('is true for two separately-constructed configs with the same values', () => {
    expect(configsEqual(DEFAULT_CONFIG, { ...DEFAULT_CONFIG })).toBe(true);
  });

  it('is false when any single field differs', () => {
    expect(configsEqual(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, zoom: 150 })).toBe(false);
    expect(configsEqual(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, theme: 'github-dark' })).toBe(false);
    expect(configsEqual(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, mermaid: false })).toBe(false);
  });
});
