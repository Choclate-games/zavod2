import { BaseScreen } from '../ScreenRouter';
import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { events } from '../../core/EventBus';
import { storage } from '../../platform/StorageService';
import { audio } from '../../audio/AudioManager';
import { ui } from '../UiRoot';

export class PauseModalScreen implements BaseScreen {
  public readonly element: HTMLElement;
  private soundBtn!: Button;
  private sensBtn!: Button;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'screen';
    this.element.id = 'screen-pause';

    this.buildMarkup();
    ui.screenLayer.appendChild(this.element);
  }

  private buildMarkup(): void {
    // Zone 1: Identity
    const zoneIdentity = document.createElement('div');
    zoneIdentity.className = 'zone-identity';
    zoneIdentity.style.alignItems = 'center';

    const title = document.createElement('h1');
    title.className = 'game-title';
    title.textContent = 'ПАУЗА И НАСТРОЙКИ';

    zoneIdentity.appendChild(title);
    this.element.appendChild(zoneIdentity);

    // Zone 2: Primary Action
    const zonePrimary = document.createElement('div');
    zonePrimary.className = 'zone-primary';

    const resumeBtn = new Button({
      label: 'ПРОДОЛЖИТЬ БОЙ',
      variant: 'primary',
      icon: ICONS.PLAY,
      onClick: () => {
        events.emit('NAVIGATE_SCREEN', 'GameplayHUD');
        events.emit('GAME_STATE_CHANGED', 'PLAYING');
      },
    });
    zonePrimary.appendChild(resumeBtn.element);
    this.element.appendChild(zonePrimary);

    // Zone 3: Secondary Row
    const zoneSecondary = document.createElement('div');
    zoneSecondary.className = 'zone-secondary';

    const controlsCard = document.createElement('div');
    controlsCard.className = 'card-panel';
    controlsCard.style.cssText = 'display:flex;gap:16px;align-items:center;';

    const data = storage.getData();

    this.soundBtn = new Button({
      label: data.isMuted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ',
      icon: data.isMuted ? ICONS.SOUND_OFF : ICONS.SOUND_ON,
      onClick: () => {
        const isMuted = audio.toggleMute();
        storage.updateData({ isMuted });
        this.soundBtn.setLabel(isMuted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ');
      },
    });

    this.sensBtn = new Button({
      label: `СЕНСА: ${data.mouseSensitivity.toFixed(1)}x`,
      onClick: () => {
        let sens = storage.getData().mouseSensitivity + 0.5;
        if (sens > 3.0) sens = 0.5;
        storage.updateData({ mouseSensitivity: sens });
        this.sensBtn.setLabel(`СЕНСА: ${sens.toFixed(1)}x`);
        events.emit('SET_SENSITIVITY', sens);
      },
    });

    controlsCard.appendChild(this.soundBtn.element);
    controlsCard.appendChild(this.sensBtn.element);
    zoneSecondary.appendChild(controlsCard);

    const quitBtn = new Button({
      label: 'ВЫЙТИ В МЕНЮ',
      variant: 'danger',
      icon: ICONS.BACK,
      onClick: () => {
        events.emit('NAVIGATE_SCREEN', 'MainMenu');
        events.emit('GAME_STATE_CHANGED', 'MENU');
      },
    });
    zoneSecondary.appendChild(quitBtn.element);

    this.element.appendChild(zoneSecondary);
  }

  public show(): void {
    this.element.classList.add('active');
  }

  public hide(): void {
    this.element.classList.remove('active');
  }
}
