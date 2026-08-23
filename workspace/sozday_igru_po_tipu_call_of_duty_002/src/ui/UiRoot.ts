import { Hud } from './Hud';
import { TouchControls } from './TouchControls';
import { ScreenRouter } from './ScreenRouter';
import { eventBus } from '../core/EventBus';
import { MatchStats } from '../systems/MatchFlowVictoryResolutionSystem';

export class UiRoot {
  public rootElement: HTMLElement;
  public hudLayer: HTMLDivElement;
  public screensLayer: HTMLDivElement;
  public controlsLayer: HTMLDivElement;

  public hud: Hud;
  public touchControls: TouchControls;
  public router: ScreenRouter;

  constructor(callbacks: {
    onStartGame: () => void;
    onResumeGame: () => void;
    onQuitToMenu: () => void;
    onNextMatch: () => void;
  }) {
    this.rootElement = document.getElementById('ui-root') || document.body;

    // 1. Layer containers
    this.hudLayer = document.createElement('div');
    this.hudLayer.id = 'hud-layer';
    this.hudLayer.className = 'ui-layer';
    this.rootElement.appendChild(this.hudLayer);

    this.controlsLayer = document.createElement('div');
    this.controlsLayer.id = 'controls-layer';
    this.controlsLayer.className = 'ui-layer';
    this.rootElement.appendChild(this.controlsLayer);

    this.screensLayer = document.createElement('div');
    this.screensLayer.id = 'screens-layer';
    this.screensLayer.className = 'ui-layer';
    this.rootElement.appendChild(this.screensLayer);

    // 2. Initialize UI modules
    this.hud = new Hud(this.hudLayer);
    this.touchControls = new TouchControls(this.controlsLayer);
    this.router = new ScreenRouter(this.screensLayer, callbacks);

    this.setupListeners();
  }

  private setupListeners(): void {
    eventBus.on('GAME_STATE_CHANGED', (state: string) => {
      switch (state) {
        case 'MENU':
          this.hud.setVisible(false);
          this.touchControls.setVisible(false);
          eventBus.emit('SCREEN_NAVIGATE', 'MAIN_MENU');
          break;
        case 'PLAYING':
          this.hud.setVisible(true);
          this.touchControls.setVisible(true);
          eventBus.emit('SCREEN_NAVIGATE', 'HUD');
          break;
        case 'PAUSED':
          this.hud.setVisible(false);
          this.touchControls.setVisible(false);
          eventBus.emit('SCREEN_NAVIGATE', 'PAUSE');
          break;
        case 'VICTORY':
        case 'DEFEAT':
          this.hud.setVisible(false);
          this.touchControls.setVisible(false);
          eventBus.emit('SCREEN_NAVIGATE', 'VICTORY_DEFEAT');
          break;
      }
    });

    eventBus.on('KILLSTREAK_UPDATED', (data: { streak: number; uavActive: boolean }) => {
      this.touchControls.setUavButtonVisible(data.streak >= 3 && !data.uavActive);
    });
  }

  public setVictoryDefeatStats(stats: MatchStats): void {
    this.router.victoryDefeatScreen.setResults(stats);
  }
}