import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { MatchStats } from '../../systems/MatchFlowVictoryResolutionSystem';
import { playgamaService } from '../../platform/PlaygamaService';
import { StorageService } from '../../platform/StorageService';
import { eventBus } from '../../core/EventBus';

export class VictoryDefeatScreen {
  public element: HTMLDivElement;

  private titleEl: HTMLElement;
  private statsEl: HTMLElement;
  private doubleRewardBtn: Button;
  private currentScore: number = 0;
  private isDoubled: boolean = false;

  constructor(onNextMatch: () => void) {
    this.element = document.createElement('div');
    this.element.id = 'screen-victory-defeat';
    this.element.className = 'screen hidden';

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.style.maxWidth = '460px';
    panel.style.margin = 'auto';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '14px';

    this.titleEl = document.createElement('h1');
    this.titleEl.style.textAlign = 'center';
    this.titleEl.style.fontSize = 'clamp(24px, calc(32px * var(--ui-scale)), 38px)';
    panel.appendChild(this.titleEl);

    this.statsEl = document.createElement('div');
    this.statsEl.className = 'tabular-numbers';
    this.statsEl.style.lineHeight = '1.8';
    this.statsEl.style.fontSize = '16px';
    this.statsEl.style.color = 'var(--color-text-muted)';
    panel.appendChild(this.statsEl);

    // Double Rewards button (Rewarded Ad)
    this.doubleRewardBtn = new Button({
      text: 'УДВОИТЬ НАГРАДУ (X2)',
      variant: 'success',
      icon: ICONS.uav,
      onClick: async () => {
        if (this.isDoubled) return;
        const rewarded = await playgamaService.showRewardedAd('double_match_rewards');
        if (rewarded) {
          this.isDoubled = true;
          this.currentScore *= 2;
          this.statsEl.innerHTML += `<div style="color: var(--color-success); font-weight: bold;">НАГРАДА УДВОЕНА: +${this.currentScore} ЖЕТОНОВ!</div>`;
          this.doubleRewardBtn.element.style.display = 'none';

          // Update storage
          const data = StorageService.getData();
          StorageService.saveLocal({
            tokens: data.tokens + this.currentScore
          });
          eventBus.emit('REWARD_DOUBLE_CLAIMED', true);
        }
      }
    });
    panel.appendChild(this.doubleRewardBtn.element);

    // Next match button
    const nextBtn = new Button({
      text: 'СЛЕДУЮЩИЙ МАТЧ',
      variant: 'primary',
      icon: ICONS.play,
      onClick: () => {
        onNextMatch();
      }
    });
    panel.appendChild(nextBtn.element);

    this.element.appendChild(panel);
  }

  public setResults(stats: MatchStats): void {
    this.currentScore = stats.score;
    this.isDoubled = false;
    this.doubleRewardBtn.element.style.display = 'flex';

    if (stats.isVictory) {
      this.titleEl.textContent = 'ТРИУМФ: ПОБЕДА!';
      this.titleEl.style.color = 'var(--color-gold)';
    } else {
      this.titleEl.textContent = 'МАТЧ ЗАВЕРШЕН';
      this.titleEl.style.color = 'var(--color-danger)';
    }

    this.statsEl.innerHTML = `
      <div>ВРЕМЯ БОЯ: <b>${stats.elapsedTime} с</b></div>
      <div>СОВЕРШЕНО ФРАГОВ: <b>${stats.playerFrags} / 12</b></div>
      <div>ПОПАДАНИЙ В ГОЛОВУ: <b>${stats.headshots}</b></div>
      <div>СЕРИЙ КИЛЛСТРИКА: <b>${stats.killstreaks}</b></div>
      <div style="font-size: 20px; color: var(--color-primary); margin-top: 6px;">ИТОГОВЫЙ СЧЕТ: <b>${stats.score}</b></div>
    `;

    // Persist stats
    const cur = StorageService.getData();
    StorageService.saveLocal({
      totalFrags: cur.totalFrags + stats.playerFrags,
      totalWins: stats.isVictory ? cur.totalWins + 1 : cur.totalWins,
      totalMatches: cur.totalMatches + 1,
      tokens: cur.tokens + stats.score,
      rank: stats.isVictory ? cur.rank + 1 : cur.rank
    });
  }

  public show(): void {
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }
}