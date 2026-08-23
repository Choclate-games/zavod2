import { Button } from '../components/Button';
import { StorageService } from '../../platform/StorageService';
import { AudioManager } from '../../audio/AudioManager';

export class PauseSettingsModalScreen {
  public element: HTMLDivElement;

  constructor(onResume: () => void, onExitToBunker: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'game-screen interactive';

    const card = document.createElement('div');
    card.className = 'panel';
    card.style.maxWidth = '500px';
    card.style.margin = 'auto';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = 'var(--space-4)';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = 'БОЕВОЙ ФОРМУЛЯР // ТАКТИЧЕСКАЯ ПАУЗА';
    card.appendChild(header);

    // Ползунки громкости
    const data = StorageService.getData();

    const sfxRow = document.createElement('div');
    sfxRow.style.display = 'flex';
    sfxRow.style.justifyContent = 'space-between';
    sfxRow.style.alignItems = 'center';
    sfxRow.innerHTML = `
      <span>Громкость спецэффектов (SFX):</span>
      <button class="btn interactive" style="min-height: 48px; min-width: 90px;" id="btn-sfx-toggle">
        ${Math.round(data.settings.sfxVolume * 100)}%
      </button>
    `;
    const sfxBtn = sfxRow.querySelector('#btn-sfx-toggle') as HTMLButtonElement;
    sfxBtn.addEventListener('click', () => {
      let vol = data.settings.sfxVolume + 0.25;
      if (vol > 1.01) vol = 0;
      data.settings.sfxVolume = vol;
      AudioManager.setSfxVolume(vol);
      StorageService.save(data);
      sfxBtn.textContent = `${Math.round(vol * 100)}%`;
    });
    card.appendChild(sfxRow);

    // Кнопки действий
    const btnResume = new Button({
      label: 'ПРОДОЛЖИТЬ БОЙ',
      isPrimary: true,
      onClick: onResume,
    });
    card.appendChild(btnResume.element);

    const btnExit = new Button({
      label: 'ЭВАКУАЦИЯ В БУНКЕР',
      className: 'btn-danger',
      onClick: onExitToBunker,
    });
    card.appendChild(btnExit.element);

    this.element.appendChild(card);
  }
}
