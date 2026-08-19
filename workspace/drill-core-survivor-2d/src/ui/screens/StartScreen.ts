import { gameState } from '../../core/GameState';
import { Localization } from '../../core/Localization';
import { playgamaService } from '../../platform/PlaygamaService';
import { eventBus } from '../../core/EventBus';

export class StartScreen {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'modal-overlay interactive active';
    this.container.id = 'start-screen';
    parent.appendChild(this.container);
    this.render();
  }

  public render(): void {
    const isRewarded = playgamaService.isRewardedSupported();
    const canClaimStarterPerk = Date.now() - gameState.saveData.starterPerkLastClaimTime >= 600_000; // 10 min

    this.container.innerHTML = `
      <div class="modal-card" style="text-align: center; gap: 20px;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: var(--accent-cyan); letter-spacing: 2px; text-transform: uppercase;">
            Sci-Fi Roguelike Miner
          </div>
          <h1 style="font-size: 24px; font-weight: 900; color: #fff; margin-top: 4px; line-height: 1.2; text-shadow: 0 0 15px rgba(240, 196, 48, 0.4);">
            ${Localization.t('gameTitle')}
          </h1>
        </div>

        <div style="display: flex; justify-content: space-around; background: #101626; padding: 12px; border-radius: 10px; border: 1px solid var(--border-steel);">
          <div>
            <div style="font-size: 11px; color: var(--text-muted);">${Localization.t('recordLabel')}</div>
            <div style="font-size: 20px; font-weight: 800; color: var(--accent-cyan);">${gameState.saveData.maxDepthRecord} m</div>
          </div>
          <div style="width: 1px; background: var(--border-steel);"></div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted);">${Localization.t('crystalsLabel')}</div>
            <div style="font-size: 20px; font-weight: 800; color: var(--accent-gold);">${gameState.saveData.totalCrystals} 💎</div>
          </div>
        </div>

        <button class="btn-main" id="btn-start-run" style="font-size: 20px; padding: 16px;">
          🚀 ${Localization.t('playBtn')}
        </button>

        <div style="display: flex; gap: 10px; flex-direction: column;">
          <button class="btn-secondary" id="btn-open-hangar" style="font-size: 15px; padding: 12px;">
            🛠️ ${Localization.t('hangarBtn')}
          </button>

          ${
            isRewarded
              ? `<button class="btn-secondary" id="btn-starter-perk" style="border-color: var(--accent-cyan); font-size: 13px;">
                  📦 ${Localization.t('starterPerkBtn')} ${canClaimStarterPerk ? '✨' : '⏳'}
                </button>`
              : ''
          }

          <div style="display: flex; gap: 10px;">
            <button class="btn-secondary" id="btn-open-leaderboard" style="flex: 1;">
              🏆 ${Localization.t('leaderboardBtn')}
            </button>
            <button class="btn-secondary" id="btn-open-settings" style="flex: 1;">
              ⚙️ ${Localization.t('settingsBtn')}
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    document.getElementById('btn-start-run')?.addEventListener('click', () => {
      eventBus.emit('ui:start_game');
    });

    document.getElementById('btn-open-hangar')?.addEventListener('click', () => {
      eventBus.emit('ui:open_hangar');
    });

    document.getElementById('btn-open-leaderboard')?.addEventListener('click', () => {
      eventBus.emit('ui:open_leaderboard');
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      eventBus.emit('ui:open_settings');
    });

    document.getElementById('btn-starter-perk')?.addEventListener('click', async () => {
      const rewarded = await playgamaService.showRewarded('starter_perk');
      if (rewarded) {
        gameState.saveData.starterPerkLastClaimTime = Date.now();
        gameState.saveData.totalCrystals += 50;
        eventBus.emit('ui:start_game_with_perk');
      }
    });
  }

  public show(): void {
    this.render();
    this.container.classList.add('active');
  }

  public hide(): void {
    this.container.classList.remove('active');
  }
}
