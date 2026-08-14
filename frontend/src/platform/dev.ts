// Dev mode: `cargo run -p backend --features dev-server` running alongside `npm run dev`
// (docs/IPC_SPEC.md "Dev Server" table). Real filesystem access via HTTP+SSE instead of Tauri
// IPC. There is no native "open" dialog in this mode - opening a file works via a `?file=`
// query param (see main.ts), not `openFile()`, which is why that command has no Dev Server row
// in docs/IPC_SPEC.md.

import type { BackendApi, BackendCapabilities, OpenedFile, Unwatch } from './backend';
import type { Config } from '../types/config';

const BASE_URL = 'http://127.0.0.1:7878';

export class DevBackend implements BackendApi {
  readonly capabilities: BackendCapabilities = { watch: true, configFile: false };

  openFile(): Promise<OpenedFile | null> {
    return Promise.reject(new Error('openFile is not supported in Dev mode - use ?file=<path>'));
  }

  async readFile(path: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
      throw new Error(`readFile failed (${res.status}): ${await res.text()}`);
    }
    return res.text();
  }

  // docs/IPC_SPEC.md: "watch_file / unwatch_file: GET /api/events (SSE, 연결 종료=unwatch)" -
  // closing the EventSource *is* the unwatch call, there's no separate endpoint for it.
  watchFile(path: string, onChange: () => void): Promise<Unwatch> {
    const source = new EventSource(`${BASE_URL}/api/events?path=${encodeURIComponent(path)}`);
    source.addEventListener('message', () => onChange());
    return Promise.resolve(() => source.close());
  }

  async readConfig(): Promise<Config> {
    const res = await fetch(`${BASE_URL}/api/config`);
    return res.json() as Promise<Config>;
  }

  async reloadConfig(): Promise<Config> {
    const res = await fetch(`${BASE_URL}/api/config/reload`, { method: 'POST' });
    return res.json() as Promise<Config>;
  }

  openConfigFolder(): Promise<void> {
    return Promise.reject(new Error('openConfigFolder is not supported in Dev mode'));
  }

  openUrl(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer');
    return Promise.resolve();
  }

  setTitle(title: string): Promise<void> {
    document.title = title;
    return Promise.resolve();
  }
}
