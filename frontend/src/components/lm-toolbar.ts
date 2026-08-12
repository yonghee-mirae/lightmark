// Open/Print always wired; the four Config actions only render when the backend can actually do
// them (Tauri - docs/CLAUDE.md "Application only provides: Open Config Folder / Open Config
// File / Reload Config / Reset Config", none of which existed as a UI entry point until M6).
// TOC Toggle/Zoom/About stay disabled - out of M6's scope.

const CONFIG_ACTIONS = [
  ['config-folder', 'Config Folder'],
  ['config-file', 'Config File'],
  ['reload-config', 'Reload Config'],
  ['reset-config', 'Reset Config'],
] as const;

export interface ToolbarCapabilities {
  configFile: boolean;
}

export class LmToolbar extends HTMLElement {
  private capabilities: ToolbarCapabilities = { configFile: false };
  // Nothing to print before a document is open (docs/CLAUDE.md Print Rules assume there's
  // rendered content) - no way to go back to "no document" once one's loaded, so this only
  // ever flips false -> true.
  private hasDocument = false;

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

  private render(): void {
    const configButtons = this.capabilities.configFile
      ? CONFIG_ACTIONS.map(
          ([action, label]) => `<button type="button" data-action="${action}">${label}</button>`,
        ).join('')
      : '';
    this.innerHTML = `
      <button type="button" data-action="open">Open</button>
      <button type="button" disabled>TOC Toggle</button>
      <button type="button" data-action="print" ${this.hasDocument ? '' : 'disabled'}>Print</button>
      ${configButtons}
      <button type="button" disabled>Zoom</button>
      <button type="button" disabled>About</button>
    `;
    this.dispatchOnClick('open', 'lm-open');
    this.dispatchOnClick('print', 'lm-print');
    this.dispatchOnClick('config-folder', 'lm-config-folder');
    this.dispatchOnClick('config-file', 'lm-config-file');
    this.dispatchOnClick('reload-config', 'lm-reload-config');
    this.dispatchOnClick('reset-config', 'lm-reset-config');
  }

  private dispatchOnClick(action: string, eventName: string): void {
    this.querySelector(`[data-action="${action}"]`)?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(eventName, { bubbles: true }));
    });
  }
}

customElements.define('lm-toolbar', LmToolbar);
