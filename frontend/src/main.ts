import './components/lm-toolbar';
import './components/lm-breadcrumb';
import './components/lm-toc';
import './components/lm-viewer';
import './components/lm-statusbar';
import { createBackend } from './platform/backend';
import { renderMarkdown } from './core/markdown';
import { buildToc } from './core/toc';
import { applyTheme } from './core/theme';
import { DEFAULT_CONFIG } from './types/config';
import type { Config } from './types/config';
import type { LmToolbar } from './components/lm-toolbar';
import type { LmViewer, FileDropDetail, ActiveHeadingDetail } from './components/lm-viewer';
import type { LmStatusbar } from './components/lm-statusbar';
import type { LmToc } from './components/lm-toc';
import type { LmBreadcrumb } from './components/lm-breadcrumb';

const backend = await createBackend();

// Read once at startup; loadFile() below reads from this for the lazy-loader flags (M4). Starts
// as DEFAULT_CONFIG so an extremely fast file-open can't race ahead of the readConfig() microtask.
let currentConfig: Config = DEFAULT_CONFIG;
void backend.readConfig().then((config) => {
  currentConfig = config;
  applyTheme(config);
});

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
  viewer.setContent(html, headings, {
    theme: currentConfig.theme,
    mermaid: currentConfig.mermaid,
    katex: currentConfig.katex,
    syntaxHighlight: currentConfig.syntaxHighlight,
  });
  statusbar.setFilename(name);
}

// Live reload's watch state. Only ever one at a time - LightMark shows one document.
let activeWatchPath: string | null = null;
let unwatch: (() => void) | null = null;

function stopWatching(): void {
  unwatch?.();
  unwatch = null;
  activeWatchPath = null;
}

function watchPath(path: string): void {
  stopWatching();
  if (!backend.capabilities.watch) {
    return;
  }
  activeWatchPath = path;
  void backend
    .watchFile(path, () => {
      void backend.readFile(path).then((content) => reloadFile(basename(path), content));
    })
    .then((stop) => {
      // The user may have opened something else while this promise was pending.
      if (activeWatchPath === path) {
        unwatch = stop;
      } else {
        stop();
      }
    });
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

// Re-render but keep the reader's place instead of snapping back to the top of the document
// (docs/PLAN.md M5 - without this, every save from the editor would jump live reload to the top).
function reloadFile(name: string, content: string): void {
  const anchor = viewer.getActiveId();
  loadFile(name, content);
  if (anchor) {
    viewer.scrollToHeading(anchor);
  }
}

function openPath(path: string): void {
  void backend.readFile(path).then((content) => {
    loadFile(basename(path), content);
    watchPath(path);
  });
}

toolbar.addEventListener('lm-open', () => {
  void backend.openFile().then((opened) => {
    if (opened) {
      stopWatching();
      loadFile(opened.name, opened.content);
    }
  });
});

viewer.addEventListener('lm-file-drop', (event) => {
  const { name, content } = (event as CustomEvent<FileDropDetail>).detail;
  stopWatching();
  loadFile(name, content);
});

viewer.addEventListener('lm-active-heading', (event) => {
  const { id } = (event as CustomEvent<ActiveHeadingDetail>).detail;
  toc.setActive(id);
  breadcrumb.setActive(id);
});

// Dev/Tauri mode: there's no native "Open" dialog outside Tauri, so a real filesystem path opens
// via `?file=<path>` instead of BackendApi.openFile() (docs/IPC_SPEC.md: open_file has no Dev
// Server route). Gated on capabilities.watch since that's exactly the Web-vs-Dev/Tauri split for
// "can this backend read an arbitrary path at all".
const filePath = new URLSearchParams(location.search).get('file');
if (filePath && backend.capabilities.watch) {
  openPath(filePath);
}
