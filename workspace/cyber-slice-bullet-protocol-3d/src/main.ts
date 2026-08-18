import { Game } from './core/Game';
import { Playgama } from './platform/PlaygamaService';
import { Storage } from './platform/StorageService';
import { Audio } from './audio/AudioManager';
import { i18n } from './platform/Localization';

function installViewportGuards(): void {
  // Lock viewport, prevent context menu, pinch-to-zoom, bounce-scroll
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehavior = 'none';

  window.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });
  window.addEventListener('dragstart', (e) => e.preventDefault(), { capture: true });
  window.addEventListener('selectstart', (e) => e.preventDefault(), { capture: true });

  window.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

async function bootstrap(): Promise<void> {
  installViewportGuards();

  // Progress driver
  let currentProgress = 10;
  Playgama.setProgress(currentProgress);

  // 1. Bootstrap Playgama SDK
  await Playgama.bootstrap();
  currentProgress = 35;
  Playgama.setProgress(currentProgress);

  // 2. Load Save & Settings
  const profile = await Storage.init();
  i18n.setLocale(profile.settings.language);
  currentProgress = 60;
  Playgama.setProgress(currentProgress);

  // 3. Audio Engine Init
  Audio.init();
  currentProgress = 80;
  Playgama.setProgress(currentProgress);

  // 4. Initialize 3D Engine & Scene
  const gameContainer = document.getElementById('canvas-container')!;
  const game = new Game(gameContainer);
  (window as unknown as { __game: Game }).__game = game;

  await game.start();
  currentProgress = 100;
  Playgama.setProgress(currentProgress);

  // Wait for document fonts and render settle
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  // 5. Send single-shot game_ready
  setTimeout(() => {
    Playgama.sendGameReady();
    const loader = document.getElementById('loading-overlay');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.remove(), 700);
    }
  }, 300);
}

// 15s Watchdog
window.addEventListener('DOMContentLoaded', () => {
  const watchdog = setTimeout(() => {
    Playgama.sendGameReady();
  }, 15_000);

  bootstrap()
    .catch((err) => {
      console.error('Fatal boot error:', err);
      Playgama.sendGameReady();
    })
    .finally(() => clearTimeout(watchdog));
});
