// Shell for M1. Theme field is filled in by the theme engine (M3); filename/reload work now.

export interface StatusbarCapabilities {
  watch: boolean;
}

export class LmStatusbar extends HTMLElement {
  private filename = 'No file open';
  private capabilities: StatusbarCapabilities = { watch: false };
  private filenameEl: HTMLSpanElement | null = null;
  private reloadEl: HTMLSpanElement | null = null;

  connectedCallback(): void {
    this.innerHTML = `
      <span class="lm-status-filename"></span>
      <span class="lm-status-zoom">100%</span>
      <span class="lm-status-reload"></span>
    `;
    this.filenameEl = this.querySelector('.lm-status-filename');
    this.reloadEl = this.querySelector('.lm-status-reload');
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
