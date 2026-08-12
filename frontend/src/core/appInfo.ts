// Single source of truth for the About dialog's app name/version (docs/PLAN.md M7). Reads
// frontend/package.json directly (tsconfig's resolveJsonModule) instead of asking the platform
// for it, so About shows the same thing in Web/Dev/Tauri without depending on any platform API.

import packageJson from '../../package.json';

export const APP_NAME = 'LightMark';
export const APP_TAGLINE = 'Fast, lightweight, focused Markdown viewer.';
export const APP_VERSION: string = packageJson.version;
export const APP_AUTHOR = 'Yonghee Yu';
