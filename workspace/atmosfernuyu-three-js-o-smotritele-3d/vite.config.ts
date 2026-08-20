import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
  // @dimforge/rapier3d-compat inlines its wasm as base64, so no special wasm
  // handling is required — Vite builds it like any other ESM dependency.
  optimizeDeps: {
    exclude: [],
  },
});
