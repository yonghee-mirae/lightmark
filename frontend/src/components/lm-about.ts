// A single small in-page modal (native <dialog>) showing app name/version - keeps About working
// identically in Web/Dev/Tauri without depending on any platform API (docs/PLAN.md M7). No Close
// button by design (user feedback) - any click (on the dialog's own content or the backdrop) or
// Escape (native <dialog> behavior) closes it instead.

import { APP_AUTHOR, APP_NAME, APP_TAGLINE, APP_VERSION } from '../core/appInfo';

export class LmAbout extends HTMLElement {
  private dialogEl: HTMLDialogElement | null = null;

  connectedCallback(): void {
    this.innerHTML = `
      <dialog class="lm-about-dialog">
        <h2>${APP_NAME}</h2>
        <p class="lm-about-tagline">${APP_TAGLINE}</p>
        <p>Version ${APP_VERSION}</p>
        <p>Developed by ${APP_AUTHOR}</p>
      </dialog>
    `;
    this.dialogEl = this.querySelector('dialog');
    // Any click closes it, whether on the dialog's own content or the backdrop - there's nothing
    // left inside to click for another purpose now that there's no Close button.
    this.dialogEl?.addEventListener('click', () => {
      this.close();
    });
  }

  open(): void {
    this.dialogEl?.showModal();
  }

  close(): void {
    this.dialogEl?.close();
    // <dialog>.close() restores focus to whatever invoked showModal() (the toolbar's About
    // button) - blur it too, so closing doesn't just trade one lingering focus ring for another.
    (document.activeElement as HTMLElement | null)?.blur();
  }
}

customElements.define('lm-about', LmAbout);
