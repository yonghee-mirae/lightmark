// Mermaid is only imported when the rendered document actually contains a ```mermaid fence
// (docs/PLAN.md M4). The module-level cached promise means re-renders (opening another file,
// live reload) reuse the already-loaded module instead of importing it again.

import { renderWarning } from './warning';

let mermaidPromise: Promise<typeof import('mermaid')> | null = null;

function loadMermaid(): Promise<typeof import('mermaid')> {
  mermaidPromise ??= import('mermaid');
  return mermaidPromise;
}

let nextDiagramId = 0;

export async function renderMermaid(container: ParentNode): Promise<void> {
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>('pre > code.language-mermaid'),
  );
  if (blocks.length === 0) {
    return;
  }

  const { default: mermaid } = await loadMermaid();
  mermaid.initialize({ startOnLoad: false });

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
