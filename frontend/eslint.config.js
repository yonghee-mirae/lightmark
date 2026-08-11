import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tauri-apps/*'],
              message: 'Tauri APIs must only be imported in src/platform/tauri.ts',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/platform/tauri.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  prettierConfig,
);
