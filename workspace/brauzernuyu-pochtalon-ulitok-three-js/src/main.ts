import './styles.css';
import { AudioService } from './audio/AudioService';
import { EventBus } from './core/EventBus';
import { Game } from './core/Game';
import { InputManager } from './input/InputManager';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { PlaygamaService } from './platform/PlaygamaService';
import { ColonySystem } from './systems/ColonySystem';
import { EnemySpawner } from './systems/EnemySpawner';
import type { GameEvents } from './game/GameEvents';

function installPageGuards(): void {
  const publishViewport = (): void => {
    document.documentElement.style.setProperty('--vp-w', `${Math.max(1, window.innerWidth)}px`);
    document.documentElement.style.setProperty('--vp-h', `${Math.max(1, window.innerHeight)}px`);
  };
  publishViewport();
  window.addEventListener('resize', publishViewport);
  window.addEventListener('orientationchange', publishViewport);
  document.addEventListener('contextmenu', (event) => event.preventDefault(), true);
  document.addEventListener('dragstart', (event) => event.preventDefault(), true);
  document.addEventListener('selectstart', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('button, input, textarea')) return;
    event.preventDefault();
  }, true);
  document.addEventListener('touchmove', (event) => {
    if (!event.defaultPrevented) event.preventDefault();
  }, { passive: false });
}

async function boot(): Promise<void> {
  installPageGuards();
  const eventBus = new EventBus<GameEvents>();
  const audio = new AudioService();
  const platform = new PlaygamaService();
  let game: Game | null = null;
  await platform.initialize((paused) => { if (paused) game?.pause(); else game?.resume(); }, (enabled) => audio.setMuted(!enabled));
  platform.setLoadingProgress(35);
  const save = await platform.load();
  platform.setLoadingProgress(55);
  const physics = new PhysicsWorld();
  await physics.initialize();
  platform.setLoadingProgress(75);
  const input = new InputManager();
  const colony = new ColonySystem(physics, eventBus);
  const enemies = new EnemySpawner(eventBus);
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Game canvas is missing');
  game = new Game(canvas, eventBus, input, physics, colony, enemies, platform, audio, save);
  platform.setLoadingProgress(100);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  platform.sendGameReady();
  game.start();
  (window as Window & { __game?: Game }).__game = game;
}

void boot().catch((error: unknown) => {
  console.error('Game boot failed', error);
  const toast = document.getElementById('event-toast');
  if (toast) { toast.textContent = 'Не удалось загрузить сад'; toast.classList.add('visible'); }
});
