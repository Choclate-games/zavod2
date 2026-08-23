import './ui/theme.css';
import { PlaygamaService } from './platform/PlaygamaService';
import { Game } from './core/Game';

async function bootstrap(): Promise<void> {
  const platform = PlaygamaService.get();

  platform.setLoadingProgress(10);

  // Initialize Platform Bridge
  await platform.initialize();
  platform.setLoadingProgress(50);

  // Initialize Game Engine & Scene
  const game = Game.get();
  platform.setLoadingProgress(85);

  // Start 60Hz Game Loop
  game.loop.start();
  platform.setLoadingProgress(100);

  // Signal platform that game is interactive
  platform.markReady();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap());
} else {
  bootstrap();
}