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
  mermaidTheme: string;
  katex: boolean;
  autoReload: boolean;
  printUseLightTheme: boolean;
}

export const DEFAULT_CONFIG: Config = {
  theme: 'github-light',
  customCss: '',
  fontFamily: 'sans-serif',
  codeFontFamily: 'monospace',
  zoom: 100,
  tocVisible: true,
  breadcrumbVisible: true,
  syntaxHighlight: true,
  mermaid: true,
  mermaidTheme: 'auto',
  katex: true,
  autoReload: true,
  printUseLightTheme: true,
};
