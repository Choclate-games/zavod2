import { playgamaService } from './platform/PlaygamaService';
import { Game } from './core/Game';

async function bootstrap(): Promise<void> {
  // Initialize Playgama Platform Bridge
  await playgamaService.initialize();

  // Instantiate and launch game
  const game = new Game();
  game.start();

  // Send game ready signal to dismiss platform loading overlay
  playgamaService.sendGameReady();
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => {
    console.error('Fatal initialization error:', err);
  });
});