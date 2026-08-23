import { BriefingScreen } from './screens/BriefingScreen';
import { GameplayHUD } from './screens/GameplayHUD';
import { DebriefingScreen } from './screens/DebriefingScreen';
import { ArsenalScreen } from './screens/ArsenalScreen';
import { EventBus, GameState } from '../core/EventBus';

export class ScreenRouter {
  public briefingScreen: BriefingScreen;
  public gameplayHUD: GameplayHUD;
  public debriefingScreen: DebriefingScreen;
  public arsenalScreen: ArsenalScreen;
  private container: HTMLElement;
  public currentScreen: GameState = 'BRIEFING';
  private pauseModal: HTMLDivElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.briefingScreen = new BriefingScreen();
    this.gameplayHUD = new GameplayHUD();
    this.debriefingScreen = new DebriefingScreen();
    this.arsenalScreen = new ArsenalScreen();

    this.container.appendChild(this.briefingScreen.root);
    this.container.appendChild(this.gameplayHUD.root);
    this.container.appendChild(this.debriefingScreen.root);
    this.container.appendChild(this.arsenalScreen.root);

    this.createPauseModal();
    this.bindScreenTransitions();

    EventBus.on('GAME_STATE_CHANGED', (state: GameState) => {
      this.switchState(state);
    });
  }

  private createPauseModal(): void {
    this.pauseModal = document.createElement('div');
    this.pauseModal.id = 'pause-modal';
    this.pauseModal.className = 'screen-container';
    this.pauseModal.style.zIndex = 'var(--z-modals)';
    this.pauseModal.style.alignItems = 'center';
    this.pauseModal.style.justifyContent = 'center';

    this.pauseModal.innerHTML = `
      <div class="tactical-card" style="padding: 24px 32px; min-width: 280px; align-items: center; gap: 16px; pointer-events: auto;">
        <h3 style="font-size: 20px; font-weight: 700; color: var(--color-accent);">ТАКТИЧЕСКАЯ ПАУЗА</h3>
        <button id="btn-resume-game" class="btn btn-primary" style="width: 100%;">ПРОДОЛЖИТЬ</button>
        <button id="btn-abort-mission" class="btn btn-danger" style="width: 100%;">В ШТАБ</button>
      </div>
    `;

    this.container.appendChild(this.pauseModal);
    this.pauseModal.classList.add('hidden');

    const resumeBtn = this.pauseModal.querySelector('#btn-resume-game');
    const abortBtn = this.pauseModal.querySelector('#btn-abort-mission');

    resumeBtn?.addEventListener('click', () => {
      EventBus.emit('GAME_STATE_CHANGED', 'PLAYING');
    });

    abortBtn?.addEventListener('click', () => {
      EventBus.emit('GAME_STATE_CHANGED', 'BRIEFING');
    });
  }

  private bindScreenTransitions(): void {
    this.briefingScreen.onStartClick = () => {
      EventBus.emit('GAME_STATE_CHANGED', 'PLAYING');
    };

    this.briefingScreen.onArsenalClick = () => {
      this.showArsenal();
    };

    this.arsenalScreen.onBackClick = () => {
      this.showBriefing();
    };

    this.debriefingScreen.onNextClick = () => {
      this.showBriefing();
    };

    this.debriefingScreen.onRetryClick = () => {
      EventBus.emit('GAME_STATE_CHANGED', 'PLAYING');
    };
  }

  public switchState(state: GameState): void {
    this.currentScreen = state;

    if (state === 'MENU' || state === 'BRIEFING') {
      this.showBriefing();
    } else if (state === 'PLAYING') {
      this.showGameplay();
    } else if (state === 'PAUSED') {
      this.pauseModal?.classList.remove('hidden');
    } else if (state === 'VICTORY' || state === 'DEFEAT') {
      this.showDebriefing();
    }
  }

  public showBriefing(): void {
    this.briefingScreen.show();
    this.gameplayHUD.hide();
    this.debriefingScreen.hide();
    this.arsenalScreen.hide();
    this.pauseModal?.classList.add('hidden');
  }

  public showGameplay(): void {
    this.briefingScreen.hide();
    this.gameplayHUD.show();
    this.debriefingScreen.hide();
    this.arsenalScreen.hide();
    this.pauseModal?.classList.add('hidden');
  }

  public showDebriefing(): void {
    this.briefingScreen.hide();
    this.gameplayHUD.hide();
    this.debriefingScreen.show();
    this.arsenalScreen.hide();
    this.pauseModal?.classList.add('hidden');
  }

  public showArsenal(): void {
    this.briefingScreen.hide();
    this.gameplayHUD.hide();
    this.debriefingScreen.hide();
    this.arsenalScreen.show();
    this.pauseModal?.classList.add('hidden');
  }
}
