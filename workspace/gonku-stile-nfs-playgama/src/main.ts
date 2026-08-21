import { PlaygamaService } from './platform/PlaygamaService';
import { Game } from './core/Game';
import { UIManager } from './ui/UIManager';

async function bootstrap(): Promise<void> {
  // 1. Install Viewport Guards (Strict moderation requirement)
  document.body.style.overscrollBehavior = 'none';
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    // Only prevent touchmove if not inside a scrollable modal
    const target = e.target as HTMLElement;
    if (!target.closest('.modal-card')) {
      e.preventDefault();
    }
  }, { passive: false });

  // 2. Initialize Platform Bridge
  UIManager.get().showLoadingProgress(10, 'Подключение к платформе...');
  await PlaygamaService.get().initialize();

  // 3. Canvas Container & Game Initialization
  const container = document.getElementById('canvas-container');
  if (!container) {
    throw new Error('Canvas container #canvas-container not found');
  }

  // 4. Initialize Game & 3D WebGL Scene
  await Game.get().initialize(container);
}

// Start on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap());
} else {
  bootstrap();
}
