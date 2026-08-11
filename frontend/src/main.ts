import './components/lm-toolbar';
import './components/lm-breadcrumb';
import './components/lm-toc';
import './components/lm-viewer';
import './components/lm-statusbar';
import { createBackend } from './platform/backend';
import { renderMarkdown } from './core/markdown';
import { buildToc } from './core/toc';
import type { LmToolbar } from './components/lm-toolbar';
import type { LmViewer, FileDropDetail, ActiveHeadingDetail } from './components/lm-viewer';
import type { LmStatusbar } from './components/lm-statusbar';
import type { LmToc } from './components/lm-toc';
import type { LmBreadcrumb } from './components/lm-breadcrumb';

const backend = createBackend();

const maybeToolbar = document.querySelector<LmToolbar>('lm-toolbar');
const maybeViewer = document.querySelector<LmViewer>('lm-viewer');
const maybeStatusbar = document.querySelector<LmStatusbar>('lm-statusbar');
const maybeToc = document.querySelector<LmToc>('lm-toc');
const maybeBreadcrumb = document.querySelector<LmBreadcrumb>('lm-breadcrumb');

if (!maybeToolbar || !maybeViewer || !maybeStatusbar || !maybeToc || !maybeBreadcrumb) {
  throw new Error('LightMark: required elements missing from index.html');
}

const toolbar = maybeToolbar;
const viewer = maybeViewer;
const statusbar = maybeStatusbar;
const toc = maybeToc;
const breadcrumb = maybeBreadcrumb;

toolbar.setCapabilities(backend.capabilities);
statusbar.setCapabilities(backend.capabilities);

function loadFile(name: string, content: string): void {
  const start = performance.now();
  const { html, headings } = renderMarkdown(content);
  statusbar.setRenderTime(performance.now() - start);

  // toc/breadcrumb must know about the new headings before viewer.setContent() runs: it
  // synchronously dispatches the initial 'lm-active-heading' for the first heading, and that
  // listener (below) would otherwise update toc/breadcrumb against the previous document.
  toc.setToc(buildToc(headings));
  breadcrumb.setHeadings(headings);
  viewer.setContent(html, headings);
  statusbar.setFilename(name);
}

toolbar.addEventListener('lm-open', () => {
  void backend.openFile().then((opened) => {
    if (opened) {
      loadFile(opened.name, opened.content);
    }
  });
});

viewer.addEventListener('lm-file-drop', (event) => {
  const { name, content } = (event as CustomEvent<FileDropDetail>).detail;
  loadFile(name, content);
});

viewer.addEventListener('lm-active-heading', (event) => {
  const { id } = (event as CustomEvent<ActiveHeadingDetail>).detail;
  toc.setActive(id);
  breadcrumb.setActive(id);
});
