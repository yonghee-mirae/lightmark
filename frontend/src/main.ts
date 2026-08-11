import './components/lm-toolbar';
import './components/lm-breadcrumb';
import './components/lm-toc';
import './components/lm-viewer';
import './components/lm-statusbar';
import { createBackend } from './platform/backend';
import type { LmToolbar } from './components/lm-toolbar';
import type { LmViewer, FileDropDetail } from './components/lm-viewer';
import type { LmStatusbar } from './components/lm-statusbar';

const backend = createBackend();

const maybeToolbar = document.querySelector<LmToolbar>('lm-toolbar');
const maybeViewer = document.querySelector<LmViewer>('lm-viewer');
const maybeStatusbar = document.querySelector<LmStatusbar>('lm-statusbar');

if (!maybeToolbar || !maybeViewer || !maybeStatusbar) {
  throw new Error('LightMark: required elements missing from index.html');
}

const toolbar = maybeToolbar;
const viewer = maybeViewer;
const statusbar = maybeStatusbar;

toolbar.setCapabilities(backend.capabilities);
statusbar.setCapabilities(backend.capabilities);

function loadFile(name: string, content: string): void {
  viewer.setRawContent(content);
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
