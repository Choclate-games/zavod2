import { StartScreen } from './screens/StartScreen';
import { GameScreen } from './screens/GameScreen';
import { HangarModal } from './screens/HangarModal';
import { DraftModal } from './screens/DraftModal';
import { GameOverModal } from './screens/GameOverModal';
import { LeaderboardModal } from './screens/LeaderboardModal';
import { SettingsModal } from './screens/SettingsModal';
import { TouchControls } from './TouchControls';
import { eventBus } from '../core/EventBus';

export class UIManager {
  private static instance: UIManager;
  private uiRoot: HTMLElement;

  public startScreen: StartScreen;
  public gameScreen: GameScreen;
  public hangarModal: HangarModal;
  public draftModal: DraftModal;
  public gameOverModal: GameOverModal;
  public leaderboardModal: LeaderboardModal;
  public settingsModal: SettingsModal;
  public touchControls: TouchControls;

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  constructor() {
    this.uiRoot = document.getElementById('ui-root')!;

    this.startScreen = new StartScreen(this.uiRoot);
    this.gameScreen = new GameScreen(this.uiRoot);
    this.hangarModal = new HangarModal(this.uiRoot);
    this.draftModal = new DraftModal(this.uiRoot);
    this.gameOverModal = new GameOverModal(this.uiRoot);
    this.leaderboardModal = new LeaderboardModal(this.uiRoot);
    this.settingsModal = new SettingsModal(this.uiRoot);
    this.touchControls = new TouchControls();

    this.setupListeners();
  }

  private setupListeners(): void {
    eventBus.on('ui:open_hangar', () => this.hangarModal.open());
    eventBus.on('ui:open_leaderboard', () => this.leaderboardModal.open());
    eventBus.on('ui:open_settings', () => this.settingsModal.open());
    eventBus.on('ui:language_changed', () => this.startScreen.render());
  }

  public showMenu(): void {
    this.touchControls.setVisible(false);
    this.gameScreen.hide();
    this.draftModal.close();
    this.gameOverModal.close();
    this.startScreen.show();
  }

  public showGameplay(): void {
    this.startScreen.hide();
    this.hangarModal.close();
    this.leaderboardModal.close();
    this.settingsModal.close();
    this.gameOverModal.close();
    this.draftModal.close();

    this.gameScreen.show();
    this.gameScreen.setPauseModal(false);
    this.touchControls.setVisible(true);
  }

  public showDraft(): void {
    this.touchControls.setVisible(false);
    this.draftModal.open();
  }

  public hideDraft(): void {
    this.draftModal.close();
    this.touchControls.setVisible(true);
  }

  public showPause(isPaused: boolean): void {
    this.gameScreen.setPauseModal(isPaused);
    this.touchControls.setVisible(!isPaused);
  }

  public showGameOver(): void {
    this.touchControls.setVisible(false);
    this.gameOverModal.open();
  }

  public updateHud(): void {
    this.gameScreen.update();
  }
}

export const uiManager = UIManager.getInstance();
