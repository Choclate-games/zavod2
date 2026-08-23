import { MainMenuScreen } from './screens/MainMenuScreen';
import { PauseScreen } from './screens/PauseScreen';
import { VictoryDefeatScreen } from './screens/VictoryDefeatScreen';
import { eventBus } from '../core/EventBus';

export type ScreenId = 'MAIN_MENU' | 'HUD' | 'PAUSE' | 'VICTORY_DEFEAT';

export class ScreenRouter {
  public currentScreen: ScreenId = 'MAIN_MENU';
  public mainMenu: MainMenuScreen;
  public pauseScreen: PauseScreen;
  public victoryDefeatScreen: VictoryDefeatScreen;

  constructor(
    container: HTMLElement,
    callbacks: {
      onStartGame: () => void;
      onResumeGame: () => void;
      onQuitToMenu: () => void;
      onNextMatch: () => void;
    }
  ) {
    this.mainMenu = new MainMenuScreen(callbacks.onStartGame);
    this.pauseScreen = new PauseScreen(callbacks.onResumeGame, callbacks.onQuitToMenu);
    this.victoryDefeatScreen = new VictoryDefeatScreen(callbacks.onNextMatch);

    container.appendChild(this.mainMenu.element);
    container.appendChild(this.pauseScreen.element);
    container.appendChild(this.victoryDefeatScreen.element);

    eventBus.on('SCREEN_NAVIGATE', (screenId: ScreenId) => {
      this.navigate(screenId);
    });
  }

  public navigate(screen: ScreenId): void {
    this.currentScreen = screen;

    this.mainMenu.hide();
    this.pauseScreen.hide();
    this.victoryDefeatScreen.hide();

    switch (screen) {
      case 'MAIN_MENU':
        this.mainMenu.show();
        break;
      case 'PAUSE':
        this.pauseScreen.show();
        break;
      case 'VICTORY_DEFEAT':
        this.victoryDefeatScreen.show();
        break;
      case 'HUD':
        // HUD is handled by Hud component
        break;
    }
  }
}