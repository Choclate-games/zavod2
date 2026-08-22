import './ui/theme.css';
import { platform } from './platform/PlaygamaService';
import { router } from './ui/ScreenRouter';
import { MainMenuScreen } from './ui/screens/MainMenuScreen';
import { GameplayHUDScreen } from './ui/screens/GameplayHUD';
import { RoundEndModalScreen } from './ui/screens/RoundEndModal';
import { MatchResultScreen } from './ui/screens/MatchResultScreen';
import { ArsenalScreen } from './ui/screens/ArsenalScreen';
import { PauseModalScreen } from './ui/screens/PauseModal';
import { game } from './core/Game';
import { GameLoop } from './core/GameLoop';

async function bootstrap() {
  // 1. Initialize Platform
  await platform.bootstrap();
  platform.setProgress(40);

  // 2. Initialize Screens
  const mainMenu = new MainMenuScreen();
  const gameplayHud = new GameplayHUDScreen();
  const roundEndModal = new RoundEndModalScreen();
  const matchResult = new MatchResultScreen();
  const arsenal = new ArsenalScreen();
  const pauseModal = new PauseModalScreen();

  router.register('MainMenu', mainMenu);
  router.register('GameplayHUD', gameplayHud);
  router.register('RoundEndModal', roundEndModal);
  router.register('MatchResultScreen', matchResult);
  router.register('ArsenalScreen', arsenal);
  router.register('PauseModal', pauseModal);

  platform.setProgress(100);

  // 3. Mark platform ready
  platform.notifyPlatformReady();

  // 4. Show initial Menu
  router.navigateTo('MainMenu');

  // 5. Start Fixed 60Hz Gameloop
  const loop = new GameLoop(
    (dt: number) => {
      game.update(dt);
    },
    (_alpha: number) => {}
  );
  loop.start();
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
});
