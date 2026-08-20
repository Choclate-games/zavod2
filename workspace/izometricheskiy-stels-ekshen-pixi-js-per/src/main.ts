/**
 * Main Game Bootstrap & Playgama Bridge Lifecycle Orchestrator
 */

import { installViewportGuards } from './platform/viewport';
import { PlaygamaService } from './platform/PlaygamaService';
import { StorageService } from './platform/StorageService';
import { AudioManager } from './audio/AudioManager';
import { Game } from './core/Game';

// 1. Install Viewport Guards immediately before anything paints
installViewportGuards();

async function bootstrap(): Promise<void> {
  const loadingScreen = document.getElementById('loading-screen');
  const progressBar = document.getElementById('loading-progress-bar');

  const updateProgress = (pct: number) => {
    if (progressBar) progressBar.style.width = `${pct}%`;
    PlaygamaService.setProgress(pct);
  };

  updateProgress(15);

  // 2. Initialize Platform SDK
  await PlaygamaService.init();
  updateProgress(40);

  // 3. Load Save Data
  await StorageService.load();
  updateProgress(65);

  // 4. Initialize Audio Engine
  AudioManager.init();
  updateProgress(80);

  // 5. Initialize Game & PixiJS Canvas
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found');
  }

  const game = new Game(canvas);
  await game.init(canvas);
  updateProgress(100);

  // 6. Fade Out Loading Splash & Send Game Ready
  setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        if (loadingScreen.parentNode) {
          loadingScreen.parentNode.removeChild(loadingScreen);
        }
      }, 500);
    }

    PlaygamaService.sendGameReady();
  }, 400);
}

// 15-second safety watchdog
const watchdog = window.setTimeout(() => {
  console.warn('[Bootstrap] Watchdog triggered game_ready fallback');
  PlaygamaService.sendGameReady();
}, 15_000);

window.addEventListener('DOMContentLoaded', () => {
  bootstrap()
    .catch((err) => {
      console.error('[Bootstrap] Fatal startup error:', err);
      PlaygamaService.sendGameReady();
    })
    .finally(() => {
      clearTimeout(watchdog);
    });
});
