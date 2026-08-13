// Theme field is filled in by the theme engine (M3); filename work now.
// The perf indicator is dev-only (docs/PLAN.md M2 verification: parse+render < 300ms for 10k lines).

export class LmStatusbar extends HTMLElement {
  private filename = 'No file open';
  // Mirrors main.ts's own zoom state (docs/PLAN.md M7) - starts at 100 (DEFAULT_CONFIG.zoom)
  // since main.ts only overrides this after readConfig() resolves.
  private zoom = 100;
  // Mirrors currentConfig.viewerMaxWidth (docs/PLAN.md M7) - read-only display of whatever's set
  // in config.json, not an editable control (user feedback: a number input here didn't vertically
  // align with the other plain-text status items, and editing width isn't this component's job -
  // config.json is). 0 means unlimited.
  private viewerMaxWidth = 0;
  private filenameEl: HTMLSpanElement | null = null;
  private perfEl: HTMLSpanElement | null = null;
  private zoomEl: HTMLSpanElement | null = null;
  private widthEl: HTMLSpanElement | null = null;

  connectedCallback(): void {
    this.innerHTML = `
      <span class="lm-status-filename"></span>
      <span class="lm-status-width"></span>
      ${import.meta.env.DEV ? '<span class="lm-status-perf"></span>' : ''}
      <span class="lm-status-zoom"></span>
    `;
    this.filenameEl = this.querySelector('.lm-status-filename');
    this.perfEl = this.querySelector('.lm-status-perf');
    this.zoomEl = this.querySelector('.lm-status-zoom');
    this.widthEl = this.querySelector('.lm-status-width');
    this.updateFilename();
    this.updateZoom();
    this.updateWidth();
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

  setViewerMaxWidth(width: number): void {
    this.viewerMaxWidth = width;
    this.updateWidth();
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

  private updateWidth(): void {
    if (this.widthEl) {
      // Labeled ("Width: ...") unlike zoom's bare "100%" - a bare number/px here reads as
      // meaningless without knowing what it's the width of (user feedback).
      const value = this.viewerMaxWidth > 0 ? `${this.viewerMaxWidth}px` : 'Full';
      this.widthEl.textContent = `Width: ${value}`;
    }
  }
}

customElements.define('lm-statusbar', LmStatusbar);
