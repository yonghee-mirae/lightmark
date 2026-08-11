import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders GFM basics (tables, strikethrough, autolinks)', () => {
    const { html } = renderMarkdown(
      '| a | b |\n| - | - |\n| 1 | 2 |\n\n~~gone~~\n\nhttps://example.com',
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<s>gone</s>');
    expect(html).toContain('<a href="https://example.com">');
  });

  it('strips raw HTML instead of rendering it', () => {
    const { html } = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('converts task list items into disabled checkboxes', () => {
    const { html } = renderMarkdown('- [ ] todo\n- [x] done');
    expect(html).toContain('<input type="checkbox" disabled>');
    expect(html).toContain('<input type="checkbox" disabled checked>');
  });

  it('wraps inline and block math in placeholder nodes', () => {
    const { html } = renderMarkdown('Inline $x^2$ math.\n\n$$\ny = mx + b\n$$');
    expect(html).toContain('<span class="lm-math">x^2</span>');
    expect(html).toContain('<div class="lm-math lm-math-block">y = mx + b</div>');
  });

  it('adds native lazy loading and a class to images', () => {
    const { html } = renderMarkdown('![a cat](cat.png)');
    expect(html).toContain('<img src="cat.png" alt="a cat" loading="lazy" class="lm-image">');
  });

  it('assigns stable, deduplicated ids to headings and returns them', () => {
    const { html, headings } = renderMarkdown('# Intro\n\n## Intro\n\n# Next');
    expect(headings).toEqual([
      { id: 'intro', level: 1, text: 'Intro' },
      { id: 'intro-1', level: 2, text: 'Intro' },
      { id: 'next', level: 1, text: 'Next' },
    ]);
    expect(html).toContain('id="intro"');
    expect(html).toContain('id="intro-1"');
  });
});
