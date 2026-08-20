// src/main.ts
// Game bootstrap, strict Playgama Bridge lifecycle, loading driver and initial launch

import { playgamaService } from './platform/PlaygamaService';
import { storageService } from './platform/StorageService';
import { game } from './core/Game';
import { telemetry } from './telemetry/Telemetry';

/**
 * 1. Global Viewport Guards before anything paints
 */
function installViewportGuards(): void {
  document.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });
  document.addEventListener('selectstart', (e) => e.preventDefault(), { capture: true });
  document.addEventListener('dragstart', (e) => e.preventDefault(), { capture: true });

  // Guard multi-touch on touchmove (allow multi-touch pointers on game canvas)
  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches.length > 1) {
        // Prevent browser gestures like pinch-to-zoom on page
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

/**
 * Smooth Loading Progress Driver
 */
const progressDriver = (() => {
  let current = 0;
  let target = 0;
  let rafId = 0;
  let lastTs = 0;
  const SPEED = 60; // % per second

  const fillEl = document.getElementById('loader-fill');
  const statusEl = document.getElementById('loader-status');

  const tick = (ts: number) => {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;

    if (current < target) {
      current = Math.min(target, current + SPEED * dt);
      const v = Math.round(current);
      if (fillEl) fillEl.style.width = `${v}%`;
      playgamaService.setLoadingProgress(v);
    }

    if (current < 100 || current < target) {
      rafId = requestAnimationFrame(tick);
    }
  };

  return {
    setTarget(v: number, statusText?: string) {
      target = Math.max(target, Math.min(100, v));
      if (statusText && statusEl) statusEl.innerText = statusText;
      if (!rafId) rafId = requestAnimationFrame(tick);
    },
    async waitFor(targetVal: number, timeoutMs = 3000): Promise<void> {
      const deadline = performance.now() + timeoutMs;
      while (Math.round(current) < targetVal && performance.now() < deadline) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      if (fillEl) fillEl.style.width = `${targetVal}%`;
      playgamaService.setLoadingProgress(targetVal);
    },
  };
})();

/**
 * Main Boot Sequence
 */
async function bootstrap(): Promise<void> {
  installViewportGuards();
  telemetry.track('session_start', { ua: navigator.userAgent });

  progressDriver.setTarget(15, 'ПОДКЛЮЧЕНИЕ К ПЛАТФОРМЕ...');
  await playgamaService.init();

  progressDriver.setTarget(45, 'ЗАГРУЗКА БАЗОВЫХ ДАННЫХ...');
  await storageService.load();

  progressDriver.setTarget(75, 'ИНИЦИАЛИЗАЦИЯ 3D СЦЕНЫ И ФИЗИКИ...');
  const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
  await game.init(canvas);

  progressDriver.setTarget(100, 'ГОТОВО К БОЮ!');
  await progressDriver.waitFor(100, 1500);

  // Small delay for smooth splash fade
  await new Promise((resolve) => setTimeout(resolve, 600));

  // Send single-shot game_ready
  playgamaService.sendGameReady();

  // Hide preloader overlay
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.style.opacity = '0';
    preloader.style.pointerEvents = 'none';
    setTimeout(() => {
      preloader.style.display = 'none';
    }, 600);
  }
}

// 15-second watchdog ensuring game_ready is always dispatched even on errors
window.addEventListener('DOMContentLoaded', () => {
  const watchdog = setTimeout(() => {
    playgamaService.sendGameReady();
  }, 15_000);

  bootstrap()
    .catch((err) => {
      console.error('[Bootstrap] Failed to initialize cleanly:', err);
      playgamaService.sendGameReady();
    })
    .finally(() => {
      clearTimeout(watchdog);
    });
});
