/**
 * Main application entry point for Metro-Balancer: Rush Hour.
 */

import './ui/theme.css';
import { Game } from './core/Game';
import { PlaygamaService } from './platform/PlaygamaService';

async function bootstrap() {
  const playgama = PlaygamaService.get();

  // 1. Initialize platform bridge
  await playgama.bootstrap();
  playgama.setGameLoadingProgress(25);

  // 2. Locate canvas and UI root elements
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui-root') as HTMLElement;

  if (!canvas || !uiRoot) {
    console.error('Missing canvas or ui-root elements');
    return;
  }

  playgama.setGameLoadingProgress(50);

  // 3. Instantiate and initialize Game
  const game = new Game(canvas, uiRoot);
  playgama.setGameLoadingProgress(75);

  await game.init();
  playgama.setGameLoadingProgress(100);

  // 4. Send platform ready signal
  playgama.notifyPlatformReady();
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => {
    console.error('Fatal initialization error:', err);
    PlaygamaService.get().notifyPlatformReady();
  });
});
