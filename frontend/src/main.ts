import './components/lm-toolbar';
import './components/lm-breadcrumb';
import './components/lm-toc';
import './components/lm-viewer';
import './components/lm-statusbar';
import './components/lm-about';
import { createBackend } from './platform/backend';
import { renderMarkdown } from './core/markdown';
import { buildToc } from './core/toc';
import { applyTheme } from './core/theme';
import { DEFAULT_CONFIG, configsEqual } from './types/config';
import type { Config } from './types/config';
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, ZOOM_RESET } from './components/lm-toolbar';
import type { LmToolbar } from './components/lm-toolbar';
import type { LmViewer, FileDropDetail, ActiveHeadingDetail } from './components/lm-viewer';
import type { LmStatusbar } from './components/lm-statusbar';
import type { LmToc, TocSelectDetail } from './components/lm-toc';
import type { LmBreadcrumb } from './components/lm-breadcrumb';
import type { LmAbout } from './components/lm-about';

const backend = await createBackend();

// Read once at startup; loadFile() below reads from this for the lazy-loader flags (M4). Starts
// as DEFAULT_CONFIG so an extremely fast file-open can't race ahead of the readConfig() microtask.
let currentConfig: Config = DEFAULT_CONFIG;
// Session-only (docs/PLAN.md M7): starts from the config's tocVisible, but toggling it below
// never writes back to config.json - CLAUDE.md's "No graphical settings editor" applies.
let tocVisible = DEFAULT_CONFIG.tocVisible;
// Session-only (docs/PLAN.md M7, same reasoning as tocVisible above) - starts from the config's
// zoom, but the +/-/reset buttons below never write back to config.json.
let zoom = DEFAULT_CONFIG.zoom;
void backend.readConfig().then((config) => {
  currentConfig = config;
  applyTheme(config);
  tocVisible = config.tocVisible;
  updateTocDisplay();
  zoom = config.zoom;
  toolbar.setZoom(zoom);
  statusbar.setZoom(zoom);
});

const maybeToolbar = document.querySelector<LmToolbar>('lm-toolbar');
const maybeViewer = document.querySelector<LmViewer>('lm-viewer');
const maybeStatusbar = document.querySelector<LmStatusbar>('lm-statusbar');
const maybeToc = document.querySelector<LmToc>('lm-toc');
const maybeBreadcrumb = document.querySelector<LmBreadcrumb>('lm-breadcrumb');
const maybeContent = document.querySelector<HTMLDivElement>('.lm-content');
const maybeAbout = document.querySelector<LmAbout>('lm-about');

if (
  !maybeToolbar ||
  !maybeViewer ||
  !maybeStatusbar ||
  !maybeToc ||
  !maybeBreadcrumb ||
  !maybeContent ||
  !maybeAbout
) {
  throw new Error('LightMark: required elements missing from index.html');
}

const toolbar = maybeToolbar;
const viewer = maybeViewer;
const statusbar = maybeStatusbar;
const toc = maybeToc;
const breadcrumb = maybeBreadcrumb;
const contentEl = maybeContent;
const about = maybeAbout;

// No document to show a TOC for yet, so the sidebar stays hidden (and its toggle button disabled,
// via toolbar.setHasDocument()) until loadFile() runs the first time - regardless of tocVisible.
let hasDocument = false;

function updateTocDisplay(): void {
  contentEl.classList.toggle('lm-toc-hidden', !hasDocument || !tocVisible);
  toolbar.setTocVisible(tocVisible);
}
updateTocDisplay();

toolbar.addEventListener('lm-toc-toggle', () => {
  tocVisible = !tocVisible;
  updateTocDisplay();
});

// Clamped to [ZOOM_MIN, ZOOM_MAX] (the range docs/PLAN.md M3 verified the CSS scaling looks
// right across) and only touches --lm-zoom (via applyTheme, reusing currentConfig for every
// other field) - no re-render of the document itself, unlike Apply's config-driven fields.
function setZoom(value: number): void {
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
  if (clamped === zoom) {
    return;
  }
  zoom = clamped;
  applyTheme({ ...currentConfig, zoom });
  toolbar.setZoom(zoom);
  statusbar.setZoom(zoom);
}

