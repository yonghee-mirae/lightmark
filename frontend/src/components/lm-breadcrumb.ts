// Shell for M1. Filled in by the breadcrumb engine (M2) from active-heading events.

export class LmBreadcrumb extends HTMLElement {
  connectedCallback(): void {
    this.textContent = '';
  }
}

customElements.define('lm-breadcrumb', LmBreadcrumb);
