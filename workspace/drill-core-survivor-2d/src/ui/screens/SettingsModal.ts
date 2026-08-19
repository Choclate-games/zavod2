import { gameState } from '../../core/GameState';
import { Localization } from '../../core/Localization';
import { audioManager } from '../../audio/AudioManager';
import { storageService } from '../../platform/StorageService';
import { eventBus } from '../../core/EventBus';

export class SettingsModal {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'modal-overlay interactive';
    this.container.id = 'settings-modal';
    parent.appendChild(this.container);
  }

  public open(): void {
    this.render();
    this.container.classList.add('active');
  }

  private render(): void {
    const save = gameState.saveData;

    this.container.innerHTML = `
      <div class="modal-card" style="gap: 16px;">
        <h2 style="font-size: 20px; color: #fff; font-weight: 900; text-align: center;">
          ⚙️ ${Localization.t('settingsBtn')}
        </h2>

        <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
          <!-- Music Volume -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">${Localization.t('musicVol')}</span>
              <strong id="val-music">${Math.round(save.musicVolume * 100)}%</strong>
            </div>
            <input type="range" id="input-music" min="0" max="1" step="0.05" value="${save.musicVolume}" style="width: 100%; accent-color: var(--accent-cyan);" />
          </div>

          <!-- SFX Volume -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">${Localization.t('sfxVol')}</span>
              <strong id="val-sfx">${Math.round(save.sfxVolume * 100)}%</strong>
            </div>
            <input type="range" id="input-sfx" min="0" max="1" step="0.05" value="${save.sfxVolume}" style="width: 100%; accent-color: var(--accent-cyan);" />
          </div>

          <!-- Language -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">${Localization.t('languageLabel')}</span>
            <div style="display: flex; gap: 8px;">
              <button class="btn-secondary ${save.language === 'ru' ? 'btn-cyan' : ''}" id="btn-lang-ru" style="padding: 6px 12px;">RU</button>
              <button class="btn-secondary ${save.language === 'en' ? 'btn-cyan' : ''}" id="btn-lang-en" style="padding: 6px 12px;">EN</button>
            </div>
          </div>
        </div>

        <button class="btn-main" id="btn-close-settings" style="padding: 12px; margin-top: 10px;">
          ${Localization.t('closeBtn')}
        </button>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const musicInput = document.getElementById('input-music') as HTMLInputElement;
    const sfxInput = document.getElementById('input-sfx') as HTMLInputElement;
    const musicVal = document.getElementById('val-music');
    const sfxVal = document.getElementById('val-sfx');

    musicInput?.addEventListener('input', () => {
      const v = Number(musicInput.value);
      gameState.saveData.musicVolume = v;
      if (musicVal) musicVal.textContent = `${Math.round(v * 100)}%`;
      audioManager.updateVolumes();
    });

    sfxInput?.addEventListener('input', () => {
      const v = Number(sfxInput.value);
      gameState.saveData.sfxVolume = v;
      if (sfxVal) sfxVal.textContent = `${Math.round(v * 100)}%`;
      audioManager.updateVolumes();
    });

    document.getElementById('btn-lang-ru')?.addEventListener('click', () => {
      Localization.setLanguage('ru');
      gameState.saveData.language = 'ru';
      this.render();
      eventBus.emit('ui:language_changed');
    });

    document.getElementById('btn-lang-en')?.addEventListener('click', () => {
      Localization.setLanguage('en');
      gameState.saveData.language = 'en';
      this.render();
      eventBus.emit('ui:language_changed');
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      storageService.save();
      this.close();
    });
  }

  public close(): void {
    this.container.classList.remove('active');
  }
}
