// Theme field is filled in by the theme engine (M3); filename work now.
// The perf indicator is dev-only (docs/PLAN.md M2 verification: parse+render < 300ms for 10k lines).

export class LmStatusbar extends HTMLElement {
  private filename = 'No file open';
  // Mirrors main.ts's own zoom state (docs/PLAN.md M7) - starts at 100 (DEFAULT_CONFIG.zoom)
  // since main.ts only overrides this after readConfig() resolves.
  private zoom = 100;
  private filenameEl: HTMLSpanElement | null = null;
  private perfEl: HTMLSpanElement | null = null;
  private zoomEl: HTMLSpanElement | null = null;

  connectedCallback(): void {
    this.innerHTML = `
      <span class="lm-status-filename"></span>
      ${import.meta.env.DEV ? '<span class="lm-status-perf"></span>' : ''}
      <span class="lm-status-zoom"></span>
    `;
    this.filenameEl = this.querySelector('.lm-status-filename');
    this.perfEl = this.querySelector('.lm-status-perf');
    this.zoomEl = this.querySelector('.lm-status-zoom');
    this.updateFilename();
    this.updateZoom();
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

  setZoom(zoom: number): void {
    this.zoom = zoom;
    this.updateZoom();
  }

  private updateFilename(): void {
    if (this.filenameEl) {
      this.filenameEl.textContent = this.filename;
    }
  }

  private updateZoom(): void {
    if (this.zoomEl) {
      this.zoomEl.textContent = `${this.zoom}%`;
    }
  }
}

customElements.define('lm-statusbar', LmStatusbar);
