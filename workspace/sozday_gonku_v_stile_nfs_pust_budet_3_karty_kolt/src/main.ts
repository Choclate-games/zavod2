import './ui/theme.css';
import { playgama } from './platform/PlaygamaService';
import { Game } from './core/Game';

function publishMetrics(): void {
  document.documentElement.style.setProperty('--vp-w', `${Math.max(1, window.innerWidth)}px`);
  document.documentElement.style.setProperty('--vp-h', `${Math.max(1, window.innerHeight)}px`);
}

function installViewportGuards(): void {
  publishMetrics();
  window.addEventListener('resize', publishMetrics);
  window.addEventListener('orientationchange', () => {
    setTimeout(publishMetrics, 100);
    setTimeout(publishMetrics, 500);
  });
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((t) => {
    document.addEventListener(t, () => setTimeout(publishMetrics, 100));
  });

  const resetScroll = () => {
    if (window.scrollX || window.scrollY) {
      window.scrollTo(0, 0);
    }
  };
  window.addEventListener('scroll', resetScroll, true);

  document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
  document.addEventListener('selectstart', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('input, textarea')) {
      e.preventDefault();
    }
  }, true);
  document.addEventListener('dragstart', (e) => e.preventDefault(), true);
}

async function bootstrap(): Promise<void> {
  installViewportGuards();
  playgama.setLoadingProgress(15);

  await playgama.initialize();
  playgama.setLoadingProgress(50);

  const game = new Game();
  await game.initialize();
  playgama.setLoadingProgress(90);

  // Allow layout and font rendering
  await new Promise((resolve) => setTimeout(resolve, 200));
  playgama.setLoadingProgress(100);

  playgama.sendPlatformGameReady();
}

window.addEventListener('DOMContentLoaded', () => {
  const watchdog = setTimeout(() => {
    playgama.sendPlatformGameReady();
  }, 15_000);

  bootstrap()
    .catch((err) => {
      console.error('[Bootstrap] Error during game boot:', err);
      playgama.sendPlatformGameReady();
    })
    .finally(() => {
      clearTimeout(watchdog);
    });
});
