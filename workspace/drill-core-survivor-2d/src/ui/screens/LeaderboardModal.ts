import { gameState } from '../../core/GameState';
import { Localization } from '../../core/Localization';

export class LeaderboardModal {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'modal-overlay interactive';
    this.container.id = 'leaderboard-modal';
    parent.appendChild(this.container);
  }

  public open(): void {
    this.render();
    this.container.classList.add('active');
  }

  private render(): void {
    const record = gameState.saveData.maxDepthRecord;

    this.container.innerHTML = `
      <div class="modal-card" style="gap: 16px; text-align: center;">
        <h2 style="font-size: 20px; color: #fff; font-weight: 900;">
          🏆 ${Localization.t('leaderboardBtn')}
        </h2>

        <div style="background: #111728; border: 1px solid var(--border-steel); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-muted); border-bottom: 1px solid var(--border-steel); padding-bottom: 6px;">
            <span>PILOT / RANK</span>
            <span>MAX DEPTH</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; color: var(--accent-gold); padding: 4px 0;">
            <span>🥇 1. CoreDriller_X</span>
            <span>2,840 m</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; color: #cbd5e1; padding: 4px 0;">
            <span>🥈 2. TitanMech_99</span>
            <span>1,920 m</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; color: #f97316; padding: 4px 0;">
            <span>🥉 3. DeepMiner_Ru</span>
            <span>1,450 m</span>
          </div>

          <div style="height: 1px; background: var(--border-steel); margin: 6px 0;"></div>

          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; color: var(--accent-cyan); padding: 4px 0; background: rgba(0, 240, 255, 0.1); border-radius: 6px; padding: 6px 8px;">
            <span>⭐ YOU (Pilot)</span>
            <span>${record} m</span>
          </div>
        </div>

        <button class="btn-secondary" id="btn-close-leaderboard" style="padding: 12px;">
          ${Localization.t('closeBtn')}
        </button>
      </div>
    `;

    document.getElementById('btn-close-leaderboard')?.addEventListener('click', () => {
      this.close();
    });
  }

  public close(): void {
    this.container.classList.remove('active');
  }
}
