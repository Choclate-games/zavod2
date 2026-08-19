import { gameState } from '../../core/GameState';
import { Localization } from '../../core/Localization';
import { PerkCard, upgradeManager } from '../../systems/UpgradeManager';
import { eventBus } from '../../core/EventBus';
import { audioManager } from '../../audio/AudioManager';

export class DraftModal {
  private container: HTMLElement;
  private cardsContainer!: HTMLElement;
  private currentOptions: PerkCard[] = [];

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'modal-overlay interactive';
    this.container.id = 'draft-modal';
    parent.appendChild(this.container);

    this.buildDom();
  }

  private buildDom(): void {
    this.container.innerHTML = `
      <div class="modal-card" style="gap: 16px;">
        <div style="text-align: center;">
          <div style="font-size: 11px; font-weight: 800; color: var(--accent-cyan); letter-spacing: 2px;">
            CRAFT PROTOCOL
          </div>
          <h2 style="font-size: 20px; color: #fff; margin-top: 2px;">
            ${Localization.t('draftTitle')}
          </h2>
        </div>

        <div class="draft-cards-grid" id="draft-cards-list"></div>

        <div style="display: flex; justify-content: center;">
          <button class="btn-secondary" id="btn-draft-reroll" style="font-size: 12px; padding: 8px 16px;">
            🎲 ${Localization.t('rerollBtn')} (15 💎)
          </button>
        </div>
      </div>
    `;

    this.cardsContainer = document.getElementById('draft-cards-list')!;

    document.getElementById('btn-draft-reroll')?.addEventListener('click', () => {
      if (gameState.saveData.totalCrystals >= 15) {
        gameState.saveData.totalCrystals -= 15;
        this.open();
      }
    });
  }

  public open(): void {
    audioManager.playDraftAppear();
    audioManager.setFilterMuffled(true);
    this.currentOptions = upgradeManager.getDraftOptions(3);
    this.renderCards();
    this.container.classList.add('active');
  }

  private renderCards(): void {
    let html = '';
    for (const perk of this.currentOptions) {
      const rarityClass = perk.rarity;
      const rarityLabel = Localization.t(`rarity${perk.rarity.charAt(0).toUpperCase() + perk.rarity.slice(1)}`);
      const name = Localization.t(perk.nameKey);
      const desc = Localization.t(perk.descKey);
      const nextLvl = perk.currentLevel + 1;

      html += `
        <div class="perk-choice-card ${rarityClass}" data-perk-id="${perk.id}">
          <div class="perk-icon-large">${perk.icon}</div>
          <div class="perk-card-info">
            <div class="perk-card-title">
              <span>${name}</span>
              <span class="perk-rarity-tag tag-${rarityClass}">${rarityLabel} (Lv.${nextLvl})</span>
            </div>
            <div class="perk-card-desc">${desc}</div>
          </div>
        </div>
      `;
    }

    this.cardsContainer.innerHTML = html;

    // Attach click listeners to cards
    const cardEls = this.cardsContainer.querySelectorAll('.perk-choice-card');
    cardEls.forEach((el) => {
      el.addEventListener('click', () => {
        const perkId = el.getAttribute('data-perk-id');
        if (perkId) {
          this.selectPerk(perkId);
        }
      });
    });
  }

  private selectPerk(perkId: string): void {
    upgradeManager.applyPerk(perkId);
    audioManager.playCrystalPickup(4);
    this.close();
    eventBus.emit('ui:perk_draft_completed');
  }

  public close(): void {
    audioManager.setFilterMuffled(false);
    this.container.classList.remove('active');
  }
}
