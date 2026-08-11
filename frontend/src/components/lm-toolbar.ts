// Shell for M1: only "Open" is wired. Other buttons render disabled until their milestone lands.

export interface ToolbarCapabilities {
  configFile: boolean;
}

export class LmToolbar extends HTMLElement {
  private capabilities: ToolbarCapabilities = { configFile: false };

  connectedCallback(): void {
    this.render();
  }

  setCapabilities(capabilities: ToolbarCapabilities): void {
    this.capabilities = capabilities;
    this.render();
  }

  private render(): void {
    this.innerHTML = `
      <button type="button" data-action="open">Open</button>
      <button type="button" disabled>TOC Toggle</button>
      <button type="button" disabled>Print</button>
      ${this.capabilities.configFile ? '<button type="button" disabled>Config Folder</button>' : ''}
      <button type="button" disabled>Zoom</button>
      <button type="button" disabled>About</button>
    `;
    this.querySelector('[data-action="open"]')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('lm-open', { bubbles: true }));
    });
  }
}

customElements.define('lm-toolbar', LmToolbar);
