import { I18nService } from '../i18n';
import { CONTRACTS } from '../../game/ContractManager';
import { SaveService } from '../../platform/SaveService';

export class BriefingScreen {
  public root: HTMLDivElement;
  public onStartClick?: () => void;
  public onArsenalClick?: () => void;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'briefing_screen';
    this.root.className = 'screen-container';
    this.render();
  }

  public render(): void {
    const saveData = SaveService.getData();
    const contract = CONTRACTS[0];

    this.root.innerHTML = `
      <header class="screen-header">
        <div>
          <h2 style="font-size: 20px; font-weight: 700; color: var(--color-accent);">${I18nService.t('game_title')}</h2>
          <div style="font-size: 13px; color: var(--color-text-muted);">
            ШТАБ ССО // СЕКТОР: ${contract.location}
          </div>
        </div>
        <div class="tabular-nums" style="font-size: 16px; color: var(--color-amber);">
          КРЕДИТЫ: ${saveData.credits}
        </div>
      </header>

      <main class="screen-content">
        <div class="tactical-card" style="flex: 1; max-width: 550px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">
            <span style="color: var(--color-accent); font-weight: 700;">${contract.title}</span>
            <span class="tabular-nums" style="color: var(--color-text-muted);">${contract.timeLimitSeconds}с</span>
          </div>
          <p style="font-size: 14px; line-height: 1.5; color: var(--color-text);">${contract.description}</p>
          <div style="display: flex; gap: 16px; margin-top: 8px;">
            <div class="tabular-nums" style="font-size: 13px;">ЦЕЛИ: <span style="color: var(--color-danger); font-weight: 700;">${contract.targetCount} VIP</span></div>
            <div class="tabular-nums" style="font-size: 13px;">БОЕКОМПЛЕКТ: <span style="color: var(--color-text); font-weight: 700;">${contract.ammoCount}</span></div>
            <div class="tabular-nums" style="font-size: 13px;">БОНУС: <span style="color: var(--color-success); font-weight: 700;">+${contract.baseReward}</span></div>
          </div>
        </div>
      </main>

      <footer class="screen-actions">
        <button id="btn-open-arsenal" class="btn">
          ${I18nService.t('arsenal')}
        </button>
        <button id="btn-start-contract" class="btn btn-primary">
          ${I18nService.t('start_contract')}
        </button>
      </footer>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const startBtn = this.root.querySelector('#btn-start-contract');
    const arsenalBtn = this.root.querySelector('#btn-open-arsenal');

    startBtn?.addEventListener('click', () => {
      this.onStartClick?.();
    });

    arsenalBtn?.addEventListener('click', () => {
      this.onArsenalClick?.();
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
