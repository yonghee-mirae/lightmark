// BackendApi contract. Implementations: WebBackend (this milestone), DevBackend, TauriBackend (later).
// Components never import this directly — only main.ts / assembly code does.

import type { Config } from '../types/config';
import { WebBackend } from './web';

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

export function createBackend(): BackendApi {
  return new WebBackend();
}
