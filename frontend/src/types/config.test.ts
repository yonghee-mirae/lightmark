import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config';

describe('DEFAULT_CONFIG', () => {
  it('matches the docs/CONFIG_SPEC.md schema', () => {
    expect(DEFAULT_CONFIG).toEqual({
      theme: 'github-light',
      customCss: '',
      fontFamily: 'sans-serif',
      codeFontFamily: 'monospace',
      zoom: 100,
      tocVisible: false,
      breadcrumbVisible: true,
      syntaxHighlight: true,
      mermaid: true,
      mermaidTheme: 'auto',
      katex: true,
      autoReload: true,
      printUseLightTheme: true,
    });
  });
});
