import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          bridge: ['@playgama/bridge']
        }
      }
    }
  },
  server: {
    host: true,
    port: 3000
  }
});
