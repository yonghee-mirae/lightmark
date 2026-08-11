// Shell for M1. Filled in by the TOC engine (M2) from parsed headings.

export class LmToc extends HTMLElement {
  connectedCallback(): void {
    this.textContent = '';
  }
}

customElements.define('lm-toc', LmToc);
