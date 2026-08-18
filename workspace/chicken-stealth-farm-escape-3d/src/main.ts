// src/main.ts
import { game } from '@/core/Game';
import { playgamaService } from '@/platform/PlaygamaService';

function installViewportGuards(): void {
  // Prevent context menu
  document.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });

  // Prevent drag starts
  document.addEventListener('dragstart', (e) => e.preventDefault(), { capture: true });

  // Prevent selection gestures
  document.addEventListener('selectstart', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target || !target.closest('input, textarea')) {
      e.preventDefault();
    }
  }, { capture: true });

  // Prevent passive touchmove bounce / pull to refresh
  document.addEventListener('touchmove', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target || !target.closest('.scrollable, input, textarea')) {
      e.preventDefault();
    }
  }, { passive: false });
}

async function bootstrap(): Promise<void> {
  installViewportGuards();

  playgamaService.setLoadingProgress(15);

  // Initialize Game, Rapier3D, ThreeJS, and Playgama Bridge
  await game.initialize();
  playgamaService.setLoadingProgress(60);

  // Ensure fonts ready and scene rendered
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {}
  }
  playgamaService.setLoadingProgress(90);

  // Allow 2 animation frames to settle initial paint
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  playgamaService.setLoadingProgress(100);

  // Smooth small pause for platform splash fade
  await new Promise((r) => setTimeout(r, 200));

  // Send game_ready exactly once
  playgamaService.sendGameReady();
  console.log('[Main] Chicken Stealth Farm Escape 3D initialized successfully! 🐔🌾');
}

window.addEventListener('DOMContentLoaded', () => {
  let isDone = false;

  // 15s watchdog safeguard
  const watchdog = setTimeout(() => {
    if (!isDone) {
      playgamaService.sendGameReady();
    }
  }, 15_000);

  bootstrap()
    .catch((err) => {
      console.error('[Main] Boot error:', err);
      playgamaService.sendGameReady();
    })
    .finally(() => {
      isDone = true;
      clearTimeout(watchdog);
    });
});
