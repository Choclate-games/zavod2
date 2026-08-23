import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  }
});
