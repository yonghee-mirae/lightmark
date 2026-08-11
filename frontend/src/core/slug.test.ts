import { describe, expect, it } from 'vitest';
import { createSlugger } from './slug';

describe('createSlugger', () => {
  it('slugifies text', () => {
    const slugger = createSlugger();
    expect(slugger.slug('Hello World')).toBe('hello-world');
  });

  it('suffixes duplicate slugs with -1, -2, ...', () => {
    const slugger = createSlugger();
    expect(slugger.slug('Intro')).toBe('intro');
    expect(slugger.slug('Intro')).toBe('intro-1');
    expect(slugger.slug('Intro')).toBe('intro-2');
  });

  it('falls back to "section" for text with no sluggable characters', () => {
    const slugger = createSlugger();
    expect(slugger.slug('!!!')).toBe('section');
  });
});
