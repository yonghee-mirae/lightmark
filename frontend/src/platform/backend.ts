// BackendApi contract. Implementations: WebBackend, DevBackend, TauriBackend (M6).
// Components never import this directly — only main.ts / assembly code does.

import type { Config } from '../types/config';
import { WebBackend } from './web';
import { DevBackend } from './dev';

const DEV_SERVER_HEALTH_URL = 'http://127.0.0.1:7878/api/health';

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
}

// Mode selection lives here and only here (docs/PLAN.md architecture table):
// 1. Tauri (window.__TAURI_INTERNALS__) - not implemented until M6, so not checked yet.
// 2. Dev - only ever attempted in `npm run dev` (import.meta.env.DEV), and only if the dev
//    server's health check actually answers; a plain `npm run dev` with no backend running
//    must still fall through to Web.
// 3. Web.
export async function createBackend(): Promise<BackendApi> {
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
