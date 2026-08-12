// Renders "Heading1 > Heading2 > Heading3" for the active heading, derived from the flat
// heading list via core/breadcrumb.ts (pure function, no DOM traversal).
//
// Presented as a toast over the top of the rendering area rather than a permanently docked bar:
// it fades in whenever the active heading changes and fades back out after a delay.
//
// Width handling: render the full chain first; if it overflows, collapse to
// "First > ... > Last"; if even that overflows, the First/Last crumbs shrink and ellipsize via
// CSS (docs/UI_SPEC.md). A ResizeObserver re-runs this when the pane itself is resized — no
// scroll/resize event listeners.

import { buildBreadcrumb } from '../core/breadcrumb';
import type { Heading } from '../core/markdown';

const VISIBLE_MS = 1500;

export class LmBreadcrumb extends HTMLElement {
  private headings: Heading[] = [];
  private activeId: string | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private hideTimer: number | null = null;

  connectedCallback(): void {
    this.replaceChildren();
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.clearHideTimer();
  }

  setHeadings(headings: Heading[]): void {
    this.headings = headings;
    this.activeId = null;
    this.render();
  }

  setActive(id: string | null): void {
    this.activeId = id;
    this.render();
    if (id) {
      this.show();
    } else {
      // No heading to show a path for (e.g. scrolled back above the first heading) - hide right
      // away instead of leaving an empty toast up until whatever hide timer a previous, now-stale
      // activation happened to leave running.
      this.hide();
    }
  }

  private show(): void {
    this.classList.add('lm-breadcrumb-visible');
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.classList.remove('lm-breadcrumb-visible');
      this.hideTimer = null;
    }, VISIBLE_MS);
  }

  private hide(): void {
    this.clearHideTimer();
    this.classList.remove('lm-breadcrumb-visible');
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private render(): void {
    const path = buildBreadcrumb(this.headings, this.activeId);
    this.renderFull(path);
    if (path.length > 2 && this.scrollWidth > this.clientWidth) {
      this.renderCollapsed(path);
    }
  }

  private renderFull(path: Heading[]): void {
    this.replaceChildren();
    path.forEach((heading, index) => {
      if (index > 0) {
        this.appendChild(this.makeSeparator());
      }
      this.appendChild(this.makeCrumb(heading.text, false));
    });
  }

  private renderCollapsed(path: Heading[]): void {
    const first = path[0];
    const last = path[path.length - 1];
    if (!first || !last) {
      return;
    }
    this.replaceChildren();
    this.appendChild(this.makeCrumb(first.text, true));
    this.appendChild(this.makeSeparator());
    this.appendChild(this.makeEllipsis());
    this.appendChild(this.makeSeparator());
    this.appendChild(this.makeCrumb(last.text, true));
  }

  private makeCrumb(text: string, truncatable: boolean): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = truncatable ? 'lm-breadcrumb-item lm-truncatable' : 'lm-breadcrumb-item';
    span.textContent = text;
    span.title = text;
    return span;
  }

  private makeSeparator(): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'lm-breadcrumb-sep';
    span.textContent = '>';
    return span;
  }

  private makeEllipsis(): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'lm-breadcrumb-ellipsis';
    span.textContent = '...';
    return span;
  }
}

customElements.define('lm-breadcrumb', LmBreadcrumb);
