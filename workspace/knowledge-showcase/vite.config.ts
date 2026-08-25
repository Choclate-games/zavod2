import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // Вторая страница — витрина анимаций (`anim.html`). Живёт в билде, а не
    // в dev-only ветке: её снимает Playwright, а он ходит по собранному дистру.
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: { main: 'index.html', anim: 'anim.html' },
      output: {
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-rapier': ['@dimforge/rapier3d-compat'],
        },
      },
    },
  },
});
