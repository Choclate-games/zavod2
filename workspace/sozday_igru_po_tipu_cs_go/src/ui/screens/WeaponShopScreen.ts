import { ICONS } from '../icons';
import { StorageService } from '../../platform/StorageService';
import { PlaygamaService } from '../../platform/PlaygamaService';
import { AudioManager } from '../../audio/AudioManager';
import { EntityManager } from '../../entities/EntityManager';

export class WeaponShopScreen {
  public root: HTMLElement;
  private coinsText: HTMLElement;
  private currentWeaponId = 'deagle';
  private equipBtn: HTMLElement;
  private statusText: HTMLElement;

  constructor(private onBackClick: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'screen-root';

    // Zone 1: Header
    const header = document.createElement('div');
    header.className = 'zone-header';

    const title = document.createElement('div');
    title.className = 'cyber-panel';
    title.innerHTML = `<h2 style="font-family: var(--font-display); font-size: 24px; color: var(--color-text-bright); text-transform: uppercase;">ОРУЖЕЙНАЯ И СКИНЫ</h2>`;
    header.appendChild(title);

    const coinsBox = document.createElement('div');
    coinsBox.className = 'cyber-panel';
    this.coinsText = document.createElement('strong');
    this.coinsText.className = 'tabular-nums';
    this.coinsText.style.color = 'var(--color-highlight)';
    coinsBox.innerHTML = `<span style="color: var(--color-metallic); font-size: 13px;">ЗОЛОТО: </span>`;
    coinsBox.appendChild(this.coinsText);
    header.appendChild(coinsBox);
    this.root.appendChild(header);

    // Zone 2: Content (Weapon Selector Grid)
    const content = document.createElement('div');
    content.className = 'zone-content';

    const selectorPanel = document.createElement('div');
    selectorPanel.className = 'cyber-panel';
    selectorPanel.style.display = 'flex';
    selectorPanel.style.gap = 'var(--space-4)';

    const weapons = [
      { id: 'deagle', name: 'Desert Eagle', desc: 'Ван-Тап хедшот (140 HP), 7 патронов' },
      { id: 'ak47', name: 'AK-47 Tactical', desc: 'Высокая скорострельность, 30 патронов' },
      { id: 'awp', name: 'AWP Sniper', desc: 'Смертельный урон в корпус и через стены' }
    ];

    weapons.forEach((w) => {
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.style.flexDirection = 'column';
      btn.style.padding = 'var(--space-3) var(--space-4)';
      btn.innerHTML = `<strong style="font-size: 18px; color: var(--color-secondary);">${w.name}</strong><span style="font-size: 11px; color: var(--color-metallic); margin-top: 4px;">${w.desc}</span>`;
      btn.addEventListener('click', () => {
        AudioManager.get().playClick();
        this.selectWeapon(w.id);
      });
      selectorPanel.appendChild(btn);
    });
    content.appendChild(selectorPanel);

    this.statusText = document.createElement('div');
    this.statusText.className = 'cyber-panel';
    this.statusText.style.color = 'var(--color-text-bright)';
    content.appendChild(this.statusText);

    this.root.appendChild(content);

    // Zone 3: Actions
    const actions = document.createElement('div');
    actions.className = 'zone-actions';

    this.equipBtn = document.createElement('button');
    this.equipBtn.className = 'btn-primary';
    this.equipBtn.innerHTML = `<span>ЭКИПИРОВАТЬ</span>`;
    this.equipBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      StorageService.get().updateData({ selectedWeapon: this.currentWeaponId });
      EntityManager.get().player.setWeapon(this.currentWeaponId);
      this.refresh();
    });
    actions.appendChild(this.equipBtn);

    const caseBtn = document.createElement('button');
    caseBtn.className = 'btn-secondary';
    caseBtn.innerHTML = `${ICONS.video} <span>БЕСПЛАТНЫЙ КЕЙС (+100 ЗОЛОТА)</span>`;
    caseBtn.addEventListener('click', () => {
      PlaygamaService.get().showRewarded('free_weapon_case', (amount) => {
        const cur = StorageService.get().getData();
        StorageService.get().updateData({ coins: cur.coins + amount });
        this.refresh();
      });
    });
    actions.appendChild(caseBtn);

    const backBtn = document.createElement('button');
    backBtn.className = 'btn-secondary';
    backBtn.innerHTML = `${ICONS.close} <span>НАЗАД</span>`;
    backBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onBackClick();
    });
    actions.appendChild(backBtn);

    this.root.appendChild(actions);
    this.refresh();
  }

  private selectWeapon(id: string): void {
    this.currentWeaponId = id;
    this.refresh();
  }

  public refresh(): void {
    const data = StorageService.get().getData();
    this.coinsText.textContent = data.coins.toString();
    const isEquipped = data.selectedWeapon === this.currentWeaponId;
    this.statusText.textContent = `ВЫБРАН СТВОЛ: ${this.currentWeaponId.toUpperCase()} (${isEquipped ? 'ЭКИПИРОВАНО' : 'НЕ АКТИВНО'})`;
    this.equipBtn.style.opacity = isEquipped ? '0.6' : '1.0';
  }
}