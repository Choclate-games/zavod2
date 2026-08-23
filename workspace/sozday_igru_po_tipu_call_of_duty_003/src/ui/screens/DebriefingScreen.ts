import { I18nService } from '../i18n';
import { BridgeService } from '../../platform/BridgeService';
import { SaveService } from '../../platform/SaveService';

export class DebriefingScreen {
  public root: HTMLDivElement;
  public onNextClick?: () => void;
  public onRetryClick?: () => void;
  public isVictory = true;
  public rewardCredits = 1500;
  public headshots = 0;
  public accidents = 0;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'debriefing_win';
    this.root.className = 'screen-container';
    this.render();
  }

  public setResults(isVictory: boolean, credits: number, headshots: number, accidents: number): void {
    this.isVictory = isVictory;
    this.rewardCredits = credits;
    this.headshots = headshots;
    this.accidents = accidents;
    this.render();
  }

  public render(): void {
    const isRewardedAvailable = BridgeService.isRewardedSupported;
    const title = this.isVictory ? I18nService.t('contract_complete') : I18nService.t('mission_failed');
    const titleColor = this.isVictory ? 'var(--color-success)' : 'var(--color-danger)';

    this.root.innerHTML = `
      <header class="screen-header">
        <h2 style="font-size: 20px; font-weight: 700; color: ${titleColor};">${title}</h2>
        <div class="tabular-nums" style="font-size: 16px; color: var(--color-amber);">
          ${this.isVictory ? `+${this.rewardCredits} КРЕДИТОВ` : '0 КРЕДИТОВ'}
        </div>
      </header>

      <main class="screen-content">
        <div class="tactical-card" style="flex: 1; max-width: 500px;">
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--color-border);">
            <span style="color: var(--color-text);">${I18nService.t('headshots')}</span>
            <span class="tabular-nums" style="font-weight: 700; color: var(--color-accent);">${this.headshots}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--color-border);">
            <span style="color: var(--color-text);">${I18nService.t('accidents')}</span>
            <span class="tabular-nums" style="font-weight: 700; color: var(--color-amber);">${this.accidents}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0;">
            <span style="color: var(--color-text);">${I18nService.t('bounty')}</span>
            <span class="tabular-nums" style="font-weight: 700; color: var(--color-success);">${this.isVictory ? this.rewardCredits : 0}</span>
          </div>
        </div>
      </main>

      <footer class="screen-actions">
        ${
          this.isVictory && isRewardedAvailable
            ? `<button id="btn-double-reward" class="btn btn-amber">${I18nService.t('double_reward')}</button>`
            : ''
        }
        <button id="btn-debrief-action" class="btn btn-primary">
          ${this.isVictory ? I18nService.t('next_contract') : I18nService.t('retry')}
        </button>
      </footer>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const actionBtn = this.root.querySelector('#btn-debrief-action');
    const doubleBtn = this.root.querySelector('#btn-double-reward');

    actionBtn?.addEventListener('click', () => {
      if (this.isVictory) {
        this.onNextClick?.();
      } else {
        this.onRetryClick?.();
      }
    });

    doubleBtn?.addEventListener('click', async () => {
      const rewarded = await BridgeService.showRewarded('double_bounty');
      if (rewarded) {
        SaveService.addCredits(this.rewardCredits);
        this.rewardCredits *= 2;
        this.render();
      }
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
