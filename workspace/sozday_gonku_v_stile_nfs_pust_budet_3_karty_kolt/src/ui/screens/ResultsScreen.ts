import { BaseScreen } from '../ScreenRouter';
import { playgama } from '../../platform/PlaygamaService';
import { ICONS } from '../icons';

export class ResultsScreen implements BaseScreen {
  readonly root: HTMLElement;

  private titleLabel!: HTMLElement;
  private posLabel!: HTMLElement;
  private timeLabel!: HTMLElement;
  private driftLabel!: HTMLElement;
  private creditsLabel!: HTMLElement;
  private doubleBtn!: HTMLButtonElement;

  private earnedCredits = 0;
  private isRewardedClaimed = false;

  private onGarageCallback: () => void;

  constructor(onGarage: () => void) {
    this.onGarageCallback = onGarage;

    this.root = document.createElement('div');
    this.root.className = 'screen screen-results';
    this.root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
      padding: calc(var(--space-4) * var(--ui-scale));
    `;

    this.buildMarkup();
  }

  private buildMarkup(): void {
    const card = document.createElement('div');
    card.className = 'glass-panel cyber-cut';
    card.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: calc(var(--space-4) * var(--ui-scale));
      padding: calc(var(--space-6) * var(--ui-scale));
      min-width: calc(340px * var(--ui-scale));
      max-width: calc(440px * var(--ui-scale));
    `;

    this.titleLabel = document.createElement('div');
    this.titleLabel.style.cssText = `
      font-family: var(--font-display);
      font-size: calc(24px * var(--ui-scale));
      font-weight: 900;
      color: var(--color-primary);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    `;
    this.titleLabel.textContent = 'РЕЗУЛЬТАТЫ ЗАЕЗДА';

    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: calc(var(--space-2) * var(--ui-scale));
      width: 100%;
      font-family: var(--font-display);
      font-size: calc(14px * var(--ui-scale));
      border-top: 1px solid var(--color-panel-border);
      border-bottom: 1px solid var(--color-panel-border);
      padding: calc(var(--space-3) * var(--ui-scale)) 0;
    `;

    this.posLabel = document.createElement('div');
    this.posLabel.style.cssText = `display: flex; justify-content: space-between; font-variant-numeric: tabular-nums;`;

    this.timeLabel = document.createElement('div');
    this.timeLabel.style.cssText = `display: flex; justify-content: space-between; font-variant-numeric: tabular-nums;`;

    this.driftLabel = document.createElement('div');
    this.driftLabel.style.cssText = `display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; color: var(--color-drift);`;

    this.creditsLabel = document.createElement('div');
    this.creditsLabel.style.cssText = `display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; color: var(--color-primary); font-weight: 800;`;

    statsGrid.appendChild(this.posLabel);
    statsGrid.appendChild(this.timeLabel);
    statsGrid.appendChild(this.driftLabel);
    statsGrid.appendChild(this.creditsLabel);

    // Rewarded x2 button
    this.doubleBtn = document.createElement('button');
    this.doubleBtn.className = 'btn btn-nitro cyber-cut';
    this.doubleBtn.innerHTML = `${ICONS.video} УДВОИТЬ НАГРАДУ (x2)`;
    this.doubleBtn.style.cssText = `
      width: 100%;
      min-height: 64px;
      font-size: calc(14px * var(--ui-scale));
    `;

    this.doubleBtn.addEventListener('click', async () => {
      if (this.isRewardedClaimed) return;
      this.doubleBtn.disabled = true;

      const success = await playgama.showRewarded('double_rewards');
      if (success) {
        this.isRewardedClaimed = true;
        const prof = playgama.getProfile();
        prof.credits += this.earnedCredits;
        playgama.saveDebounced();
        this.creditsLabel.innerHTML = `<span>КРЕДИТЫ (x2):</span> <span>+${(this.earnedCredits * 2).toLocaleString()} КР</span>`;
        this.doubleBtn.innerHTML = `${ICONS.check} НАГРАДА УДВОЕНА!`;
      } else {
        this.doubleBtn.disabled = false;
      }
    });

    // Primary Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-primary cyber-cut';
    nextBtn.innerHTML = `${ICONS.garage} В ГАРАЖ / СЛЕДУЮЩИЙ ЗАЕЗД`;
    nextBtn.style.cssText = `
      width: 100%;
      min-height: 96px;
      font-size: calc(16px * var(--ui-scale));
    `;
    nextBtn.addEventListener('click', () => {
      playgama.flushInterstitial();
      this.onGarageCallback();
    });

    card.appendChild(this.titleLabel);
    card.appendChild(statsGrid);
    card.appendChild(this.doubleBtn);
    card.appendChild(nextBtn);

    this.root.appendChild(card);
  }

  setResults(position: number, timeSec: number, driftScore: number, credits: number, isWin: boolean): void {
    this.earnedCredits = credits;
    this.isRewardedClaimed = false;
    this.doubleBtn.disabled = false;
    this.doubleBtn.innerHTML = `${ICONS.video} УДВОИТЬ НАГРАДУ (x2)`;

    const suffix = position === 1 ? 'ST' : position === 2 ? 'ND' : position === 3 ? 'RD' : 'TH';
    this.posLabel.innerHTML = `<span>ПОЗИЦИЯ:</span> <span>${position}${suffix} / 4</span>`;

    const mins = Math.floor(timeSec / 60);
    const secs = (timeSec % 60).toFixed(2);
    this.timeLabel.innerHTML = `<span>ВРЕМЯ:</span> <span>${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}</span>`;

    this.driftLabel.innerHTML = `<span>ОЧКИ ДРИФТА:</span> <span>${driftScore.toLocaleString()} PTS</span>`;
    this.creditsLabel.innerHTML = `<span>КРЕДИТЫ:</span> <span>+${credits.toLocaleString()} КР</span>`;

    this.titleLabel.textContent = isWin ? 'ПОБЕДА В ЗАЕЗДЕ!' : 'ФИНИШ ЗАЕЗДА';
    this.titleLabel.style.color = isWin ? 'var(--color-primary)' : 'var(--color-danger)';

    playgama.armInterstitial('race_finished');
  }

  show(): void {}
  hide(): void {}
}
