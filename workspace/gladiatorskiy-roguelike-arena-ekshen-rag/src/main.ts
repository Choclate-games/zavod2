import { playgamaService } from './platform/PlaygamaService';
import { storageService } from './platform/StorageService';
import { Game } from './core/Game';

function installViewportGuards(): void {
  // Prevent rubber-banding, pull-to-refresh and context menus
  document.addEventListener(
    'touchmove',
    (e) => {
      if ((e.target as HTMLElement).closest('#forge-items')) return;
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  document.addEventListener('dragstart', (e) => {
    e.preventDefault();
  });
}

async function bootstrap(): Promise<void> {
  console.log('[Bootstrap] Initializing Gladiator Roguelike Arena...');
  installViewportGuards();

  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Canvas container #game-container not found');
  }

  // 1. Initialize Playgama Bridge
  await playgamaService.initialize();

  // 2. Load Save State (Cloud or LocalStorage mirror)
  await storageService.load();

  // 3. Construct Game Engine & Systems
  const game = new Game(container);

  // 4. Progress driver
  game.uiManager.setPreloaderProgress(50, 'Возведение трибун Колизея...');

  await new Promise((r) => setTimeout(r, 200));
  game.uiManager.setPreloaderProgress(90, 'Заточка гладиусов...');

  await new Promise((r) => setTimeout(r, 250));
  game.uiManager.setPreloaderProgress(100, 'Арена готова!');

  await new Promise((r) => setTimeout(r, 300));

  // 5. Hide preloader, send game_ready (single-shot) and launch game
  game.uiManager.hidePreloader();
  playgamaService.sendGameReady();
  game.start();

  console.log('[Bootstrap] Game running successfully at 60 FPS.');
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => {
    console.error('[Bootstrap] Fatal startup error:', err);
    // Send watchdog game_ready to avoid hanging
    playgamaService.sendGameReady();
  });
});
