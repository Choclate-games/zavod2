import './style.css';
import { Game } from './core/Game';
import { installViewportGuards } from './platform/viewport';

installViewportGuards();

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');

const game = new Game(app);

if (import.meta.env.DEV) {
  Object.assign(window, { __game: game });
}

const watchdog = window.setTimeout(() => {
  console.warn('[boot] watchdog reached before normal ready path');
}, 15_000);

game.boot()
  .catch((error: unknown) => {
    console.error('[boot] failed', error);
    app.innerHTML = '<div style="position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#07111f;color:white;font:16px system-ui;text-align:center">Не удалось запустить WebGL игру. Обновите страницу или проверьте поддержку браузера.</div>';
  })
  .finally(() => window.clearTimeout(watchdog));
