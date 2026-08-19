import { gameState } from '../../core/GameState';
import { Localization } from '../../core/Localization';
import { storageService } from '../../platform/StorageService';
import { audioManager } from '../../audio/AudioManager';

export interface HangarUpgradeDef {
  key: keyof typeof gameState.saveData.metaUpgrades;
  nameKey: string;
  icon: string;
  baseCost: number;
  costMult: number;
  maxLevel: number;
}

export const HANGAR_UPGRADES: HangarUpgradeDef[] = [
  { key: 'hullLevel', nameKey: 'upgrade_hull_name', icon: '🛡️', baseCost: 30, costMult: 1.6, maxLevel: 10 },
  { key: 'torqueLevel', nameKey: 'upgrade_torque_name', icon: '⚡', baseCost: 40, costMult: 1.7, maxLevel: 10 },
  { key: 'coolingLevel', nameKey: 'upgrade_cooling_name', icon: '❄️', baseCost: 35, costMult: 1.6, maxLevel: 10 },
  { key: 'magnetLevel', nameKey: 'upgrade_magnet_name', icon: '🧲', baseCost: 25, costMult: 1.5, maxLevel: 10 },
  { key: 'turretLevel', nameKey: 'upgrade_turret_name', icon: '🔫', baseCost: 50, costMult: 1.8, maxLevel: 5 },
];

export class HangarModal {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'modal-overlay interactive';
    this.container.id = 'hangar-modal';
    parent.appendChild(this.container);
  }

  public open(): void {
    this.render();
    this.container.classList.add('active');
  }

  private render(): void {
    const meta = gameState.saveData.metaUpgrades;

    let listHtml = '';
    for (const upg of HANGAR_UPGRADES) {
      const lvl = meta[upg.key];
      const isMax = lvl >= upg.maxLevel;
      const cost = Math.floor(upg.baseCost * Math.pow(upg.costMult, lvl));
      const canAfford = gameState.saveData.totalCrystals >= cost;
      const name = Localization.t(upg.nameKey);

      listHtml += `
        <div style="background: #111728; border: 1px solid var(--border-steel); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">${upg.icon}</span>
            <div>
              <div style="font-weight: 800; font-size: 14px; color: #fff;">${name}</div>
              <div style="font-size: 11px; color: var(--accent-cyan);">Lv. ${lvl} / ${upg.maxLevel}</div>
            </div>
          </div>
          <div>
            ${
              isMax
                ? `<span style="font-size: 12px; font-weight: 800; color: var(--accent-gold);">${Localization.t('upgradeMax')}</span>`
                : `<button class="btn-main upg-btn" data-upg-key="${upg.key}" data-cost="${cost}" ${!canAfford ? 'style="opacity: 0.5;"' : ''} style="font-size: 12px; padding: 6px 12px;">
                    ${cost} 💎
                  </button>`
            }
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="modal-card" style="gap: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 18px; color: #fff; font-weight: 900;">
            🛠️ ${Localization.t('hangarTitle')}
          </h2>
          <div style="font-size: 15px; font-weight: 800; color: var(--accent-gold);">
            ${gameState.saveData.totalCrystals} 💎
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${listHtml}
        </div>

        <button class="btn-secondary" id="btn-close-hangar" style="padding: 12px;">
          ${Localization.t('closeBtn')}
        </button>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    document.getElementById('btn-close-hangar')?.addEventListener('click', () => {
      this.close();
    });

    const btns = this.container.querySelectorAll('.upg-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-upg-key') as keyof typeof gameState.saveData.metaUpgrades;
        const cost = Number(btn.getAttribute('data-cost'));

        if (key && gameState.saveData.totalCrystals >= cost) {
          gameState.saveData.totalCrystals -= cost;
          gameState.saveData.metaUpgrades[key]++;
          storageService.save();
          audioManager.playCrystalPickup(2);
          this.render();
        }
      });
    });
  }

  public close(): void {
    this.container.classList.remove('active');
  }
}
