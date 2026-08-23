import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
  },
  server: {
    port: 3000,
    host: true,
  },
});
