import { PlaygamaService } from './platform/PlaygamaService';
import { Game } from './core/Game';

// 1. Install Viewport & Mobile Guards
function installViewportGuards(): void {
  // Prevent contextmenu
  document.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });

  // Prevent dragstart
  document.addEventListener('dragstart', (e) => e.preventDefault(), { capture: true });

  // Prevent selectstart
  document.addEventListener('selectstart', (e) => e.preventDefault(), { capture: true });

  // Prevent pull-to-refresh & overscroll bounce on touch devices
  document.addEventListener(
    'touchmove',
    (e) => {
      // If not scrolling an explicit inner container, prevent bounce
      if (e.target instanceof HTMLElement && e.target.closest('.workshop-list')) {
        return; // allow inner scroll
      }
      if (e.touches.length > 1) {
        e.preventDefault(); // cancel multitouch zooming
      }
    },
    { passive: false }
  );

  // Resize viewport fix for 100vh on mobile browsers
  const updateViewportHeight = () => {
    document.documentElement.style.setProperty('--vp-h', `${window.innerHeight}px`);
  };
  window.addEventListener('resize', updateViewportHeight);
  updateViewportHeight();
}

async function bootstrap(): Promise<void> {
  installViewportGuards();

  const playgama = PlaygamaService.getInstance();
  playgama.setLoadingProgress(25);

  // 2. Initialize Platform SDK
  await playgama.init();
  playgama.setLoadingProgress(60);

  // 3. Initialize Game Canvas & Engine
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found in DOM.');
  }

  const game = new Game(canvas);
  playgama.setLoadingProgress(90);

  // 4. Ensure Fonts & DOM painted
  try {
    await (document as any).fonts?.ready;
  } catch {}

  // Short delay for splash smoothness
  await new Promise((r) => setTimeout(r, 300));
  playgama.setLoadingProgress(100);

  // 5. Send single-shot game_ready
  playgama.sendGameReady();

  // 6. Start Game
  game.start();
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => {
    console.error('Fatal initialization error:', err);
    // Watchdog fallback
    PlaygamaService.getInstance().sendGameReady();
  });
});
