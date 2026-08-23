import { MainMenuScreen } from './screens/MainMenuScreen';
import { EngineerBunkerArmoryScreen } from './screens/EngineerBunkerArmoryScreen';
import { GameplayShiftViewScreen } from './screens/GameplayShiftViewScreen';
import { PauseSettingsModalScreen } from './screens/PauseSettingsModalScreen';
import { ShiftDebriefVictoryScreen } from './screens/ShiftDebriefVictoryScreen';
import { ReactorBreachedDefeatScreen } from './screens/ReactorBreachedDefeatScreen';
import { EventBus } from '../core/EventBus';

export type ScreenType =
  | 'MainMenu'
  | 'EngineerBunkerArmory'
  | 'GameplayShiftView'
  | 'PauseSettingsModal'
  | 'ShiftDebriefVictory'
  | 'ReactorBreachedDefeat';

export class ScreenRouter {
  public container: HTMLDivElement;
  public screens: Map<ScreenType, HTMLElement> = new Map();
  public currentScreen: ScreenType = 'MainMenu';

  public mainMenu: MainMenuScreen;
  public armory: EngineerBunkerArmoryScreen;
  public gameplay: GameplayShiftViewScreen;
  public pauseModal: PauseSettingsModalScreen;
  public victory: ShiftDebriefVictoryScreen;
  public defeat: ReactorBreachedDefeatScreen;

  constructor(
    onStartShift: () => void,
    onOpenArmory: () => void,
    onOpenSettings: () => void,
    onBackToMenu: () => void,
    onResumeGame: () => void,
    onReviveGame: () => void,
    onContextAction: () => void,
    onThrowFlare: () => void,
    onToggleSprint: () => void
  ) {
    this.container = document.createElement('div');
    this.container.id = 'screens';
    this.container.className = 'ui-layer';

    this.mainMenu = new MainMenuScreen(onStartShift, onOpenArmory, onOpenSettings);
    this.armory = new EngineerBunkerArmoryScreen(onBackToMenu);
    this.gameplay = new GameplayShiftViewScreen(onOpenSettings, onContextAction, onThrowFlare, onToggleSprint);
    this.pauseModal = new PauseSettingsModalScreen(onResumeGame, onBackToMenu);
    this.victory = new ShiftDebriefVictoryScreen(onBackToMenu);
    this.defeat = new ReactorBreachedDefeatScreen(onReviveGame, onBackToMenu);

    this.registerScreen('MainMenu', this.mainMenu.element);
    this.registerScreen('EngineerBunkerArmory', this.armory.element);
    this.registerScreen('GameplayShiftView', this.gameplay.element);
    this.registerScreen('PauseSettingsModal', this.pauseModal.element);
    this.registerScreen('ShiftDebriefVictory', this.victory.element);
    this.registerScreen('ReactorBreachedDefeat', this.defeat.element);

    this.showScreen('MainMenu');
  }

  private registerScreen(name: ScreenType, el: HTMLElement): void {
    this.screens.set(name, el);
    this.container.appendChild(el);
  }

  public showScreen(name: ScreenType): void {
    this.currentScreen = name;
    this.screens.forEach((el, screenName) => {
      if (screenName === name) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    if (name === 'MainMenu') {
      this.mainMenu.updateData();
      EventBus.emit('GAME_STATE_CHANGED', 'MENU');
    } else if (name === 'EngineerBunkerArmory') {
      this.armory.renderCards();
      EventBus.emit('GAME_STATE_CHANGED', 'ARMORY');
    } else if (name === 'GameplayShiftView') {
      EventBus.emit('GAME_STATE_CHANGED', 'PLAYING');
    } else if (name === 'PauseSettingsModal') {
      EventBus.emit('GAME_STATE_CHANGED', 'PAUSED');
    } else if (name === 'ShiftDebriefVictory') {
      EventBus.emit('GAME_STATE_CHANGED', 'VICTORY');
    } else if (name === 'ReactorBreachedDefeat') {
      EventBus.emit('GAME_STATE_CHANGED', 'DEFEAT');
    }
  }
}
