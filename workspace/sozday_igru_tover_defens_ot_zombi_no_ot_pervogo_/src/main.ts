import './ui/theme.css';
import { PlaygamaService } from './platform/PlaygamaService';
import { StorageService } from './platform/StorageService';
import { Game } from './core/Game';

let bootDone = false;

async function bootstrap(): Promise<void> {
  // 1. Инициализация платформы Playgama Bridge
  await PlaygamaService.initialize();
  PlaygamaService.setProgress(25);

  // 2. Загрузка сохранений и прогресса
  await StorageService.load();
  StorageService.initLifecycle();
  PlaygamaService.setProgress(60);

  // 3. Инициализация Canvas и Three.js сцены
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui-root') as HTMLElement;

  if (!canvas || !uiRoot) {
    throw new Error('Canvas or UI Root element not found in DOM');
  }

  const game = new Game(canvas, uiRoot);
  await game.init();

  // 4. Завершение загрузки и сигнал готовности
  PlaygamaService.setProgress(100);
  bootDone = true;

  // Ожидание отрисовки первого интерактивного кадра меню
  requestAnimationFrame(() => {
    PlaygamaService.sendGameReady();
  });
}

// Сторожевой таймер 15 с на случай сбоев сети
const watchdog = setTimeout(() => {
  if (!bootDone) {
    PlaygamaService.sendGameReady();
  }
}, 15000);

bootstrap()
  .catch((err) => {
    console.error('Ошибка bootstrap игры:', err);
    PlaygamaService.sendGameReady();
  })
  .finally(() => {
    clearTimeout(watchdog);
  });
