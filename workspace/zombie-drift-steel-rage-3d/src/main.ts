import './ui/styles.css';
import { Game } from './core/Game';

window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('game-container')!;
  const uiContainer = document.getElementById('ui-layer')!;

  const game = new Game(container, uiContainer);
  await game.init();
});
