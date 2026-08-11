// Shiki is only imported when the document has a fenced code block with a language (docs/PLAN.md
// M4). Shiki's own bundled `codeToHtml` lazy-loads each requested language/theme as a separate
// dynamic import internally, so calling it only for the languages that actually appear in the
// document is enough to keep unused grammars/themes out of the network entirely - no separate
// per-language allowlist needed on our side.
//
// Highlighting runs after the initial paint (called from lm-viewer once the raw HTML is already
// in the DOM) and swaps each block's markup in place, so it never blocks first render.

import type { BundledTheme } from 'shiki';

let shikiPromise: Promise<typeof import('shiki')> | null = null;

function loadShiki(): Promise<typeof import('shiki')> {
  shikiPromise ??= import('shiki');
  return shikiPromise;
}

function languageOf(code: HTMLElement): string | null {
  const match = /language-(\S+)/.exec(code.className);
  return match?.[1] && match[1] !== 'mermaid' ? match[1] : null;
}

export async function highlightCode(container: ParentNode, theme: string): Promise<void> {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('pre > code[class*="language-"]'))
    .map((code) => ({ code, lang: languageOf(code) }))
    .filter((block): block is { code: HTMLElement; lang: string } => block.lang !== null);
  if (blocks.length === 0) {
    return;
  }

  const { codeToHtml } = await loadShiki();
  for (const { code, lang } of blocks) {
    const pre = code.parentElement;
    if (!pre) {
      continue;
    }
    const source = (code.textContent ?? '').replace(/\n$/, '');
    try {
      const html = await codeToHtml(source, { lang, theme: theme as BundledTheme });
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const highlighted = wrapper.firstElementChild;
      if (highlighted) {
        pre.replaceWith(highlighted);
      }
    } catch {
      // Unrecognized language name (arbitrary user markdown, e.g. a typo) - leave the block as
      // plain, unhighlighted code rather than breaking the rest of the document.
    }
  }
}
