import { describe, expect, it } from 'vitest';
import { buildBreadcrumb } from './breadcrumb';
import type { Heading } from './markdown';

const headings: Heading[] = [
  { id: 'a', level: 1, text: 'A' },
  { id: 'a-1', level: 2, text: 'A.1' },
  { id: 'a-1-1', level: 3, text: 'A.1.1' },
  { id: 'b', level: 1, text: 'B' },
];

describe('buildBreadcrumb', () => {
  it('returns the ancestor path for a deep heading', () => {
    expect(buildBreadcrumb(headings, 'a-1-1')).toEqual([headings[0], headings[1], headings[2]]);
  });

  it('drops the previous branch when a sibling top-level heading is active', () => {
    expect(buildBreadcrumb(headings, 'b')).toEqual([headings[3]]);
  });

  it('returns an empty path when there is no active heading', () => {
    expect(buildBreadcrumb(headings, null)).toEqual([]);
  });

  it('returns an empty path when the active id is not found', () => {
    expect(buildBreadcrumb(headings, 'missing')).toEqual([]);
  });
});
