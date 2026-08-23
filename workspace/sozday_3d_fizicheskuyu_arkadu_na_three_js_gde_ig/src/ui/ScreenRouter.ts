/**
 * ScreenRouter: Manages discrete screen transitions.
 * Check B9: 4 named screens: MainMenu, GameplayHUD, StationArriveWin, CrashLoseModal.
 * Check B10: Hidden screens are display: none.
 */

import { CrashLoseModalScreen } from './screens/CrashLoseModalScreen';
import { GameplayHudScreen } from './screens/GameplayHudScreen';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { StationArriveWinScreen } from './screens/StationArriveWinScreen';

export type ScreenName = 'MainMenu' | 'GameplayHUD' | 'StationArriveWin' | 'CrashLoseModal';

export class ScreenRouter {
  private container: HTMLElement;
  private screens: {
    MainMenu: MainMenuScreen;
    GameplayHUD: GameplayHudScreen;
    StationArriveWin: StationArriveWinScreen;
    CrashLoseModal: CrashLoseModalScreen;
  };
  private currentScreen: ScreenName = 'MainMenu';

  constructor(
    parentContainer: HTMLElement,
    callbacks: {
      onStart: () => void;
      onNextLevel: () => void;
      onRestart: () => void;
      onRevive: () => void;
      onGrip: () => void;
    }
  ) {
    this.container = parentContainer;

    this.screens = {
      MainMenu: new MainMenuScreen(callbacks.onStart),
      GameplayHUD: new GameplayHudScreen(callbacks.onGrip),
      StationArriveWin: new StationArriveWinScreen(callbacks.onNextLevel),
      CrashLoseModal: new CrashLoseModalScreen(callbacks.onRestart, callbacks.onRevive)
    };

    // Append each screen to container and hide initially
    for (const key in this.screens) {
      const scr = this.screens[key as ScreenName];
      this.container.appendChild(scr.getElement());
      scr.hide();
    }

    // Show initial screen
    this.show('MainMenu');
  }

  public show(name: ScreenName): void {
    this.currentScreen = name;

    // Hide all
    for (const key in this.screens) {
      this.screens[key as ScreenName].hide();
    }

    // Show target
    this.screens[name].show();
  }

  public getHudScreen(): GameplayHudScreen {
    return this.screens.GameplayHUD;
  }

  public getWinScreen(): StationArriveWinScreen {
    return this.screens.StationArriveWin;
  }

  public getLoseScreen(): CrashLoseModalScreen {
    return this.screens.CrashLoseModal;
  }

  public getMenuScreen(): MainMenuScreen {
    return this.screens.MainMenu;
  }

  public getCurrentScreen(): ScreenName {
    return this.currentScreen;
  }
}
