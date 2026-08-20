import { Game } from './core/Game';
import { PlaygamaService } from './platform/PlaygamaService';
import { UIManager } from './ui/UIManager';
import { StorageService } from './platform/StorageService';
import { AudioManager } from './audio/AudioManager';

function installViewportGuards(): void {
  // Prevent mobile gesture bounce, zoom & contextual menus
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('gestureend', (e) => e.preventDefault());

  // Prevent scroll propagation
  document.body.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });
}

async function bootstrap(): Promise<void> {
  console.log('[Main] Bootstrapping game...');
  installViewportGuards();

  const playgama = PlaygamaService.getInstance();
  await playgama.initialize();

  const container = document.getElementById('game-container') || document.body;
  const game = Game.getInstance();
  game.init(container);

  // Main menu button interactions
  document.getElementById('btn-start-run')?.addEventListener('click', () => {
    game.startNewRun();
  });

  document.getElementById('btn-open-workshop')?.addEventListener('click', () => {
    UIManager.getInstance().showWorkshop(() => {
      const save = StorageService.getInstance().getSave();
      UIManager.getInstance().showMainMenu(save.highScore, save.scrapCurrency);
    });
  });

  // Global unlock audio on first interaction
  const unlockAudio = () => {
    AudioManager.getInstance().unlockAudio();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Send game_ready signal to platform
  setTimeout(() => {
    playgama.sendGameReady();
  }, 100);

  console.log('[Main] Game ready and running!');
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => {
    console.error('[Main] Fatal bootstrap error:', err);
  });
});
