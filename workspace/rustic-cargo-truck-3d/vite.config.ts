import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    // Suppress the chunk size warning — Rapier WASM is necessarily large
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Three.js into its own cached chunk
          'vendor-three': ['three'],
          // Split Rapier (includes WASM binary) into its own cached chunk
          'vendor-rapier': ['@dimforge/rapier3d-compat'],
        },
      },
    },
  },
});
