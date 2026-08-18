import { Game } from './core/Game.ts';
import { eventBus } from './core/EventBus.ts';

function installViewportGuards(): void {
  const publish = () => {
    document.documentElement.style.setProperty('--vp-w', `${Math.max(1, window.innerWidth)}px`);
    document.documentElement.style.setProperty('--vp-h', `${Math.max(1, window.innerHeight)}px`);
  };
  const settle = () => [0, 60, 180, 420, 900].forEach((ms) => setTimeout(publish, ms));
  publish();
  window.addEventListener('resize', () => { publish(); settle(); });
  window.addEventListener('orientationchange', settle);
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((t) => document.addEventListener(t, settle));

  const reset = () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); };
  window.addEventListener('scroll', reset, true);
  document.addEventListener('focusout', () => setTimeout(reset, 0));

  let allowed = false;
  document.addEventListener('touchstart', (e) => { allowed = e.touches.length === 1; }, { passive: true });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !allowed) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
  document.addEventListener('selectstart', (e) => { if (!isInteractive(e.target)) e.preventDefault(); }, true);
  document.addEventListener('dragstart', (e) => { if (!isInteractive(e.target)) e.preventDefault(); }, true);
  reset();
}

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest('input, textarea, select, option, [contenteditable=""], [contenteditable="true"]');
}

function installGlobalHandlers(): void {
  const seen = new Set<string>();
  window.addEventListener('error', (e) => {
    const key = e.message;
    if (!seen.has(key)) {
      seen.add(key);
      console.error('[Global]', e.error);
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    const key = String(e.reason);
    if (!seen.has(key)) {
      seen.add(key);
      console.error('[Global] unhandled rejection', e.reason);
    }
    e.preventDefault();
  });
}

async function boot(): Promise<void> {
  installViewportGuards();
  installGlobalHandlers();

  const game = new Game();
  eventBus.on('game:state-changed', (state: string) => {
    if (state === 'menu') game.platform.sendGameReady();
  });

  game.platform.setLoadingProgress(10);
  await game.boot();
  game.platform.setLoadingProgress(100);
  game.start();

  const watchdog = setTimeout(() => game.platform.sendGameReady(), 15000);
  const unsubscribe = eventBus.on('game:state-changed', (state: string) => {
    if (state === 'menu') {
      clearTimeout(watchdog);
      unsubscribe();
    }
  });
}

boot().catch((e) => {
  console.error('Boot failed:', e);
});
