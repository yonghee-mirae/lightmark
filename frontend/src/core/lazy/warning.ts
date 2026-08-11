// Block-level "couldn't render this" notice, used by mermaid (always in a block context - a
// ```mermaid fence is its own <pre>). KaTeX handles its own failures in place instead (see
// katex.ts) since `.lm-math` can be inline, where inserting a sibling <p> wouldn't nest validly.
// The emoji is there specifically so the notice doesn't blend into normal prose when scanning a
// long document - a plain-text warning is easy to skim right past (docs/PLAN.md M4).

export function renderWarning(message: string): HTMLElement {
  const el = document.createElement('p');
  el.className = 'lm-render-warning';
  el.textContent = `⚠️ ${message}`;
  return el;
}
