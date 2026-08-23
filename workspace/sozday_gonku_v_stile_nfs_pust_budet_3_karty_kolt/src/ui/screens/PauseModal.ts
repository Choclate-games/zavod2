import { BaseScreen } from '../ScreenRouter';
import { playgama } from '../../platform/PlaygamaService';
import { events } from '../../core/EventBus';
import { ICONS } from '../icons';

export class PauseModal implements BaseScreen {
  readonly root: HTMLElement;
  private soundBtn!: HTMLElement;

  private onResumeCallback: () => void;
  private onRestartCallback: () => void;
  private onGarageCallback: () => void;

  constructor(onResume: () => void, onRestart: () => void, onGarage: () => void) {
    this.onResumeCallback = onResume;
    this.onRestartCallback = onRestart;
    this.onGarageCallback = onGarage;

    this.root = document.createElement('div');
    this.root.className = 'screen screen-pause-modal';
    this.root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
    `;

    this.buildMarkup();
  }

  private buildMarkup(): void {
    const dialog = document.createElement('div');
    dialog.className = 'glass-panel cyber-cut';
    dialog.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: calc(var(--space-4) * var(--ui-scale));
      padding: calc(var(--space-6) * var(--ui-scale));
      min-width: calc(300px * var(--ui-scale));
    `;

    const title = document.createElement('div');
    title.textContent = 'ПАУЗА ЗАЕЗДА';
    title.style.cssText = `
      font-family: var(--font-display);
      font-size: calc(22px * var(--ui-scale));
      font-weight: 900;
      color: var(--color-primary);
      letter-spacing: 0.1em;
    `;

    const btnResume = document.createElement('button');
    btnResume.className = 'btn btn-primary cyber-cut';
    btnResume.innerHTML = `${ICONS.play} ПРОДОЛЖИТЬ`;
    btnResume.style.cssText = `width: 100%; min-height: 64px;`;
    btnResume.addEventListener('click', () => this.onResumeCallback());

    const btnRestart = document.createElement('button');
    btnRestart.className = 'btn btn-secondary cyber-cut';
    btnRestart.innerHTML = `${ICONS.restart} РЕСТАРТ`;
    btnRestart.style.cssText = `width: 100%; min-height: 64px;`;
    btnRestart.addEventListener('click', () => this.onRestartCallback());

    const btnGarage = document.createElement('button');
    btnGarage.className = 'btn btn-secondary cyber-cut';
    btnGarage.innerHTML = `${ICONS.garage} В ГАРАЖ`;
    btnGarage.style.cssText = `width: 100%; min-height: 64px;`;
    btnGarage.addEventListener('click', () => this.onGarageCallback());

    this.soundBtn = document.createElement('button');
    this.soundBtn.className = 'btn btn-secondary cyber-cut';
    this.soundBtn.style.cssText = `width: 100%; min-height: 48px; font-size: calc(12px * var(--ui-scale));`;
    this.soundBtn.addEventListener('click', () => {
      const prof = playgama.getProfile();
      prof.settings.soundEnabled = !prof.settings.soundEnabled;
      playgama.saveDebounced();
      events.emit('SETTINGS_CHANGED', {
        soundEnabled: prof.settings.soundEnabled,
        musicVolume: prof.settings.musicVolume,
        sfxVolume: prof.settings.sfxVolume,
      });
      this.updateSoundBtn();
    });

    dialog.appendChild(title);
    dialog.appendChild(btnResume);
    dialog.appendChild(btnRestart);
    dialog.appendChild(btnGarage);
    dialog.appendChild(this.soundBtn);

    this.root.appendChild(dialog);
    this.updateSoundBtn();
  }

  private updateSoundBtn(): void {
    const prof = playgama.getProfile();
    const isEnabled = prof.settings.soundEnabled;
    this.soundBtn.innerHTML = isEnabled
      ? `${ICONS.soundOn} ЗВУК: ВКЛЮЧЕН`
      : `${ICONS.soundOff} ЗВУК: ВЫКЛЮЧЕН`;
  }

  show(): void {
    this.updateSoundBtn();
  }

  hide(): void {}
}
