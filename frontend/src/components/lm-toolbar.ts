// Open/Print/TOC Toggle/About always wired; the Config actions only render when the backend can
// actually do them (Tauri - docs/CLAUDE.md "Application only provides: Open Config Folder /
// Reload Config", none of which existed as a UI entry point until M6). Zoom is three buttons (a
// single "Zoom" button wouldn't be convenient to adjust with, user feedback): -/+ step by
// ZOOM_STEP and disable at ZOOM_MIN/ZOOM_MAX, the middle button shows the current percentage and
// resets to ZOOM_RESET on click. main.ts owns the actual zoom value/clamping and calls setZoom()
// - this component only renders it and disables -/+ at the bounds (docs/PLAN.md M7).
// Labels are U+2212 MINUS SIGN (not a plain hyphen - at the same font-size a hyphen reads
// visibly shorter/thinner than "+", so the two didn't look like a matched pair) and a live
// percentage (not a bare "0" - a digit's glyph looks like a different size again next to +/−).
// Other labels are one word each - screen width may be narrow (user feedback). No Reset button
// (removed, M7): deleting config.json and clicking Apply (label only - still
// `reload-config`/`reload_config()` under the hood) now self-heals back to a fresh default file -
// see backend::reload_config().

const CONFIG_ACTIONS = [
  ['config-folder', 'Config'],
  ['reload-config', 'Apply'],
] as const;

// Exported so main.ts clamps/steps zoom by the exact same numbers this component disables -/+
// and resets to - a single source of truth instead of matching magic numbers in two files.
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 10;
export const ZOOM_RESET = 100;

export interface ToolbarCapabilities {
  configFile: boolean;
}

export class LmToolbar extends HTMLElement {
  private capabilities: ToolbarCapabilities = { configFile: false };
  // Nothing to print or toggle a TOC for before a document is open (docs/CLAUDE.md Print Rules
  // assume there's rendered content; there's no TOC to show/hide either) - no way to go back to
  // "no document" once one's loaded, so this only ever flips false -> true.
  private hasDocument = false;
  // Session-only, mirrors main.ts's own state (docs/PLAN.md M7) - starts at the config's
  // tocVisible default (false) since main.ts only overrides this after readConfig() resolves.
  private tocVisible = false;
  // Session-only, mirrors main.ts's own state (docs/PLAN.md M7) - starts at ZOOM_RESET
  // (DEFAULT_CONFIG.zoom) since main.ts only overrides this after readConfig() resolves.
  private zoom = ZOOM_RESET;

  connectedCallback(): void {
    this.render();
  }

  setCapabilities(capabilities: ToolbarCapabilities): void {
    this.capabilities = capabilities;
    this.render();
  }

  setHasDocument(hasDocument: boolean): void {
    if (hasDocument === this.hasDocument) {
      return;
    }
    this.hasDocument = hasDocument;
    this.render();
  }

  setTocVisible(tocVisible: boolean): void {
    if (tocVisible === this.tocVisible) {
      return;
    }
    this.tocVisible = tocVisible;
    this.render();
  }

  setZoom(zoom: number): void {
    if (zoom === this.zoom) {
      return;
    }
    this.zoom = zoom;
    this.render();
  }

  private render(): void {
    const configButtons = this.capabilities.configFile
      ? CONFIG_ACTIONS.map(
          ([action, label]) => `<button type="button" data-action="${action}">${label}</button>`,
        ).join('')
      : '';
    this.innerHTML = `
      <button type="button" data-action="open">Open</button>
      <button type="button" data-action="toc-toggle" aria-pressed="${this.tocVisible}" ${this.hasDocument ? '' : 'disabled'}>TOC</button>
      <button type="button" data-action="print" ${this.hasDocument ? '' : 'disabled'}>Print</button>
      ${configButtons}
      <button type="button" data-action="zoom-out" ${this.zoom <= ZOOM_MIN ? 'disabled' : ''}>&minus;</button>
      <button type="button" data-action="zoom-reset">${this.zoom}%</button>
      <button type="button" data-action="zoom-in" ${this.zoom >= ZOOM_MAX ? 'disabled' : ''}>+</button>
      <button type="button" data-action="about">About</button>
    `;
    this.dispatchOnClick('open', 'lm-open');
    this.dispatchOnClick('toc-toggle', 'lm-toc-toggle');
    this.dispatchOnClick('print', 'lm-print');
    this.dispatchOnClick('config-folder', 'lm-config-folder');
    this.dispatchOnClick('reload-config', 'lm-reload-config');
    this.dispatchOnClick('zoom-out', 'lm-zoom-out');
    this.dispatchOnClick('zoom-reset', 'lm-zoom-reset');
    this.dispatchOnClick('zoom-in', 'lm-zoom-in');
    this.dispatchOnClick('about', 'lm-about');
  }

  private dispatchOnClick(action: string, eventName: string): void {
    const button = this.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    button?.addEventListener('click', () => {
      // Buttons are click-only, not something to leave a lingering focus ring on (user feedback).
      button.blur();
      this.dispatchEvent(new CustomEvent(eventName, { bubbles: true }));
    });
  }
}

customElements.define('lm-toolbar', LmToolbar);
