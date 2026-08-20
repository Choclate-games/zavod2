import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('@dimforge/rapier3d-compat')) return 'rapier';
          if (id.includes('howler')) return 'howler';
          if (id.includes('@playgama/bridge')) return 'bridge';
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
