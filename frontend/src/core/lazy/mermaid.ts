// Mermaid is only imported when the rendered document actually contains a ```mermaid fence
// (docs/PLAN.md M4). The module-level cached promise means re-renders (opening another file,
// live reload) reuse the already-loaded module instead of importing it again.

import { renderWarning } from './warning';
import { isLightTheme } from '../theme';

let mermaidPromise: Promise<typeof import('mermaid')> | null = null;

function loadMermaid(): Promise<typeof import('mermaid')> {
  mermaidPromise ??= import('mermaid');
  return mermaidPromise;
}

let nextDiagramId = 0;

// Mermaid ships its own theme names ('default', 'dark', 'forest', 'neutral', 'base') - unlike
// Shiki, it doesn't recognize docs/CONFIG_SPEC.md's 'github-light'/'github-dark' directly, so by
// default this picks mermaid's theme from `theme` the same way `theme.ts` does for the rest of
// the app (`isLightTheme` - an unrecognized/custom `theme` value lands on 'dark' here exactly
// like it does for the rest of the app, instead of the two disagreeing).
//
// `mermaidThemeSetting` (config's `mermaidTheme`, docs/CONFIG_SPEC.md) is the escape hatch for
// when that guess is wrong: `customCss` can repaint the app a different color scheme than
// `theme` says (e.g. `theme: 'github-light'` with `customCss` overriding the color variables to a
// dark palette), and there is no way to detect that from `theme` alone - only the user configuring
// it explicitly can. `'light'`/`'dark'` force mermaid's choice regardless of `theme`; anything
// else (`'auto'`, unset, a typo) keeps the automatic `theme`-based guess.
export function mermaidThemeOf(appTheme: string, mermaidThemeSetting: string): 'default' | 'dark' {
  if (mermaidThemeSetting === 'light') {
    return 'default';
  }
  if (mermaidThemeSetting === 'dark') {
    return 'dark';
  }
  return isLightTheme(appTheme) ? 'default' : 'dark';
}

export async function renderMermaid(
  container: ParentNode,
  appTheme: string,
  mermaidThemeSetting: string,
): Promise<void> {
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>('pre > code.language-mermaid'),
  );
  if (blocks.length === 0) {
    return;
  }

  const { default: mermaid } = await loadMermaid();
  mermaid.initialize({ startOnLoad: false, theme: mermaidThemeOf(appTheme, mermaidThemeSetting) });

  for (const block of blocks) {
    const pre = block.parentElement;
    if (!pre) {
      continue;
    }
    const source = block.textContent ?? '';

    // mermaid.render() does not reject on invalid syntax - it resolves with a built-in "error
    // diagram" SVG (a red icon plus "Syntax error in text") instead, so a plain try/catch around
    // render() never catches a bad diagram. parse() with suppressErrors is the actual way to
    // detect this ahead of time and leave the original code block in place instead.
    const valid = await mermaid.parse(source, { suppressErrors: true });
    if (!valid) {
      pre.before(renderWarning('Mermaid diagram has a syntax error and could not be rendered.'));
      continue;
    }

    const id = `lm-mermaid-${nextDiagramId++}`;
    try {
      const { svg } = await mermaid.render(id, source);
      const figure = document.createElement('div');
      figure.className = 'lm-mermaid';
      figure.innerHTML = svg;
      pre.replaceWith(figure);
    } catch {
      // Defensive fallback for any other render-time failure - leave the original code block in
      // place rather than breaking the rest of the document.
      pre.before(renderWarning('Mermaid diagram could not be rendered.'));
    }
  }
}
