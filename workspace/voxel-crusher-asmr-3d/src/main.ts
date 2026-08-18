import { PlaygamaService } from './platform/PlaygamaService';
import { Game } from './core/Game';

async function bootstrap(): Promise<void> {
  console.log('[Main] Bootstrapping Voxel Crusher ASMR 3D...');

  // 1. Initialize platform bridge
  const playgama = PlaygamaService.getInstance();
  await playgama.initialize();

  // 2. Instantiate and launch game
  try {
    const game = new Game();
    await game.init();

    // Expose in window for development debugging
    (window as any).__game = game;
  } catch (err) {
    console.error('[Main] Fatal error during game initialization:', err);
    // Ensure splash is lifted even on failure
    playgama.sendGameReady();
  }
}

// Start on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap());
} else {
  bootstrap();
}
