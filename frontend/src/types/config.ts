// Config schema per docs/CONFIG_SPEC.md

export interface Config {
  theme: string;
  customCss: string;
  fontFamily: string;
  codeFontFamily: string;
  zoom: number;
  tocVisible: boolean;
  syntaxHighlight: boolean;
  mermaid: boolean;
  mermaidTheme: string;
  katex: boolean;
  printUseLightTheme: boolean;
}

// Config is a flat object of primitives (no nested objects/arrays), so a field-by-field ===
// comparison is a complete equality check - used by main.ts's Apply handler to skip re-rendering
// when reloadConfig() comes back identical to what's already applied.
export function configsEqual(a: Config, b: Config): boolean {
  return (Object.keys(a) as (keyof Config)[]).every((key) => a[key] === b[key]);
}

export const DEFAULT_CONFIG: Config = {
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
};
