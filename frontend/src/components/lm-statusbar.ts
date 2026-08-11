// Theme field is filled in by the theme engine (M3); filename/reload work now.
// The perf indicator is dev-only (docs/PLAN.md M2 verification: parse+render < 300ms for 10k lines).

export interface StatusbarCapabilities {
  watch: boolean;
}

export class LmStatusbar extends HTMLElement {
  private filename = 'No file open';
  private capabilities: StatusbarCapabilities = { watch: false };
  private filenameEl: HTMLSpanElement | null = null;
  private reloadEl: HTMLSpanElement | null = null;
  private perfEl: HTMLSpanElement | null = null;

  connectedCallback(): void {
    this.innerHTML = `
      <span class="lm-status-filename"></span>
      <span class="lm-status-zoom">100%</span>
      <span class="lm-status-reload"></span>
      ${import.meta.env.DEV ? '<span class="lm-status-perf"></span>' : ''}
    `;
    this.filenameEl = this.querySelector('.lm-status-filename');
    this.reloadEl = this.querySelector('.lm-status-reload');
    this.perfEl = this.querySelector('.lm-status-perf');
    this.updateFilename();
    this.updateReload();
  }

  setFilename(name: string): void {
    this.filename = name;
    this.updateFilename();
  }

  setCapabilities(capabilities: StatusbarCapabilities): void {
    this.capabilities = capabilities;
    this.updateReload();
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

  private updateReload(): void {
    if (this.reloadEl) {
      this.reloadEl.textContent = `Auto Reload: ${this.capabilities.watch ? 'On' : 'N/A'}`;
    }
  }
}

customElements.define('lm-statusbar', LmStatusbar);
