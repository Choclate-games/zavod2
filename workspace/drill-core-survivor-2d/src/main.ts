import { playgamaService } from './platform/PlaygamaService';
import { storageService } from './platform/StorageService';
import { game } from './core/Game';

async function bootstrap(): Promise<void> {
  console.log('[Bootstrap] Starting Бур Судного Дня: Шахтерский Рогалик...');

  try {
    // 1. Initialize Playgama SDK with timeout guard
    await playgamaService.initialize();

    // 2. Load cloud save & local storage
    await storageService.load();

    // 3. Initialize Game Engine, PixiJS, Web Audio, and UI
    await game.init();

    // 4. Send game_ready once start screen is interactive
    playgamaService.sendGameReady();

    console.log('[Bootstrap] Game loaded and ready!');
  } catch (err) {
    console.error('[Bootstrap] Error during bootstrap:', err);
    // Ensure game ready sent even on unexpected errors
    playgamaService.sendGameReady();
  }
}

// Start game
window.addEventListener('DOMContentLoaded', () => {
  bootstrap();
});
