import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config';

describe('DEFAULT_CONFIG', () => {
  it('matches the docs/CONFIG_SPEC.md schema', () => {
    expect(DEFAULT_CONFIG).toEqual({
      theme: 'github-dark',
      customCss: '',
      fontFamily: 'Pretendard',
      codeFontFamily: 'JetBrains Mono',
      zoom: 100,
      tocVisible: true,
      breadcrumbVisible: true,
      syntaxHighlight: true,
      mermaid: true,
      katex: true,
      autoReload: true,
      printUseLightTheme: false,
    });
  });
});
