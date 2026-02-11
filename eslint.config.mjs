import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default defineConfig([
  globalIgnores(['**/dist/', '**/node_modules/']),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    extends: compat.extends('eslint:recommended'),
    languageOptions: {
      globals: {
        ...globals.node,
        Electron: true,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      indent: ['error', 2, {
        SwitchCase: 1,
      }],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
    },
  }
]);
