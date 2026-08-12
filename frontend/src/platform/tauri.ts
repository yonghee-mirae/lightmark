// Tauri mode: @tauri-apps/api invoke()/listen() bridge to the 9 IPC commands (docs/IPC_SPEC.md),
// each a thin binding in src-tauri/src/lib.rs delegating to the `backend` Rust crate. This is
// the ONLY file allowed to import @tauri-apps/* (docs/ARCHITECTURE.md "Tauri Rules", enforced by
// ESLint's no-restricted-imports override for this path).

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
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
      void invoke('unwatch_file', { path });
    };
  }

  readConfig(): Promise<Config> {
    return invoke<Config>('read_config');
  }

  reloadConfig(): Promise<Config> {
    return invoke<Config>('reload_config');
  }

  resetConfig(): Promise<Config> {
    return invoke<Config>('reset_config');
  }

  openConfigFolder(): Promise<void> {
    return invoke('open_config_folder');
  }

  openConfigFile(): Promise<void> {
    return invoke('open_config_file');
  }

  // Not one of the 9 IPC_SPEC.md commands - lets main.ts pull the CLI/file-association path once
  // on startup, the same pull-based shape Dev mode gets for free from the `?file=` query param.
  getInitialPath(): Promise<string | null> {
    return invoke<string | null>('get_initial_path');
  }

  // Fires for file-association opens / a second launch while already running (src-tauri's
  // single-instance plugin re-emits into this same window instead of starting a new process),
  // and for dropping a file onto the window - the window config's `dragDropEnabled` (default
  // true) makes Tauri intercept OS-level drops before the DOM ever sees them, so
  // lm-viewer.ts's browser dataTransfer.files-based drop handling never fires under Tauri and
  // never gets a real path from it either; this native event is the one that actually carries a
  // usable filesystem path.
  onOpenPath(cb: (path: string) => void): void {
    void listen<string>('open-path', (event) => cb(event.payload));
    void getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'drop') {
        const path = event.payload.paths[0];
        if (path) {
          cb(path);
        }
      }
    });
  }
}