toolbar.addEventListener('lm-zoom-out', () => setZoom(zoom - ZOOM_STEP));
toolbar.addEventListener('lm-zoom-reset', () => setZoom(ZOOM_RESET));
toolbar.addEventListener('lm-zoom-in', () => setZoom(zoom + ZOOM_STEP));

toolbar.setCapabilities(backend.capabilities);

// The currently displayed document's raw content, kept so Reload Config (below) can re-render it
// against the new config without re-reading the file - config fields that only take
// effect at render time (mermaidTheme, syntaxHighlight/mermaid/katex on-off, theme's effect on
// Shiki's baked-in code colors) are otherwise stuck showing whatever was true when the document
// was first opened, unlike the CSS-variable-driven fields applyTheme() already updates live.
let currentDoc: { name: string; content: string } | null = null;

function loadFile(name: string, content: string): void {
  currentDoc = { name, content };
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
    mermaidTheme: currentConfig.mermaidTheme,
    katex: currentConfig.katex,
    syntaxHighlight: currentConfig.syntaxHighlight,
  });
  statusbar.setFilename(name);
  toolbar.setHasDocument(true);
  hasDocument = true;
  updateTocDisplay();
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
    viewer.focusHeading(anchor);
  }
}

// No-op if no document is open yet - Reload Config works with or without one.
function rerenderCurrentDocument(): void {
  if (currentDoc) {
    reloadFile(currentDoc.name, currentDoc.content);
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
      loadFile(opened.name, opened.content);
      // A no-op for Web/Dev (capabilities.watch is false there, and Dev's openFile() never
      // resolves to begin with) - only Tauri's dialog returns a real, watchable path.
      watchPath(opened.path);
    }
  });
});

toolbar.addEventListener('lm-print', () => {
  window.print();
});

toolbar.addEventListener('lm-about', () => {
  about.open();
});

toolbar.addEventListener('lm-config-folder', () => {
  void backend.openConfigFolder();
});

toolbar.addEventListener('lm-reload-config', () => {
  void backend.reloadConfig().then((config) => {
    // Nothing actually changed (the common case - Apply clicked without editing config.json in
    // between) - skip applyTheme()/rerenderCurrentDocument() so an unrelated Apply click doesn't
    // re-run the renderer and bump the perf indicator's render time for no reason.
    if (configsEqual(config, currentConfig)) {
      return;
    }
    currentConfig = config;
    applyTheme(config);
    rerenderCurrentDocument();
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

// A TOC click always focuses that heading immediately, even in the one case scroll-driven
// tracking alone can't handle: the target is already fully visible (e.g. one of several headings
// all shown together at the very end of a short document), so jumping to it causes no actual
// scroll and therefore no scroll/scrollend event to react to (docs/PLAN.md M2).
toc.addEventListener('lm-toc-select', (event) => {
  const { id } = (event as CustomEvent<TocSelectDetail>).detail;
  viewer.focusHeading(id);
});

// Dev/Tauri mode: there's no native "Open" dialog outside Tauri, so a real filesystem path opens
// via `?file=<path>` instead of BackendApi.openFile() (docs/IPC_SPEC.md: open_file has no Dev
// Server route). Gated on capabilities.watch since that's exactly the Web-vs-Dev/Tauri split for
// "can this backend read an arbitrary path at all".
const filePath = new URLSearchParams(location.search).get('file');
if (filePath && backend.capabilities.watch) {
  openPath(filePath);
}

// Tauri: no `?file=` query param to read, so the initial CLI/file-association path (if any) is
// pulled once via getInitialPath() instead, and any later open (double-clicking another .md,
// which src-tauri's single-instance plugin routes into this same window) pushes via onOpenPath().
void backend.getInitialPath?.().then((path) => {
  if (path) {
    openPath(path);
  }
});
backend.onOpenPath?.((path) => openPath(path));
