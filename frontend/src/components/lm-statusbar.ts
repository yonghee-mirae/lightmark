// Theme field is filled in by the theme engine (M3); filename work now.
// The perf indicator is dev-only (docs/PLAN.md M2 verification: parse+render < 300ms for 10k lines).

export class LmStatusbar extends HTMLElement {
  private filename = 'No file open';
  private filenameEl: HTMLSpanElement | null = null;
  private perfEl: HTMLSpanElement | null = null;

  connectedCallback(): void {
    this.innerHTML = `
      <span class="lm-status-filename"></span>
      ${import.meta.env.DEV ? '<span class="lm-status-perf"></span>' : ''}
      <span class="lm-status-zoom">100%</span>
    `;
    this.filenameEl = this.querySelector('.lm-status-filename');
    this.perfEl = this.querySelector('.lm-status-perf');
    this.updateFilename();
  }

  setFilename(name: string): void {
    this.filename = name;
    this.updateFilename();
  }

  setRenderTime(ms: number): void {
    if (this.perfEl) {
      this.perfEl.textContent = `Render: ${ms.toFixed(0)}ms`;
    }
  }

  private updateFilename(): void {
    if (this.filenameEl) {
      this.filenameEl.textContent = this.filename;
    }
  }
}

customElements.define('lm-statusbar', LmStatusbar);
