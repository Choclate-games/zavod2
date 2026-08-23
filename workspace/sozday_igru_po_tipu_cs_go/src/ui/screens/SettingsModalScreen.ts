import { ICONS } from '../icons';
import { StorageService } from '../../platform/StorageService';
import { AudioManager } from '../../audio/AudioManager';
import { EventBus } from '../../core/EventBus';

export class SettingsModalScreen {
  public root: HTMLElement;
  private sfxBtn: HTMLElement;
  private sensText: HTMLElement;
  private qualityBtn: HTMLElement;

  constructor(private onCloseClick: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop';

    const card = document.createElement('div');
    card.className = 'cyber-panel modal-card';

    // Zone 1: Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = 'var(--space-4)';
    header.innerHTML = `<h2 style="font-family: var(--font-display); font-size: 24px; color: var(--color-secondary); text-transform: uppercase;">НАСТРОЙКИ СИСТЕМЫ</h2>`;

    const closeTopBtn = document.createElement('button');
    closeTopBtn.className = 'btn-secondary';
    closeTopBtn.style.minHeight = '48px';
    closeTopBtn.style.minWidth = '48px';
    closeTopBtn.innerHTML = ICONS.close;
    closeTopBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onCloseClick();
    });
    header.appendChild(closeTopBtn);
    card.appendChild(header);

    // Zone 2: Content (Settings rows)
    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = 'var(--space-4)';
    content.style.marginBottom = 'var(--space-5)';

    // Row 1: Sound SFX
    const sfxRow = document.createElement('div');
    sfxRow.style.display = 'flex';
    sfxRow.style.justifyContent = 'space-between';
    sfxRow.style.alignItems = 'center';
    sfxRow.innerHTML = `<span style="font-weight: 600;">ЗВУКОВЫЕ ЭФФЕКТЫ</span>`;
    this.sfxBtn = document.createElement('button');
    this.sfxBtn.className = 'btn-secondary';
    this.sfxBtn.innerHTML = `${ICONS.soundOn} <span>ВКЛ</span>`;
    this.sfxBtn.addEventListener('click', () => {
      const cur = StorageService.get().getData().settings;
      const nextVol = cur.sfxVolume > 0 ? 0.0 : 0.8;
      StorageService.get().updateSettings({ sfxVolume: nextVol });
      EventBus.get().emit('SETTINGS_CHANGED', { sfxVolume: nextVol });
      AudioManager.get().playClick();
      this.refresh();
    });
    sfxRow.appendChild(this.sfxBtn);
    content.appendChild(sfxRow);

    // Row 2: Sensitivity
    const sensRow = document.createElement('div');
    sensRow.style.display = 'flex';
    sensRow.style.justifyContent = 'space-between';
    sensRow.style.alignItems = 'center';
    sensRow.innerHTML = `<span style="font-weight: 600;">ЧУВСТВИТЕЛЬНОСТЬ МЫШИ / ТАЧА</span>`;

    const sensCtrl = document.createElement('div');
    sensCtrl.style.display = 'flex';
    sensCtrl.style.gap = '8px';
    sensCtrl.style.alignItems = 'center';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'btn-secondary';
    minusBtn.style.minHeight = '48px';
    minusBtn.style.minWidth = '48px';
    minusBtn.textContent = '-';
    minusBtn.addEventListener('click', () => {
      const cur = StorageService.get().getData().settings;
      const nextSens = Math.max(0.4, Number((cur.sensitivity - 0.2).toFixed(1)));
      StorageService.get().updateSettings({ sensitivity: nextSens });
      EventBus.get().emit('SETTINGS_CHANGED', { sensitivity: nextSens });
      AudioManager.get().playClick();
      this.refresh();
    });
    sensCtrl.appendChild(minusBtn);

    this.sensText = document.createElement('strong');
    this.sensText.className = 'tabular-nums';
    this.sensText.style.width = '36px';
    this.sensText.style.textAlign = 'center';
    this.sensText.textContent = '1.0';
    sensCtrl.appendChild(this.sensText);

    const plusBtn = document.createElement('button');
    plusBtn.className = 'btn-secondary';
    plusBtn.style.minHeight = '48px';
    plusBtn.style.minWidth = '48px';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      const cur = StorageService.get().getData().settings;
      const nextSens = Math.min(2.4, Number((cur.sensitivity + 0.2).toFixed(1)));
      StorageService.get().updateSettings({ sensitivity: nextSens });
      EventBus.get().emit('SETTINGS_CHANGED', { sensitivity: nextSens });
      AudioManager.get().playClick();
      this.refresh();
    });
    sensCtrl.appendChild(plusBtn);

    sensRow.appendChild(sensCtrl);
    content.appendChild(sensRow);

    // Row 3: Graphics
    const gfxRow = document.createElement('div');
    gfxRow.style.display = 'flex';
    gfxRow.style.justifyContent = 'space-between';
    gfxRow.style.alignItems = 'center';
    gfxRow.innerHTML = `<span style="font-weight: 600;">ГРАФИКА</span>`;
    this.qualityBtn = document.createElement('button');
    this.qualityBtn.className = 'btn-secondary';
    this.qualityBtn.textContent = 'ВЫСОКАЯ (60 FPS)';
    this.qualityBtn.addEventListener('click', () => {
      const cur = StorageService.get().getData().settings;
      const nextQ = cur.graphicsQuality === 'high' ? 'low' : 'high';
      StorageService.get().updateSettings({ graphicsQuality: nextQ });
      EventBus.get().emit('SETTINGS_CHANGED', { graphicsQuality: nextQ });
      AudioManager.get().playClick();
      this.refresh();
    });
    gfxRow.appendChild(this.qualityBtn);
    content.appendChild(gfxRow);

    card.appendChild(content);

    // Zone 3: Actions
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'center';

    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn-secondary';
    doneBtn.innerHTML = `<span>СОХРАНИТЬ И ЗАКРЫТЬ</span>`;
    doneBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onCloseClick();
    });
    actions.appendChild(doneBtn);
    card.appendChild(actions);

    this.root.appendChild(card);
    this.refresh();
  }

  public show(): void {
    this.root.classList.add('active');
    this.refresh();
  }

  public hide(): void {
    this.root.classList.remove('active');
  }

  public refresh(): void {
    const s = StorageService.get().getData().settings;
    this.sfxBtn.innerHTML = s.sfxVolume > 0 ? `${ICONS.soundOn} <span>ВКЛ</span>` : `${ICONS.soundOff} <span>ВЫКЛ</span>`;
    this.sensText.textContent = s.sensitivity.toFixed(1);
    this.qualityBtn.textContent = s.graphicsQuality === 'high' ? 'ВЫСОКАЯ (60 FPS)' : 'НИЗКАЯ (БАТАРЕЯ)';
  }
}