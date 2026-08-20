import './style.css';
import { InputManager } from './core/InputManager';
import { UIManager } from './ui/UIManager';
import { AudioManager } from './audio/AudioManager';
import { playgama } from './platform/PlaygamaService';
import { StorageService } from './platform/StorageService';
import { Game } from './core/Game';
import { i18n } from './i18n/I18n';
import { TITLE } from './config/GameConfig';

/** Page-lock & viewport guards installed before anything paints (Yandex 1.10.x). */
function installViewportGuards(): void {
  const root = document.documentElement;
  const publish = () => {
    root.style.setProperty('--vp-w', `${Math.max(1, window.innerWidth)}px`);
    root.style.setProperty('--vp-h', `${Math.max(1, window.innerHeight)}px`);
  };
  const settle = () => [0, 60, 180, 420, 900].forEach((ms) => window.setTimeout(publish, ms));
  publish();
  window.addEventListener('resize', () => {
    publish();
    settle();
  });
  window.addEventListener('orientationchange', settle);

  const interactive = (n: EventTarget | null): boolean =>
    n instanceof Element && !!n.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  let allowed = false;
  document.addEventListener(
    'touchstart',
    (e) => {
      allowed = e.touches.length === 1 && interactive(e.target);
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1 || !allowed) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
  document.addEventListener('selectstart', (e) => {
    if (!interactive(e.target)) e.preventDefault();
  }, true);
}

function detectTouchMode(): boolean {
  const forced = new URLSearchParams(location.search).get('touch');
  if (forced === '1') return true;
  if (forced === '0') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    matchMedia('(pointer: coarse)').matches ||
    window.innerWidth < 900
  );
}

function resolveLanguage(platformLang: string | null): string {
  const saved = StorageService.data_.settings.language;
  if (saved === 'en' || saved === 'ru') return saved;
  const raw = platformLang || navigator.language || 'en';
  return raw.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

async function boot(): Promise<void> {
  installViewportGuards();

  const input = new InputManager();
  input.attach();
  const audio = new AudioManager();
  audio.init();

  const uiRoot = document.getElementById('ui-root') as HTMLElement;
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  // Progress milestones drive the platform splash + our loader bar.
  let progress = 0;
  const setProgress = (p: number) => {
    progress = Math.max(progress, Math.min(100, p));
    playgama.setProgress(progress);
  };
  const watchdog = window.setTimeout(() => playgama.sendGameReady(), 15_000);

  setProgress(5);
  await playgama.init();
  setProgress(20);

  await StorageService.load();
  setProgress(40);

  i18n.setTouchMode(detectTouchMode());
  i18n.setLanguage(resolveLanguage(playgama.getLanguage()));
  setProgress(55);

  const ui = new UIManager(uiRoot, input);
  setProgress(70);

  const game = new Game(canvas, ui, input, audio);
  game.setTouchMode(detectTouchMode());
  await game.init();
  setProgress(95);

  // First real user gesture resumes the (suspended) AudioContext.
  const resumeAudio = (): void => audio.resume();
  window.addEventListener('pointerdown', resumeAudio);
  window.addEventListener('keydown', resumeAudio);

  setProgress(100);
  playgama.sendGameReady();
  window.clearTimeout(watchdog);

  // Flush the save on tab hide / unload (never beforeunload).
  const flush = (): void => StorageService.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });
}

void TITLE; // referenced for byte-identical title guarantees across the app
boot().catch((err) => {
  console.error('Boot failed:', err);
  playgama.sendGameReady();
});
