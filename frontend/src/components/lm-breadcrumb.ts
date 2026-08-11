// Renders "Heading1 > Heading2 > Heading3" for the active heading, derived from the flat
// heading list via core/breadcrumb.ts (pure function, no DOM traversal).
//
// Width handling: render the full chain first; if it overflows, collapse to
// "First > ... > Last"; if even that overflows, the First/Last crumbs shrink and ellipsize via
// CSS (docs/UI_SPEC.md). A ResizeObserver re-runs this when the pane itself is resized — no
// scroll/resize event listeners.

import { buildBreadcrumb } from '../core/breadcrumb';
import type { Heading } from '../core/markdown';

export class LmBreadcrumb extends HTMLElement {
  private headings: Heading[] = [];
  private activeId: string | null = null;
  private resizeObserver: ResizeObserver | null = null;

  connectedCallback(): void {
    this.replaceChildren();
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
  }

  setHeadings(headings: Heading[]): void {
    this.headings = headings;
    this.activeId = null;
    this.render();
  }

  setActive(id: string | null): void {
    this.activeId = id;
    this.render();
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
