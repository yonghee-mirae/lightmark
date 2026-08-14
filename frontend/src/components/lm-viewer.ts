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

export interface ExternalLinkDetail {
  url: string;
}

export interface ActiveHeadingDetail {
  id: string | null;
}

// A heading genuinely at the very top of the document still renders with its top offset from
// the pane's own top edge by lm-viewer's `padding: 1rem` (see styles/layout.css) - a few extra px
// of slack absorbs any margin-collapse rounding on top of that. Anything past this is real
// preceding content (a paragraph, etc.), not just box-model offset, and should NOT count as
// "reached" yet.
const TOP_TOLERANCE_PX = 24;

// Which lazy-loaded renderers to run for this document (docs/PLAN.md M4). `theme` is passed to
// both the syntax highlighter (Shiki ships themes literally named 'github-light'/'github-dark',
// matching docs/CONFIG_SPEC.md's `theme` values) and Mermaid (which maps it to its own theme
// names via `mermaidThemeOf` - see core/lazy/mermaid.ts). `mermaidTheme` is the escape hatch for
// when `customCss` repaints the app a different color scheme than `theme` alone would suggest.
export interface RenderOptions {
  theme: string;
  mermaid: boolean;
  mermaidTheme: string;
  katex: boolean;
  syntaxHighlight: boolean;
}

export class LmViewer extends HTMLElement {
  private observer: IntersectionObserver | null = null;
  private activeId: string | null = null;
  // Forces the next setActive() call to dispatch even if it computes the same value the
  // previous document happened to leave behind (most commonly: both null) - see setContent().
  private freshDocumentPending = false;

  connectedCallback(): void {
    this.renderEmpty();
    this.addEventListener('dragover', this.handleDragOver);
    this.addEventListener('drop', this.handleDrop);
    this.addEventListener('scrollend', this.reconcileActiveHeading);
    this.addEventListener('click', this.handleLinkClick);
  }

  disconnectedCallback(): void {
    this.observer?.disconnect();
    this.removeEventListener('scrollend', this.reconcileActiveHeading);
    this.removeEventListener('click', this.handleLinkClick);
  }

  setContent(html: string, headings: Heading[], options: RenderOptions): void {
    this.observer?.disconnect();
    this.activeId = null;
    this.freshDocumentPending = true;
    this.replaceChildren();

    const article = document.createElement('div');
    article.className = 'lm-markdown';
    article.innerHTML = html;
    this.appendChild(article);
    handleBrokenImages(article);

    this.observeHeadings();
    // Geometry, not "always the first heading": if the document opens with prose before its
    // first heading, that heading hasn't been reached yet and nothing should be active - see
    // computeActiveHeadingId().
    this.setActive(this.computeActiveHeadingId());

    void this.enhance(article, options);
  }

  // Mermaid/KaTeX/Shiki, in that order so Shiki's code-block query never sees a still-pending
  // ```mermaid fence (mermaid replaces its <pre> with an <svg> once done). Each import happens
  // only if its config flag is on AND the target nodes actually exist (docs/PLAN.md M4) - the
  // existence check lives inside each lazy/*.ts function, not here.
  private async enhance(article: HTMLElement, options: RenderOptions): Promise<void> {
    if (options.mermaid) {
      await renderMermaid(article, options.theme, options.mermaidTheme);
    }
    if (options.syntaxHighlight) {
      await highlightCode(article, options.theme);
    }
    if (options.katex) {
      await renderMath(article);
    }
  }

  private renderEmpty(): void {
    this.innerHTML = '<p class="lm-empty">Drop a Markdown file here.</p>';
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
    this.setActive(this.computeActiveHeadingId());
  };

  // The last heading whose top has actually passed the pane's top edge (within
  // TOP_TOLERANCE_PX), or null if none has - i.e. we're still above/before the first heading
  // (either genuinely at the top of the document with no headings reached yet, or there are no
  // headings at all). Used both right after loading a document and by the scrollend fallback
  // above, so both agree on exactly the same geometry.
  private computeActiveHeadingId(): string | null {
    const headingEls = this.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
    if (headingEls.length === 0) {
      return null;
    }
    const paneTop = this.getBoundingClientRect().top;
    let active: HTMLElement | null = null;
    for (const el of headingEls) {
      if (el.getBoundingClientRect().top - paneTop <= TOP_TOLERANCE_PX) {
        active = el;
      } else {
        break;
      }
    }
    return active?.id || null;
  }

  private setActive(id: string | null): void {
    if (id === this.activeId && !this.freshDocumentPending) {
      return;
    }
    this.freshDocumentPending = false;
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

  // Used for live reload's scroll anchor (docs/PLAN.md M5: jump back to the heading that was
  // active before the reload instead of snapping to the top) and for TOC clicks (docs/PLAN.md
  // M2: a click needs *some* way to update the active heading even when scrollIntoView causes no
  // actual scroll - e.g. the target is one of several headings already visible at the very end
  // of a short document - which would otherwise mean no scroll/scrollend event ever fires to
  // update it).
  //
  // Deliberately does NOT force `id` itself to become active: scrollIntoView({block: 'start'})
  // can't push a heading past the end of the document, so if `id` is near the bottom of a short
  // document it may settle somewhere other than the very top of the pane - in that case the
  // heading that's actually topmost on screen should end up active, same as if the user had
  // scrolled there by hand, not whichever heading happened to be clicked. Recomputing by
  // geometry after the scroll (rather than trusting `id`) gives exactly that, and still reduces
  // to "the clicked heading" in the normal case where it does land at the top.
  focusHeading(id: string): void {
    this.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start' });
    this.setActive(this.computeActiveHeadingId());
  }

  // Hyperlinks in the rendered document (user report: they were navigating this webview itself
  // away from LightMark instead of opening in the OS's default browser). A same-document heading
  // link (`href="#some-id"`) is left alone - native anchor scroll still applies, same as before.
  // Anything else (an absolute URL, a bare linkify-autolinked one, a relative path - all render
  // identically from markdown-it, see core/markdown.ts) is treated as external and handed off via
  // main.ts instead, which is the only place that knows which BackendApi to call.
  private handleLinkClick = (event: MouseEvent): void => {
    const link = (event.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (!href || href.startsWith('#')) {
      return;
    }
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent<ExternalLinkDetail>('lm-external-link', {
        bubbles: true,
        detail: { url: href },
      }),
    );
  };

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
