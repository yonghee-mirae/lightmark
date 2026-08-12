// Open/Print/TOC Toggle/About always wired; the Config actions only render when the backend can
// actually do them (Tauri - docs/CLAUDE.md "Application only provides: Open Config Folder /
// Reload Config", none of which existed as a UI entry point until M6). Zoom stays disabled - out
// of M7's scope so far (docs/PLAN.md M7). Labels are one word each - screen width may be narrow
// (user feedback). No Reset button (removed, M7): deleting config.json and clicking Apply
// (label only - still `reload-config`/`reload_config()` under the hood) now self-heals back to a
// fresh default file - see backend::reload_config().

const CONFIG_ACTIONS = [
  ['config-folder', 'Config'],
  ['reload-config', 'Apply'],
] as const;

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
      <button type="button" disabled>Zoom</button>
      <button type="button" data-action="about">About</button>
    `;
    this.dispatchOnClick('open', 'lm-open');
    this.dispatchOnClick('toc-toggle', 'lm-toc-toggle');
    this.dispatchOnClick('print', 'lm-print');
    this.dispatchOnClick('config-folder', 'lm-config-folder');
    this.dispatchOnClick('reload-config', 'lm-reload-config');
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
