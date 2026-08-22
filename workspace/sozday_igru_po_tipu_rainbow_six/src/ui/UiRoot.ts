import { HUD } from "./HUD";
import { MainMenuScreen } from "./screens/MainMenuScreen";
import { ArmoryScreen } from "./screens/ArmoryScreen";
import { BreachPlanningScreen } from "./screens/BreachPlanningScreen";
import { DefusalModal } from "./screens/DefusalModal";
import { AfterActionReportScreen } from "./screens/AfterActionReportScreen";
import { GameOverModal } from "./screens/GameOverModal";
import { PauseModal } from "./screens/PauseModal";
import type {
  PlayerProgressSave,
  RoomConfig,
  AssaultStats,
  BreachPointData,
  ExplosiveId,
  WireColor,
} from "../core/Types";

export class UiRoot {
  public hud: HUD;
  public mainMenu: MainMenuScreen;
  public armory: ArmoryScreen;
  public planning: BreachPlanningScreen;
  public defusalModal: DefusalModal;
  public afterAction: AfterActionReportScreen;
  public gameOverModal: GameOverModal;
  public pauseModal: PauseModal;

  constructor(callbacks: {
    onStartAssault: () => void;
    onOpenArmory: () => void;
    onToggleSound: () => void;
    onArmoryBack: () => void;
    onSaveUpdated: (save: Partial<PlayerProgressSave>) => void;
    onConfirmAssault: (selectedPoint: BreachPointData, explosiveId: ExplosiveId) => void;
    onPlanningBack: () => void;
    onCutWire: (color: WireColor) => void;
    onNextRoom: () => void;
    onDoubleReward: () => void;
    onAarMainMenu: () => void;
    onRevive: () => void;
    onRetry: () => void;
    onGameOverMainMenu: () => void;
    onResume: () => void;
    onRestart: () => void;
    onPauseMainMenu: () => void;
  }) {
    this.hud = new HUD();

    this.mainMenu = new MainMenuScreen(
      callbacks.onStartAssault,
      callbacks.onOpenArmory,
      callbacks.onToggleSound
    );

    this.armory = new ArmoryScreen(
      callbacks.onArmoryBack,
      callbacks.onSaveUpdated
    );

    this.planning = new BreachPlanningScreen(
      callbacks.onConfirmAssault,
      callbacks.onPlanningBack
    );

    this.defusalModal = new DefusalModal(callbacks.onCutWire);

    this.afterAction = new AfterActionReportScreen(
      callbacks.onNextRoom,
      callbacks.onDoubleReward,
      callbacks.onAarMainMenu
    );

    this.gameOverModal = new GameOverModal(
      callbacks.onRevive,
      callbacks.onRetry,
      callbacks.onGameOverMainMenu
    );

    this.pauseModal = new PauseModal(
      callbacks.onResume,
      callbacks.onRestart,
      callbacks.onToggleSound,
      callbacks.onPauseMainMenu
    );

    const rootEl = document.getElementById("ui-root");
    if (rootEl) {
      rootEl.appendChild(this.mainMenu.element);
      rootEl.appendChild(this.armory.element);
      rootEl.appendChild(this.planning.element);
      rootEl.appendChild(this.defusalModal.element);
      rootEl.appendChild(this.afterAction.element);
      rootEl.appendChild(this.gameOverModal.element);
      rootEl.appendChild(this.pauseModal.element);
    }
  }

  showMainMenu(save: PlayerProgressSave): void {
    this.hideAll();
    this.mainMenu.updateSave(save);
    this.mainMenu.show();
  }

  showArmory(save: PlayerProgressSave): void {
    this.hideAll();
    this.armory.updateSave(save);
    this.armory.show();
  }

  showPlanning(room: RoomConfig): void {
    this.hideAll();
    this.planning.setup(room);
    this.planning.show();
  }

  showGameplayHud(): void {
    this.hideAll();
    this.hud.show();
  }

  showAfterAction(stats: AssaultStats, isFinalRoom: boolean): void {
    this.hideAll();
    this.afterAction.setup(stats, isFinalRoom);
    this.afterAction.show();
  }

  showGameOver(reason: string, canRevive: boolean): void {
    this.hud.hide();
    this.gameOverModal.setup(reason, canRevive);
    this.gameOverModal.show();
  }

  showPause(): void {
    this.pauseModal.show();
  }

  hidePause(): void {
    this.pauseModal.hide();
  }

  showDefusalModal(): void {
    this.defusalModal.show();
  }

  hideDefusalModal(): void {
    this.defusalModal.hide();
  }

  hideAll(): void {
    this.mainMenu.hide();
    this.armory.hide();
    this.planning.hide();
    this.hud.hide();
    this.defusalModal.hide();
    this.afterAction.hide();
    this.gameOverModal.hide();
    this.pauseModal.hide();
  }
}
