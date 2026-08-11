/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/matteuppgifter/',
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
