// Single markdown-it instance + custom rules. GFM tables/strikethrough/autolinks are covered by
// markdown-it built-ins + linkify; task lists and math are small custom rules so the dependency
// footprint stays at markdown-it alone (see docs/PLAN.md M2).
//
// `html: false`: LightMark opens arbitrary .md files, so raw HTML in the source is treated as an
// XSS vector rather than rendered (docs/PLAN.md Open Questions #1).

import MarkdownIt from 'markdown-it';
import type { Env, RendererRule, StateBlock, StateCore, StateInline } from 'markdown-it';
import { createSlugger } from './slug';

export interface Heading {
  id: string;
  level: number;
  text: string;
}

interface MarkdownEnv extends Env {
  headings?: Heading[];
}

const md = new MarkdownIt({ html: false, linkify: true });

// --- Task lists: "[ ] foo" / "[x] foo" as the first text of a list item -> disabled checkbox ---
function taskListRule(state: StateCore): void {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]?.type !== 'list_item_open') {
      continue;
    }
    const inline = tokens[i + 2];
    const firstChild = inline?.type === 'inline' ? inline.children?.[0] : null;
    if (!firstChild || firstChild.type !== 'text') {
      continue;
    }
    const match = /^\[([ xX])\]\s(.*)$/.exec(firstChild.content);
    if (!match?.[1] || match[2] === undefined) {
      continue;
    }
    firstChild.content = match[2];
    const checkbox = new state.Token('html_inline', '', 0);
    checkbox.content = `<input type="checkbox" disabled${match[1].toLowerCase() === 'x' ? ' checked' : ''}>`;
    inline?.children?.unshift(checkbox);
  }
}
md.core.ruler.push('task_list', taskListRule);

// --- Math placeholders: KaTeX itself is lazy-loaded in M4, this only marks the nodes ---
function mathInlineRule(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '$' || state.src[state.pos + 1] === '$') {
    return false;
  }
  const match = /^\$([^$\n]+?)\$/.exec(state.src.slice(state.pos));
  if (!match?.[1]) {
    return false;
  }
  if (!silent) {
    const token = state.push('math_inline', '', 0);
    token.content = match[1];
  }
  state.pos += match[0].length;
  return true;
}
md.inline.ruler.before('escape', 'math_inline', mathInlineRule);
const renderMathInline: RendererRule = (tokens, idx) =>
  `<span class="lm-math">${md.utils.escapeHtml(tokens[idx]?.content ?? '')}</span>`;
md.renderer.rules['math_inline'] = renderMathInline;

function mathBlockRule(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  const end = state.eMarks[startLine]!;
  if (state.src.slice(start, end).trim() !== '$$') {
    return false;
  }
  if (silent) {
    return true;
  }

  let nextLine = startLine;
  let content = '';
  let closed = false;
  while (++nextLine < endLine) {
    const lineStart = state.bMarks[nextLine]! + state.tShift[nextLine]!;
    const lineEnd = state.eMarks[nextLine]!;
    const line = state.src.slice(lineStart, lineEnd);
    if (line.trim() === '$$') {
      closed = true;
      break;
    }
    content += `${line}\n`;
  }
  if (!closed) {
    return false;
  }

  state.line = nextLine + 1;
  const token = state.push('math_block', '', 0);
  token.content = content.trim();
  token.map = [startLine, state.line];
  return true;
}
md.block.ruler.before('fence', 'math_block', mathBlockRule, {
  alt: ['paragraph', 'reference', 'blockquote', 'list'],
});
const renderMathBlock: RendererRule = (tokens, idx) =>
  `<div class="lm-math lm-math-block">${md.utils.escapeHtml(tokens[idx]?.content ?? '')}</div>`;
md.renderer.rules['math_block'] = renderMathBlock;

// --- Images: native lazy loading (CLAUDE.md "Images: Use lazy loading") + a class for CSS
// (responsive max-width, docs/PLAN.md M4) and for the runtime broken-image check in
// core/images.ts to target ---
function imageAttrsRule(state: StateCore): void {
  for (const token of state.tokens) {
    if (token.type !== 'inline' || !token.children) {
      continue;
    }
    for (const child of token.children) {
      if (child.type === 'image') {
        child.attrSet('loading', 'lazy');
        child.attrSet('class', 'lm-image');
      }
    }
  }
}
md.core.ruler.push('lm_image_attrs', imageAttrsRule);

// --- Headings: assign a stable id (for TOC/breadcrumb + anchor scroll) and collect them ---
function headingsRule(state: StateCore): void {
  const env = state.env as MarkdownEnv;
  env.headings = [];
  const slugger = createSlugger();
  const tokens = state.tokens;

  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    if (open?.type !== 'heading_open') {
      continue;
    }
    const level = Number(open.tag.slice(1));
    const inline = tokens[i + 1];
    const text =
      inline?.type === 'inline'
        ? (inline.children ?? [])
            .filter((t) => t.type === 'text' || t.type === 'code_inline')
            .map((t) => t.content)
            .join('')
        : '';
    const id = slugger.slug(text);
    open.attrSet('id', id);
    env.headings.push({ id, level, text });
  }
}
md.core.ruler.push('lm_headings', headingsRule);

export interface RenderResult {
  html: string;
  headings: Heading[];
}

export function renderMarkdown(source: string): RenderResult {
  const env: MarkdownEnv = {};
  const html = md.render(source, env);
  return { html, headings: env.headings ?? [] };
}
