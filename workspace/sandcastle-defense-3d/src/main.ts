import { BridgeService } from './platform/BridgeService.ts';
import { SaveService } from './platform/SaveService.ts';
import { Localization } from './platform/Localization.ts';
import { Game } from './core/Game.ts';

// 1. Install Viewport Guards
function installViewportGuards(): void {
  document.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });
  document.addEventListener('selectstart', (e) => e.preventDefault(), { capture: true });
  document.addEventListener('dragstart', (e) => e.preventDefault(), { capture: true });

  // Guard touchmove to prevent mobile browser pull-to-refresh
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault(); // prevent pinch zoom on page
    }
  }, { passive: false });

  // Save on pagehide or hidden visibility
  const flushSave = () => {
    try {
      SaveService.saveImmediate();
    } catch {}
  };
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushSave();
  });
}

// 2. Main Bootstrap
async function bootstrap(): Promise<void> {
  installViewportGuards();

  let gameInstance: Game | null = null;

  try {
    // Step 1: Bootstrap Bridge
    await BridgeService.bootstrap();
    BridgeService.setProgress(20);

    // Step 2: Language & Auth
    const lang = BridgeService.getPlatformLanguage();
    Localization.setLanguage(lang);
    await BridgeService.autoAuthorizeSilent();
    BridgeService.setProgress(45);

    // Step 3: Load Cloud / Local Progression
    const save = await SaveService.load();
    if (save.settings.language) {
      Localization.setLanguage(save.settings.language);
    }
    BridgeService.setProgress(70);

    // Step 4: Initialize 3D Engine & Game
    gameInstance = new Game();
    BridgeService.setProgress(90);

    // Step 5: Finalize loading
    gameInstance.init();
    BridgeService.setProgress(100);

    // Smooth UI Splash Dismissal
    setTimeout(() => {
      gameInstance?.uiManager.hideLoadingScreen();
      BridgeService.sendGameReady();
      BridgeService.showBanner();
    }, 600);
  } catch (err) {
    console.error('[Main] Boot error:', err);
    if (gameInstance) {
      gameInstance.uiManager.hideLoadingScreen();
    }
    BridgeService.sendGameReady();
  }
}

// 3. Launch with Watchdog
window.addEventListener('DOMContentLoaded', () => {
  const watchdog = setTimeout(() => {
    BridgeService.sendGameReady();
  }, 12_000);

  bootstrap().finally(() => {
    clearTimeout(watchdog);
  });
});
