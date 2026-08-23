import { I18nService } from '../i18n';
import { SaveService } from '../../platform/SaveService';

export interface WeaponItem {
  id: string;
  name: string;
  caliber: string;
  damage: number;
  velocity: number;
  suppression: number;
  cost: number;
}

export const WEAPONS: WeaponItem[] = [
  { id: 'svdm', name: 'СВДМ Армейская', caliber: '7.62x54mmR', damage: 100, velocity: 830, suppression: 20, cost: 0 },
  { id: 'vss_vintorez', name: 'ВСС «Винторез»', caliber: '9x39mm СП-5', damage: 95, velocity: 290, suppression: 95, cost: 0 },
  { id: 't5000', name: 'ОРСИС Т-5000', caliber: '.338 Lapua Mag', damage: 160, velocity: 910, suppression: 40, cost: 3000 },
  { id: 'dvl10', name: 'DVL-10 «Урбана»', caliber: '.308 Win', damage: 130, velocity: 840, suppression: 85, cost: 4500 },
  { id: 'barrett50', name: 'Barrett .50 BMG', caliber: '12.7x99mm', damage: 250, velocity: 853, suppression: 0, cost: 7000 }
];

export class ArsenalScreen {
  public root: HTMLDivElement;
  public onBackClick?: () => void;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'arsenal_screen';
    this.root.className = 'screen-container';
    this.render();
  }

  public render(): void {
    const saveData = SaveService.getData();

    this.root.innerHTML = `
      <header class="screen-header">
        <h2 style="font-size: 20px; font-weight: 700; color: var(--color-accent);">${I18nService.t('arsenal')}</h2>
        <div class="tabular-nums" style="font-size: 16px; color: var(--color-amber);">
          КРЕДИТЫ: ${saveData.credits}
        </div>
      </header>

      <main class="screen-content" style="flex-direction: column; align-items: stretch;">
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; width: 100%;">
          ${WEAPONS.map((w) => {
            const isUnlocked = saveData.unlockedWeapons.includes(w.id);
            const isSelected = saveData.selectedWeapon === w.id;
            return `
              <div class="tactical-card" style="border-color: ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'};">
                <div style="display: flex; justify-content: space-between;">
                  <span style="font-weight: 700; color: var(--color-text);">${w.name}</span>
                  <span style="font-size: 12px; color: var(--color-text-muted);">${w.caliber}</span>
                </div>
                <div style="font-size: 12px; display: flex; flex-direction: column; gap: 4px; margin: 8px 0;">
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--color-text-muted);">${I18nService.t('damage')}:</span>
                    <span class="tabular-nums" style="color: var(--color-text);">${w.damage}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--color-text-muted);">${I18nService.t('velocity')}:</span>
                    <span class="tabular-nums" style="color: var(--color-text);">${w.velocity} м/с</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--color-text-muted);">${I18nService.t('suppression')}:</span>
                    <span class="tabular-nums" style="color: var(--color-accent);">${w.suppression}%</span>
                  </div>
                </div>
                <button
                  class="btn ${isSelected ? 'btn-primary' : isUnlocked ? '' : 'btn-amber'}"
                  data-weapon-id="${w.id}"
                  data-cost="${w.cost}"
                  data-unlocked="${isUnlocked}"
                  style="min-height: 48px; width: 100%;"
                >
                  ${isSelected ? I18nService.t('selected') : isUnlocked ? I18nService.t('select') : `${I18nService.t('buy')} (${w.cost})`}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </main>

      <footer class="screen-actions">
        <button id="btn-arsenal-back" class="btn">
          ${I18nService.t('back')}
        </button>
      </footer>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const backBtn = this.root.querySelector('#btn-arsenal-back');
    backBtn?.addEventListener('click', () => {
      this.onBackClick?.();
    });

    const weaponBtns = this.root.querySelectorAll('[data-weapon-id]');
    weaponBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const weaponId = target.dataset.weaponId!;
        const cost = parseInt(target.dataset.cost || '0', 10);
        const isUnlocked = target.dataset.unlocked === 'true';

        const saveData = SaveService.getData();
        if (isUnlocked) {
          SaveService.selectWeapon(weaponId);
          this.render();
        } else if (saveData.credits >= cost) {
          SaveService.addCredits(-cost);
          SaveService.unlockWeapon(weaponId);
          SaveService.selectWeapon(weaponId);
          this.render();
        }
      });
    });
  }

  public show(): void {
    this.render();
    this.root.classList.remove('hidden');
  }

  public hide(): void {
    this.root.classList.add('hidden');
  }
}
