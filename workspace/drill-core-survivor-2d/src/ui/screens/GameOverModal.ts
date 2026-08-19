import { gameState } from '../../core/GameState';
import { Localization } from '../../core/Localization';
import { playgamaService } from '../../platform/PlaygamaService';
import { eventBus } from '../../core/EventBus';

export class GameOverModal {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'modal-overlay interactive';
    this.container.id = 'game-over-modal';
    parent.appendChild(this.container);
  }

  public open(): void {
    const stats = gameState.runStats;
    const isNewRecord = stats.depth > gameState.saveData.maxDepthRecord;
    if (isNewRecord) {
      gameState.saveData.maxDepthRecord = Math.floor(stats.depth);
      playgamaService.submitScore('maxdepthleaderboard', stats.depth);
    }

    const canRevive = !gameState.hasUsedReviveThisRun && stats.depth >= 100 && playgamaService.isRewardedSupported();
    const canDouble = stats.crystalsEarned > 0 && playgamaService.isRewardedSupported();

    this.container.innerHTML = `
      <div class="modal-card" style="text-align: center; gap: 16px;">
        <div>
          <div style="font-size: 36px; margin-bottom: 4px;">💥</div>
          <h2 style="font-size: 22px; color: var(--accent-tnt); font-weight: 900;">
            ${Localization.t('gameOverTitle')}
          </h2>
          ${isNewRecord ? `<div style="font-size: 13px; color: var(--accent-gold); font-weight: 800; margin-top: 4px;">🏆 NEW RECORD!</div>` : ''}
        </div>

        <div style="background: #101626; border-radius: 12px; padding: 14px; border: 1px solid var(--border-steel); display: flex; flex-direction: column; gap: 8px; text-align: left; font-size: 13px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">${Localization.t('runStatsDepth')}</span>
            <strong style="color: var(--accent-cyan); font-size: 15px;">${Math.floor(stats.depth)} m</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">${Localization.t('runStatsKills')}</span>
            <strong>${stats.enemiesKilled}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">${Localization.t('runStatsBlocks')}</span>
            <strong>${stats.blocksDestroyed}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">${Localization.t('runStatsCrystals')}</span>
            <strong style="color: var(--accent-gold); font-size: 15px;">+${stats.crystalsEarned} 💎</strong>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${
            canRevive
              ? `<button class="btn-main" id="btn-run-revive" style="background: linear-gradient(180deg, #ff4200 0%, #a31500 100%); border-color: #ff8040; font-size: 14px;">
                  ⚡ ${Localization.t('reviveBtn')}
                </button>`
              : ''
          }

          ${
            canDouble
              ? `<button class="btn-secondary" id="btn-double-crystals" style="border-color: var(--accent-gold); color: #fff; font-size: 13px;">
                  ✨ ${Localization.t('doubleCrystalsBtn')}
                </button>`
              : ''
          }

          <button class="btn-main" id="btn-return-hangar" style="font-size: 16px;">
            🏠 ${Localization.t('exitToMenuBtn')}
          </button>
        </div>
      </div>
    `;

    this.attachEvents();
    this.container.classList.add('active');
  }

  private attachEvents(): void {
    document.getElementById('btn-run-revive')?.addEventListener('click', async () => {
      const rewarded = await playgamaService.showRewarded('revive_run');
      if (rewarded) {
        gameState.hasUsedReviveThisRun = true;
        this.close();
        eventBus.emit('ui:revive_game');
      }
    });

    document.getElementById('btn-double-crystals')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-double-crystals');
      const rewarded = await playgamaService.showRewarded('double_gold');
      if (rewarded && btn) {
        const bonus = gameState.runStats.crystalsEarned;
        gameState.addCrystals(bonus);
        btn.textContent = '✅ DOUBLED!';
        (btn as HTMLButtonElement).disabled = true;
      }
    });

    document.getElementById('btn-return-hangar')?.addEventListener('click', async () => {
      this.close();
      // Interstitial on leaving to menu
      await playgamaService.showInterstitial('return_hangar');
      eventBus.emit('ui:exit_to_hangar');
    });
  }

  public close(): void {
    this.container.classList.remove('active');
  }
}
