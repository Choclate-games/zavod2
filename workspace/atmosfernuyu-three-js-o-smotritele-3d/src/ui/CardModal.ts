import { i18n } from '../i18n/I18n';
import type { UpgradeCard } from '../systems/UpgradeManager';

/**
 * 3-choice upgrade modal (UI & HUD Layer). Shown at natural wave-break points.
 * The reroll is a rewarded-ad action (capability-gated by the caller).
 */
export class CardModal {
  private readonly root: HTMLDivElement;
  private readonly row: HTMLDivElement;
  private readonly rerollBtn: HTMLButtonElement;
  private onChoose: (id: string) => void = () => {};
  private onReroll: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'card-modal';
    this.root.innerHTML = `
      <div class="panel">
        <h2 data-i18n="upgrade.title">Choose an upgrade</h2>
        <div class="card-row"></div>
        <div class="ad-row"><button class="ad-btn" id="card-reroll" data-i18n="upgrade.reroll">Reroll cards</button></div>
      </div>`;
    this.row = this.root.querySelector('.card-row') as HTMLDivElement;
    this.rerollBtn = this.root.querySelector('#card-reroll') as HTMLButtonElement;
    this.rerollBtn.addEventListener('click', () => {
      if (this.rerollBtn.classList.contains('hidden')) return;
      this.onReroll();
    });
    parent.appendChild(this.root);
  }

  show(
    cards: UpgradeCard[],
    onChoose: (id: string) => void,
    onReroll: () => void,
    canReroll: boolean,
  ): void {
    this.onChoose = onChoose;
    this.onReroll = onReroll;
    this.row.innerHTML = '';
    const tierLabel: Record<string, string> = {
      common: i18n.t('upgrade.common'),
      rare: i18n.t('upgrade.rare'),
      epic: i18n.t('upgrade.epic'),
    };
    for (const c of cards) {
      const card = document.createElement('div');
      card.className = `card ${c.tier}`;
      card.innerHTML = `
        <div class="tier">${tierLabel[c.tier]}</div>
        <div class="name">${i18n.t(c.nameKey)}</div>
        <div class="desc">${i18n.t(c.descKey)}</div>`;
      card.addEventListener('click', () => {
        this.hide();
        this.onChoose(c.id);
      });
      this.row.appendChild(card);
    }
    this.rerollBtn.classList.toggle('hidden', !canReroll);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
  }

  get visible(): boolean {
    return this.root.classList.contains('visible');
  }
}
