import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['pixi.js', 'matter-js', 'howler', '@playgama/bridge']
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true
  }
});
