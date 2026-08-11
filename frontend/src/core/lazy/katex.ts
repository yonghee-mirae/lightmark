// KaTeX is only imported when the document actually has `.lm-math` placeholders (inserted by
// core/markdown.ts's math rules in M2; the actual rendering was deferred to this milestone).
// The CSS is a dynamic import too, so it's fetched/injected only alongside the JS (docs/PLAN.md
// M4: "CSS도 동적 주입"). Module-level cached promise avoids importing twice across re-renders.

let katexPromise: Promise<typeof import('katex')> | null = null;

function loadKatex(): Promise<typeof import('katex')> {
  katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.css')]).then(
    ([katex]) => katex,
  );
  return katexPromise;
}

export async function renderMath(container: ParentNode): Promise<void> {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>('.lm-math'));
  if (nodes.length === 0) {
    return;
  }

  const katex = await loadKatex();
  for (const node of nodes) {
    const source = node.textContent ?? '';
    try {
      // throwOnError: true - the default (false) doesn't reject either, it just renders KaTeX's
      // own error span inline (easy to miss, same problem as mermaid's built-in error diagram).
      // Throwing lets us show our own, more visible warning instead.
      katex.render(source, node, {
        displayMode: node.classList.contains('lm-math-block'),
        throwOnError: true,
      });
    } catch {
      // Invalid TeX (arbitrary user markdown may contain a non-math `$...$`). Mutate the node in
      // place rather than inserting a sibling element - `.lm-math` can be an inline `<span>`
      // inside a paragraph, where a block-level warning element wouldn't nest validly.
      node.classList.add('lm-render-warning-inline');
      node.textContent = `⚠️ Invalid math: ${source}`;
    }
  }
}
