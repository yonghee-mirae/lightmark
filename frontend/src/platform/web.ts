// Web mode: no OS/file-path access. File content comes from <input type="file"> or drag & drop
// (the drop itself is handled by lm-viewer; this class only covers the Open button flow).

import type { BackendApi, BackendCapabilities, OpenedFile, Unwatch } from './backend';
import type { Config } from '../types/config';
import { DEFAULT_CONFIG } from '../types/config';

export class WebBackend implements BackendApi {
  readonly capabilities: BackendCapabilities = { watch: false, configFile: false };

  openFile(): Promise<OpenedFile | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.markdown,text/markdown';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        void file.text().then((content) => resolve({ path: file.name, name: file.name, content }));
      });
      input.click();
    });
  }

  readFile(): Promise<string> {
    throw new Error('readFile is not supported in Web mode');
  }

  watchFile(): Promise<Unwatch> {
    throw new Error('watchFile is not supported in Web mode');
  }

  readConfig(): Promise<Config> {
    return Promise.resolve(DEFAULT_CONFIG);
  }

  reloadConfig(): Promise<Config> {
    return Promise.resolve(DEFAULT_CONFIG);
  }

  openConfigFolder(): Promise<void> {
    throw new Error('openConfigFolder is not supported in Web mode');
  }
}
