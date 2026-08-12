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

export class LmToc extends HTMLElement {
  private activeId: string | null = null;

  connectedCallback(): void {
    this.textContent = '';
    this.addEventListener('click', this.handleClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.handleClick);
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

  setToc(nodes: TocNode[]): void {
    this.replaceChildren();
    if (nodes.length === 0) {
      return;
    }
    this.appendChild(this.renderList(nodes));
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
