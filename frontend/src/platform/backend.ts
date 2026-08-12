// BackendApi contract. Implementations: WebBackend, DevBackend, TauriBackend.
// Components never import this directly — only main.ts / assembly code does.

import type { Config } from '../types/config';
import { WebBackend } from './web';
import { DevBackend } from './dev';

const DEV_SERVER_HEALTH_URL = 'http://127.0.0.1:7878/api/health';

// Same check @tauri-apps/api/core's isTauri() does - inlined here (rather than importing it)
// because @tauri-apps/* may only be imported from platform/tauri.ts (docs/ARCHITECTURE.md
// "Tauri Rules", ESLint-enforced).
function isTauri(): boolean {
  return Boolean((globalThis as { isTauri?: boolean }).isTauri);
}

export interface OpenedFile {
  path: string;
  name: string;
  content: string;
}

export type Unwatch = () => void;

export interface BackendCapabilities {
  watch: boolean;
  configFile: boolean;
}

export interface BackendApi {
  readonly capabilities: BackendCapabilities;
  openFile(): Promise<OpenedFile | null>;
  readFile(path: string): Promise<string>;
  watchFile(path: string, onChange: () => void): Promise<Unwatch>;
  readConfig(): Promise<Config>;
  reloadConfig(): Promise<Config>;
  openConfigFolder(): Promise<void>;
  openConfigFile(): Promise<void>;
  resetConfig(): Promise<Config>;
  // Optional: only TauriBackend implements these. There's no "open on startup" concept in
  // Web/Dev - Dev mode gets the same job done via the `?file=` query param directly in main.ts.
  getInitialPath?(): Promise<string | null>;
  onOpenPath?(cb: (path: string) => void): void;
}

// Mode selection lives here and only here (docs/PLAN.md architecture table):
// 1. Tauri (window.isTauri) - checked first: a Tauri build's webview is also Vite's dev server
//    during `tauri dev` (import.meta.env.DEV is true there too), so Tauri must win over Dev mode
//    even if a `cargo run -p backend --features dev-server` happens to be running alongside it.
// 2. Dev - only ever attempted in `npm run dev` (import.meta.env.DEV), and only if the dev
//    server's health check actually answers; a plain `npm run dev` with no backend running
//    must still fall through to Web.
// 3. Web.
export async function createBackend(): Promise<BackendApi> {
  if (isTauri()) {
    const { TauriBackend } = await import('./tauri');
    return new TauriBackend();
  }
  if (import.meta.env.DEV && (await devServerAvailable())) {
    return new DevBackend();
  }
  return new WebBackend();
}

async function devServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(DEV_SERVER_HEALTH_URL, { signal: AbortSignal.timeout(300) });
    return res.ok;
  } catch {
    return false;
  }
}
