// Tauri mode: @tauri-apps/api invoke()/listen() bridge to the 9 IPC commands (docs/IPC_SPEC.md),
// each a thin binding in src-tauri/src/lib.rs delegating to the `backend` Rust crate. This is
// the ONLY file allowed to import @tauri-apps/* (docs/ARCHITECTURE.md "Tauri Rules", enforced by
// ESLint's no-restricted-imports override for this path).

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { BackendApi, BackendCapabilities, OpenedFile, Unwatch } from './backend';
import type { Config } from '../types/config';

export class TauriBackend implements BackendApi {
  readonly capabilities: BackendCapabilities = { watch: true, configFile: true };

  openFile(): Promise<OpenedFile | null> {
    return invoke<OpenedFile | null>('open_file');
  }

  readFile(path: string): Promise<string> {
    return invoke<string>('read_file', { path });
  }

  // docs/IPC_SPEC.md merges watch_file/unwatch_file into one BackendApi.watchFile() call.
  // `file-changed` events carry the watched path so a listener from a previous watchFile() call
  // (if unwatch() raced with a new watchFile()) can't fire the wrong callback.
  async watchFile(path: string, onChange: () => void): Promise<Unwatch> {
    await invoke('watch_file', { path });
    const unlisten = await listen<string>('file-changed', (event) => {
      if (event.payload === path) {
        onChange();
      }
    });
    return () => {
      unlisten();
      // No path argument - src-tauri now keys WatcherRegistry by the calling window's own label
      // (docs/PLAN.md "멀티 윈도우/인스턴스 지원"), grabbed there via an injected WebviewWindow
      // parameter rather than passed from here.
      void invoke('unwatch_file');
    };
  }

  readConfig(): Promise<Config> {
    return invoke<Config>('read_config');
  }

  reloadConfig(): Promise<Config> {
    return invoke<Config>('reload_config');
  }

  openConfigFolder(): Promise<void> {
    return invoke('open_config_folder');
  }

  // Native OS drag&drop onto this window - the window config's `dragDropEnabled` (default true)
  // makes Tauri intercept OS-level drops before the DOM ever sees them, so lm-viewer.ts's browser
  // dataTransfer.files-based drop handling never fires under Tauri and never gets a real path
  // from it either; this native event is the one that actually carries usable filesystem paths.
  // Second-launch/file-association opens used to re-emit into this same window via an
  // `open-path` event - that's gone now that each of those opens its own new window instead
  // (docs/PLAN.md "멀티 윈도우/인스턴스 지원"), so this is purely drag&drop these days.
  onFileDrop(cb: (paths: string[]) => void): void {
    void getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'drop' && event.payload.paths.length > 0) {
        cb(event.payload.paths);
      }
    });
  }

  // Lets main.ts open another file dropped alongside the first one in its own new window
  // (docs/PLAN.md "멀티 윈도우/인스턴스 지원": dropping N files replaces this window's content
  // with the first and opens a new window per remaining file, mirroring the macOS "Open With"
  // multi-select rule).
  openWindow(path: string): Promise<void> {
    return invoke('open_new_window', { path });
  }

  // A hyperlink inside a rendered document (lm-viewer.ts's 'lm-external-link' event) - opens in
  // the OS default browser instead of navigating this window's own webview away from LightMark
  // (user report). Bypasses tauri-plugin-opener's own `open_url` IPC command (and its ACL scope
  // machinery) the same way open_config_folder already bypasses `open_path` - a thin src-tauri
  // command calling the `Opener` extension trait directly.
  openUrl(url: string): Promise<void> {
    return invoke('open_url', { url });
  }

  // Bug report: only a window created with a file already in its URL (double-click/CLI/"Open
  // With") ever got "LightMark — {name}" as its title - src-tauri/src/lib.rs's open_window() sets
  // that at creation time, but the toolbar Open button and drag&drop just load content into the
  // current window without ever touching it, leaving it on the bare "LightMark" the window was
  // created with. A direct `core:window` API call, not a custom src-tauri command - no Rust
  // changes needed, just `core:window:allow-set-title` in capabilities/default.json (window title
  // isn't part of that plugin's own `default` permission set, unlike most of the rest of it).
  setTitle(title: string): Promise<void> {
    return getCurrentWindow().setTitle(title);
  }
}
