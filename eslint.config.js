import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: globals.browser,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // TypeScript själv fångar odefinierade identifierare. Basregeln no-undef
      // ger falska positiva på ambienta DOM-typer (t.ex. ParentNode) som inte
      // finns i "globals"-listan — avstängd enligt typescript-eslints egen
      // rekommendation.
      'no-undef': 'off',
    },
  },
  {
    files: ['test/**/*.ts', '*.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // TypeScript själv fångar odefinierade identifierare. Basregeln no-undef
      // ger falska positiva på ambienta DOM-typer (t.ex. ParentNode) som inte
      // finns i "globals"-listan — avstängd enligt typescript-eslints egen
      // rekommendation.
      'no-undef': 'off',
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: globals.serviceworker,
    },
  },
  prettierConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
