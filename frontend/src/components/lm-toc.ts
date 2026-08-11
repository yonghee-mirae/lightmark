// Renders the TOC tree built by core/toc.ts and highlights the active section on
// 'lm-active-heading' events. Entries are plain anchor links (#heading-id) — no scroll JS needed.

import type { TocNode } from '../core/toc';

export class LmToc extends HTMLElement {
  private activeId: string | null = null;

  connectedCallback(): void {
    this.textContent = '';
  }

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
