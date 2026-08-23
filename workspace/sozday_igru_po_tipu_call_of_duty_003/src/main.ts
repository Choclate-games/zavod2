import { BridgeService } from './platform/BridgeService';
import { SaveService } from './platform/SaveService';
import { I18nService } from './ui/i18n';
import { GameEngine } from './core/GameEngine';

function installViewportGuards(): void {
  // Prevent context menus and drag selection
  window.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });
  window.addEventListener('selectstart', (e) => e.preventDefault(), { capture: true });
  window.addEventListener('dragstart', (e) => e.preventDefault(), { capture: true });

  // Update viewport height CSS variable
  const updateVp = () => {
    const vh = window.innerHeight;
    document.documentElement.style.setProperty('--vp-h', `${vh}px`);
  };
  window.addEventListener('resize', updateVp);
  window.addEventListener('orientationchange', updateVp);
  updateVp();
}

async function bootstrap(): Promise<void> {
  installViewportGuards();

  // 1. Initialize platform SDK with progress
  BridgeService.setProgress(10);
  await BridgeService.init(10000);

  // 2. Setup language
  const lang = BridgeService.getPlatformLanguage();
  I18nService.setLanguage(lang);
  BridgeService.setProgress(30);

  // 3. Silent authorization on platforms like VK/OK
  await BridgeService.autoAuthorize();
  BridgeService.setProgress(50);

  // 4. Load player data
  await SaveService.load();
  BridgeService.setProgress(70);

  // 5. Setup 3D Scene and UI Root
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui-root') as HTMLElement;

  const engine = new GameEngine(canvas, uiRoot);
  await engine.init();
  BridgeService.setProgress(90);

  // 6. Complete loading and notify platform
  BridgeService.setProgress(100);
  BridgeService.sendReady();
  BridgeService.showBanner();

  // 7. Start game loop
  engine.start();
}

window.addEventListener('DOMContentLoaded', () => {
  let isBooted = false;

  // Watchdog timeout to ensure game_ready is never permanently blocked
  const watchdog = setTimeout(() => {
    if (!isBooted) {
      BridgeService.sendReady();
    }
  }, 15000);

  bootstrap()
    .then(() => {
      isBooted = true;
    })
    .catch((err) => {
      console.error('[Main] Boot error:', err);
      BridgeService.sendReady();
    })
    .finally(() => {
      clearTimeout(watchdog);
    });
});
