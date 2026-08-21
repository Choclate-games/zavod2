import { Game } from './core/Game';

window.addEventListener('DOMContentLoaded', async () => {
  const app = document.querySelector('#app');
  if (!app) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  canvas.setAttribute(
    'style',
    'position: absolute; top: 0; left: 0; width: 100%;height: 100%; display: block;'
  );
  app.appendChild(canvas);

  const uiContainer = document.createElement('div');
  uiContainer.id = 'ui-container';
  uiContainer.setAttribute(
    'style',
    'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;'
  );
  app.appendChild(uiContainer);

  try {
    const game = new Game(canvas, uiContainer);
    await game.initialize();
  } catch (err) {
    console.error('Failed to start Game:', err);
  }
});
