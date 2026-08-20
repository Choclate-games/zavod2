import { playgamaService } from './platform/PlaygamaService';
import { storageService } from './platform/StorageService';
import { Game } from './core/Game';

/**
 * 1. Viewport Guards (Yandex Games / Mobile standard compliance)
 */
function installViewportGuards(): void {
  // Update CSS viewport height
  const updateViewportHeight = () => {
    document.documentElement.style.setProperty('--vp-h', `${window.innerHeight}px`);
  };
  updateViewportHeight();
  window.addEventListener('resize', updateViewportHeight);
  window.addEventListener('orientationchange', () => {
    setTimeout(updateViewportHeight, 200);
    setTimeout(updateViewportHeight, 600);
  });

  // Block gestures, pull-to-refresh, select and context menu
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());

  document.addEventListener(
    'touchmove',
    (e) => {
      // Allow single touch pointer tracking, block double pinch zoom on page body
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

/**
 * Main application bootstrap
 */
async function bootstrap(): Promise<void> {
  // 1. Install Viewport Guards
  installViewportGuards();

  // 2. Initialize Playgama Bridge
  await playgamaService.initialize();

  // 3. Load Save Data (Cloud & Local)
  await storageService.load();

  // 4. Initialize Core Game Engine & Scene
  const game = new Game();
  game.start();

  // 5. Signal game_ready to Platform after first interactive frame
  setTimeout(() => {
    playgamaService.sendGameReady();
  }, 400);
}

// Launch
bootstrap().catch((err) => {
  console.error('[Main] Fatal boot error:', err);
});
