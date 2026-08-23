import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
  },
  server: {
    host: true,
    port: 5173,
  },
})
