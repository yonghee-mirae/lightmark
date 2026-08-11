// Config schema per docs/CONFIG_SPEC.md

export interface Config {
  theme: string;
  customCss: string;
  fontFamily: string;
  codeFontFamily: string;
  zoom: number;
  tocVisible: boolean;
  breadcrumbVisible: boolean;
  syntaxHighlight: boolean;
  mermaid: boolean;
  katex: boolean;
  autoReload: boolean;
  printUseLightTheme: boolean;
}

export const DEFAULT_CONFIG: Config = {
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
};
