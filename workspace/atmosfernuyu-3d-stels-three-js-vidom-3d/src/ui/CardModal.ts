import { UpgradeCard } from '../systems/UpgradeManager';
import { audioManager } from '../audio/AudioManager';

export class CardModal {
  private modalEl: HTMLElement;
  private containerEl: HTMLElement;
  private rerollBtn: HTMLElement;
  private onSelectCallback: ((card: UpgradeCard) => void) | null = null;
  private onRerollCallback: (() => void) | null = null;

  constructor() {
    this.modalEl = document.getElementById('screen-upgrade-modal')!;
    this.containerEl = document.getElementById('cards-container')!;
    this.rerollBtn = document.getElementById('btn-ad-reroll')!;

    this.rerollBtn.addEventListener('click', () => {
      audioManager.playButtonClick();
      if (this.onRerollCallback) {
        this.onRerollCallback();
      }
    });
  }

  show(cards: UpgradeCard[], onSelect: (card: UpgradeCard) => void, onReroll: () => void): void {
    this.onSelectCallback = onSelect;
    this.onRerollCallback = onReroll;
    this.renderCards(cards);
    this.modalEl.classList.remove('hidden');
  }

  renderCards(cards: UpgradeCard[]): void {
    this.containerEl.innerHTML = '';

    cards.forEach((card) => {
      const el = document.createElement('div');
      el.className = 'upgrade-card';

      const rarityClass = `rarity-${card.rarity}`;
      el.innerHTML = `
        <div class="card-rarity-badge ${rarityClass}">${card.rarity}</div>
        <div class="card-icon">${card.icon}</div>
        <div class="card-title">${card.title}</div>
        <div class="card-desc">${card.desc}</div>
        <div class="card-synergy">${card.synergy}</div>
      `;

      el.addEventListener('click', () => {
        audioManager.playButtonClick();
        this.hide();
        if (this.onSelectCallback) {
          this.onSelectCallback(card);
        }
      });

      this.containerEl.appendChild(el);
    });
  }

  hide(): void {
    this.modalEl.classList.add('hidden');
  }
}
