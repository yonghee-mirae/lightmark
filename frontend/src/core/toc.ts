// Flat heading list -> hierarchical TOC tree, derived purely from levels (no DOM).

import type { Heading } from './markdown';

export interface TocNode extends Heading {
  children: TocNode[];
}

export function buildToc(headings: Heading[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const heading of headings) {
    const node: TocNode = { ...heading, children: [] };
    while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= node.level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      root.push(node);
    }
    stack.push(node);
  }

  return root;
}
