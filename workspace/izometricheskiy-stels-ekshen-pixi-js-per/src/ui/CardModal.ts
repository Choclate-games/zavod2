/**
 * 3-Card Roguelite Modal UI
 */

import { UpgradeCard, UpgradeManager } from '../systems/UpgradeManager';
import { PlaygamaService } from '../platform/PlaygamaService';
import { Player } from '../entities/Player';

export class CardModal {
  private modalEl: HTMLElement | null;
  private containerEl: HTMLElement | null;
  private rerollBtn: HTMLElement | null;
  private onSelectCallback: (() => void) | null = null;
  private rerollsUsed = 0;

  constructor(private upgradeManager: UpgradeManager) {
    this.modalEl = document.getElementById('modal-upgrade');
    this.containerEl = document.getElementById('upgrade-cards-container');
    this.rerollBtn = document.getElementById('btn-reroll-ad');

    this.setupListeners();
  }

  private setupListeners(): void {
    if (this.rerollBtn) {
      this.rerollBtn.addEventListener('click', async () => {
        if (this.rerollsUsed >= 2) return;
        const rewarded = await PlaygamaService.showRewarded('free_card_reroll');
        if (rewarded) {
          this.rerollsUsed++;
          this.renderCards(true);
        }
      });
    }
  }

  show(player: Player, onSelect: () => void): void {
    this.onSelectCallback = onSelect;
    this.rerollsUsed = 0;
    this.renderCards(false, player);

    if (this.modalEl) {
      this.modalEl.classList.add('active');
    }

    if (this.rerollBtn) {
      this.rerollBtn.style.display = PlaygamaService.isRewardedSupported ? 'flex' : 'none';
    }
  }

  private renderCards(guaranteeRare = false, player?: Player): void {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    const cards = this.upgradeManager.rollThreeCards(guaranteeRare);

    cards.forEach((card) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = `upgrade-card ${card.rarity}`;

      cardDiv.innerHTML = `
        <div class="card-icon">${card.icon}</div>
        <div class="card-rarity">${card.rarity.toUpperCase()}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-desc">${card.description}</div>
      `;

      cardDiv.addEventListener('click', () => {
        if (player) {
          this.upgradeManager.applyCard(card, player);
        }
        this.hide();
        if (this.onSelectCallback) {
          this.onSelectCallback();
        }
      });

      this.containerEl!.appendChild(cardDiv);
    });
  }

  hide(): void {
    if (this.modalEl) {
      this.modalEl.classList.remove('active');
    }
  }
}
