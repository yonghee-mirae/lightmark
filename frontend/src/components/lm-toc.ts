// Renders the TOC tree built by core/toc.ts and highlights the active section on
// 'lm-active-heading' events. Entries are plain anchor links (#heading-id) for native
// scroll-to-anchor, but a click also dispatches 'lm-toc-select' explicitly: if the target
// heading is already fully visible near the end of a short document, the native jump causes no
// actual scroll (already at max scrollTop) and therefore no scroll/scrollend event, which is the
// only thing that would otherwise update the active heading (lm-viewer.ts's IntersectionObserver
// and its scrollend fallback are both scroll-driven). Explicit click handling doesn't have that
// gap.

import type { TocNode } from '../core/toc';

export interface TocSelectDetail {
  id: string;
}

// CLAUDE.md UI Rules requires the TOC to be resizable, in px, via a drag handle on its own right
// edge - session-only (like Zoom/TOC-Toggle, docs/PLAN.md M7), not written back to config.json
// (CLAUDE.md Config Rules: no graphical settings editor). Resets to tokens.css's --lm-toc-width
// default on next launch.
const MIN_WIDTH = 160;
const MAX_WIDTH = 560;

export class LmToc extends HTMLElement {
  private activeId: string | null = null;
  private listEl: HTMLElement | null = null;
  private handleEl: HTMLElement | null = null;
  private dragStartX = 0;
  private dragStartWidth = 0;

  connectedCallback(): void {
    this.replaceChildren();
    this.listEl = document.createElement('div');
    this.listEl.className = 'lm-toc-list';
    this.handleEl = document.createElement('div');
    this.handleEl.className = 'lm-toc-resize-handle';
    this.appendChild(this.listEl);
    this.appendChild(this.handleEl);
    this.addEventListener('click', this.handleClick);
    this.handleEl.addEventListener('pointerdown', this.handlePointerDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.handleClick);
    this.handleEl?.removeEventListener('pointerdown', this.handlePointerDown);
  }

  private handleClick = (event: MouseEvent): void => {
    const link = (event.target as HTMLElement).closest('a');
    const id = link?.getAttribute('href')?.slice(1);
    if (id) {
      this.dispatchEvent(
        new CustomEvent<TocSelectDetail>('lm-toc-select', { bubbles: true, detail: { id } }),
      );
    }
  };

  // Pointer capture (rather than document-level listeners) keeps drag tracking working even once
  // the pointer leaves the handle/this element, and needs no manual cleanup beyond the drag's own
  // pointerup/pointercancel - nothing to leak if the component is ever removed mid-drag.
  private handlePointerDown = (event: PointerEvent): void => {
    if (!this.handleEl) {
      return;
    }
    event.preventDefault();
    this.dragStartX = event.clientX;
    this.dragStartWidth = this.offsetWidth;
    this.handleEl.setPointerCapture(event.pointerId);
    this.handleEl.addEventListener('pointermove', this.handlePointerMove);
    this.handleEl.addEventListener('pointerup', this.handlePointerUp);
    this.handleEl.addEventListener('pointercancel', this.handlePointerUp);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const width = this.dragStartWidth + (event.clientX - this.dragStartX);
    const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
    document.documentElement.style.setProperty('--lm-toc-width', `${clamped}px`);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    this.handleEl?.releasePointerCapture(event.pointerId);
    this.handleEl?.removeEventListener('pointermove', this.handlePointerMove);
    this.handleEl?.removeEventListener('pointerup', this.handlePointerUp);
    this.handleEl?.removeEventListener('pointercancel', this.handlePointerUp);
  };

  setToc(nodes: TocNode[]): void {
    if (!this.listEl) {
      return;
    }
    this.listEl.replaceChildren();
    if (nodes.length === 0) {
      return;
    }
    this.listEl.appendChild(this.renderList(nodes));
  }

  setActive(id: string | null): void {
    this.activeId = id;
    this.querySelectorAll('a').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
    });
  }

  private renderList(nodes: TocNode[]): HTMLUListElement {
    const list = document.createElement('ul');
    for (const node of nodes) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${node.id}`;
      link.textContent = node.text;
      link.classList.toggle('active', node.id === this.activeId);
      item.appendChild(link);
      if (node.children.length > 0) {
        item.appendChild(this.renderList(node.children));
      }
      list.appendChild(item);
    }
    return list;
  }
}

customElements.define('lm-toc', LmToc);
