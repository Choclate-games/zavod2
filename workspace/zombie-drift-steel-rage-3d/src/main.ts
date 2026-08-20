import './ui/styles.css';
import { Game } from './core/Game';

window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('game-container')!;
  const uiContainer = document.getElementById('ui-layer')!;

  const game = new Game(container, uiContainer);
  (window as any).game = game;
  await game.init();

  // Глобальные «браузерные» жесты поверх игрового холста гасим, чтобы игра
  // не скроллилась, не перезагружалась свайпом и не открывала контекстное меню.
  const guardTarget = document.getElementById('game-container')!;
  guardTarget.addEventListener('contextmenu', (e) => e.preventDefault());
  guardTarget.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  guardTarget.addEventListener('dragstart', (e) => e.preventDefault());
});
