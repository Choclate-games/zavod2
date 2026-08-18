import { bridgeManager } from './platform/BridgeManager';
import { audioManager } from './audio/AudioManager';
import { game, GameState } from './core/Game';
import { uiManager } from './ui/UIManager';

async function bootstrap(): Promise<void> {
  // 1. Viewport guards and CSS variables lock
  document.documentElement.style.setProperty('--vp-h', `${window.innerHeight}px`);
  window.addEventListener('resize', () => {
    document.documentElement.style.setProperty('--vp-h', `${window.innerHeight}px`);
  });

  // Prevent default drag and context menu globally
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('dragstart', (e) => e.preventDefault());

  // 2. Initialize Playgama Platform Bridge
  bridgeManager.setProgress(20);
  await bridgeManager.init();
  bridgeManager.setProgress(50);

  // Setup platform lifecycle listeners
  bridgeManager.setEventListeners({
    onPauseStateChanged: (isPaused) => {
      if (isPaused) {
        if (game.state === GameState.IN_GAME) {
          game.setState(GameState.PAUSE);
        }
        audioManager.setPlatformMuted(true);
      } else {
        audioManager.setPlatformMuted(false);
      }
    },
    onAudioStateChanged: (isMuted) => {
      audioManager.setPlatformMuted(isMuted);
    }
  });

  // 3. Initialize Game Canvas & PixiJS WebGL engine
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  bridgeManager.setProgress(75);
  await game.init(canvas);

  // 4. Update UI labels with loaded language
  uiManager.updateStaticTranslations();
  bridgeManager.setProgress(100);

  // 5. Send Game Ready to platform
  // Ensure DOM is interactive before dismissing splash
  requestAnimationFrame(() => {
    bridgeManager.sendGameReady();
  });
}

// Start game on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch((err) => console.error('[Bootstrap] Fatal error:', err));
  });
} else {
  bootstrap().catch((err) => console.error('[Bootstrap] Fatal error:', err));
}
