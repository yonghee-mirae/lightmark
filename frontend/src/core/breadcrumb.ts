// Active heading id -> ancestor path (e.g. Heading1 > Heading2 > Heading3), derived purely
// from the flat heading list in document order (no DOM traversal).

import type { Heading } from './markdown';

export function buildBreadcrumb(headings: Heading[], activeId: string | null): Heading[] {
  if (!activeId) {
    return [];
  }

  const path: Heading[] = [];
  for (const heading of headings) {
    while (path.length > 0 && (path[path.length - 1]?.level ?? 0) >= heading.level) {
      path.pop();
    }
    path.push(heading);
    if (heading.id === activeId) {
      return [...path];
    }
  }

  return [];
}
