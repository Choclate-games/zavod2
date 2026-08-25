import './styles.css';
import { Game } from './core/Game';
import { bridgeService } from './platform/BridgeService';

declare global {
  interface Window { __game?: Game }
}

function installPageGuards(): void {
  document.documentElement.style.overscrollBehavior = 'none';
  document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('contextmenu', (event) => event.preventDefault(), true);
  document.addEventListener('dragstart', (event) => event.preventDefault(), true);
}

async function boot(): Promise<void> {
  installPageGuards();
  const root = document.getElementById('game-root');
  if (!root) throw new Error('Game root is missing');

  // Один сервис на всю игру: второй экземпляр — это второй флаг «ready
  // отправлен» и дублирующийся сигнал площадке.
  const save = await bridgeService.initialize();
  const game = new Game(root, save);
  bridgeService.setProgressTarget(60);
  await game.initialize();
  bridgeService.setProgressTarget(90);
  game.start();
  window.__game = game;

  // Меню нарисовано и по нему можно кликать — только теперь готовность.
  await bridgeService.signalReady();
}

// Сторож дёргает тот же синглтон: собственный экземпляр отправил бы game_ready
// второй раз в обход флага.
const watchdog = window.setTimeout(() => { void bridgeService.signalReady(); }, 20_000);

void boot()
  .catch((error: unknown) => {
    console.error('Game boot failed', error);
    // Сплэш площадки нельзя оставлять висеть даже на упавшей загрузке.
    return bridgeService.signalReady();
  })
  .finally(() => window.clearTimeout(watchdog));
