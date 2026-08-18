import { Game } from './core/Game';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element #game-canvas not found');
    return;
  }

  try {
    const game = new Game(canvas);
    await game.init();
    console.log('Bioslime: Royal Hunt 3D successfully launched!');
  } catch (error) {
    console.error('Failed to initialize Bioslime game:', error);
  }
});
