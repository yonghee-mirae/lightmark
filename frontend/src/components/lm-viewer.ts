// Renders parsed markdown and tracks the active heading via IntersectionObserver so lm-toc/
// lm-breadcrumb can highlight without running their own scroll handlers. A 'scrollend'
// reconciliation (see reconcileActiveHeading) covers the one case IntersectionObserver alone
// can miss: fast scrolling skipping past the trip wire entirely between two samples.

import type { Heading } from '../core/markdown';
import { renderMermaid } from '../core/lazy/mermaid';
import { renderMath } from '../core/lazy/katex';
import { highlightCode } from '../core/lazy/shiki';
import { handleBrokenImages } from '../core/images';

export interface FileDropDetail {
  name: string;
  content: string;
}

export interface ActiveHeadingDetail {
  id: string;
}

// Which lazy-loaded renderers to run for this document (docs/PLAN.md M4). `theme` is only used
// by the syntax highlighter (Shiki ships themes literally named 'github-light'/'github-dark',
// matching docs/CONFIG_SPEC.md's `theme` values).
export interface RenderOptions {
  theme: string;
  mermaid: boolean;
  katex: boolean;
  syntaxHighlight: boolean;
}

export class LmViewer extends HTMLElement {
  private observer: IntersectionObserver | null = null;
  private activeId: string | null = null;

  connectedCallback(): void {
    this.renderEmpty();
    this.addEventListener('dragover', this.handleDragOver);
    this.addEventListener('drop', this.handleDrop);
    this.addEventListener('scrollend', this.reconcileActiveHeading);
  }

  disconnectedCallback(): void {
    this.observer?.disconnect();
    this.removeEventListener('scrollend', this.reconcileActiveHeading);
  }

  setContent(html: string, headings: Heading[], options: RenderOptions): void {
    this.observer?.disconnect();
    this.activeId = null;
    this.replaceChildren();

    const article = document.createElement('div');
    article.className = 'lm-markdown';
    article.innerHTML = html;
    this.appendChild(article);
    handleBrokenImages(article);

    this.observeHeadings();
    const first = headings[0];
    if (first) {
      this.setActive(first.id);
    }

    void this.enhance(article, options);
  }

  // Mermaid/KaTeX/Shiki, in that order so Shiki's code-block query never sees a still-pending
  // ```mermaid fence (mermaid replaces its <pre> with an <svg> once done). Each import happens
  // only if its config flag is on AND the target nodes actually exist (docs/PLAN.md M4) - the
  // existence check lives inside each lazy/*.ts function, not here.
  private async enhance(article: HTMLElement, options: RenderOptions): Promise<void> {
    if (options.mermaid) {
      await renderMermaid(article);
    }
    if (options.syntaxHighlight) {
      await highlightCode(article, options.theme);
    }
    if (options.katex) {
      await renderMath(article);
    }
  }

  private renderEmpty(): void {
    this.innerHTML = '<p class="lm-empty">Drop a Markdown file here, or use Open.</p>';
  }

  private observeHeadings(): void {
    const headingEls = this.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
    if (headingEls.length === 0) {
      return;
    }
    // `root: this`: lm-viewer scrolls internally (overflow-y: auto), so the trigger line must be
    // relative to this pane, not the window. The band is a thin trip wire pinned to the pane's
    // top edge (2% of its height, a few px in practice) rather than a wide "top zone": a heading
    // becomes active the moment it crosses that line and stays active — even once fully scrolled
    // past — until the *next* heading crosses the same line. That's why only entries that just
    // started intersecting matter below; an exit event just means "this heading left the trip
    // wire", which happens a full line-height *after* it crosses the top and would make the
    // switch to the next heading lag behind by that much if we acted on it.
    this.observer = new IntersectionObserver(this.handleIntersect, {
      root: this,
      rootMargin: '0px 0px -98% 0px',
      threshold: 0,
    });
    headingEls.forEach((el) => this.observer?.observe(el));
  }

  private handleIntersect = (entries: IntersectionObserverEntry[]): void => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        continue;
      }
      const id = (entry.target as HTMLElement).id;
      if (id) {
        this.setActive(id);
      }
    }
  };

  // Fallback for fast scrolling: a fling can move the content far enough in a single frame that
  // a heading's line crosses the thin trip wire above between two intersection samples, so its
  // 'enter' never fires and the active heading falls behind. `scrollend` fires once per scroll
  // gesture (not per frame), so reconciling here catches up without becoming a per-frame handler.
  private reconcileActiveHeading = (): void => {
    const headingEls = this.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
    const firstHeading = headingEls[0];
    if (!firstHeading) {
      return;
    }
    // Default to the first heading: if none has passed the top (e.g. scrolled all the way back
    // to the very start of the document, where the first heading sits just below the top edge
    // because of lm-viewer's own padding), that's the correct answer, not "leave it as-is".
    const paneTop = this.getBoundingClientRect().top;
    let active = firstHeading;
    for (const el of headingEls) {
      if (el.getBoundingClientRect().top - paneTop <= 0) {
        active = el;
      } else {
        break;
      }
    }
    if (active.id) {
      this.setActive(active.id);
    }
  };

  private setActive(id: string): void {
    if (id === this.activeId) {
      return;
    }
    this.activeId = id;
    this.dispatchEvent(
      new CustomEvent<ActiveHeadingDetail>('lm-active-heading', {
        bubbles: true,
        detail: { id },
      }),
    );
  }

  /** The heading currently focused, so a live-reload re-render can ask for it back afterwards. */
  getActiveId(): string | null {
    return this.activeId;
  }

  // Live reload's scroll anchor (docs/PLAN.md M5): after a re-render, jump back to the heading
  // that was active before the reload instead of snapping to the top of the document.
  scrollToHeading(id: string): void {
    this.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start' });
  }

  private handleDragOver = (event: DragEvent): void => {
    event.preventDefault();
  };

  private handleDrop = (event: DragEvent): void => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    void file.text().then((content) => {
      this.dispatchEvent(
        new CustomEvent<FileDropDetail>('lm-file-drop', {
          bubbles: true,
          detail: { name: file.name, content },
        }),
      );
    });
  };
}

customElements.define('lm-viewer', LmViewer);
