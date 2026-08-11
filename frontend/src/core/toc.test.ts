import { describe, expect, it } from 'vitest';
import { buildToc } from './toc';
import type { Heading } from './markdown';

describe('buildToc', () => {
  it('nests headings under their nearest lower-level ancestor', () => {
    const headings: Heading[] = [
      { id: 'a', level: 1, text: 'A' },
      { id: 'a-1', level: 2, text: 'A.1' },
      { id: 'a-2', level: 2, text: 'A.2' },
      { id: 'b', level: 1, text: 'B' },
    ];

    expect(buildToc(headings)).toEqual([
      {
        id: 'a',
        level: 1,
        text: 'A',
        children: [
          { id: 'a-1', level: 2, text: 'A.1', children: [] },
          { id: 'a-2', level: 2, text: 'A.2', children: [] },
        ],
      },
      { id: 'b', level: 1, text: 'B', children: [] },
    ]);
  });

  it('treats a skipped level (h1 -> h3) as a direct child', () => {
    const headings: Heading[] = [
      { id: 'a', level: 1, text: 'A' },
      { id: 'a-1', level: 3, text: 'A.1' },
    ];

    expect(buildToc(headings)).toEqual([
      {
        id: 'a',
        level: 1,
        text: 'A',
        children: [{ id: 'a-1', level: 3, text: 'A.1', children: [] }],
      },
    ]);
  });
});
