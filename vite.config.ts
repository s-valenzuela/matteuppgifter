/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Sidan körs på den egna domänen matteuppgifter.se (se public/CNAME), inte
  // under en /matteuppgifter/-undersökväg som github.io-adressen hade — base
  // måste vara rot, annars pekar alla byggda tillgångar (skript, manifest,
  // service worker) på fel plats.
  base: '/',
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
