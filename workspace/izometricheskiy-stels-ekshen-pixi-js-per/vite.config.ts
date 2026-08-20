import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          matter: ['matter-js'],
          howler: ['howler']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000
  }
});
