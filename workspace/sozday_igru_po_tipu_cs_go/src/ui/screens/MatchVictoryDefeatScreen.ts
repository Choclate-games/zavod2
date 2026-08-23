import { ICONS } from '../icons';
import { PlaygamaService } from '../../platform/PlaygamaService';
import { AudioManager } from '../../audio/AudioManager';
import { StorageService } from '../../platform/StorageService';
import { EventBus } from '../../core/EventBus';

export class MatchVictoryDefeatScreen {
  public root: HTMLElement;
  private bannerEl: HTMLElement;
  private scoreEl: HTMLElement;
  private eloChangeEl: HTMLElement;
  private doubleRewardBtn: HTMLElement;
  private rewardClaimed = false;

  constructor(
    private onRematchClick: () => void,
    private onMenuClick: () => void
  ) {
    this.root = document.createElement('div');
    this.root.className = 'screen-root';

    // Zone 1: Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.style.justifyContent = 'center';

    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'cyber-panel';
    this.bannerEl.innerHTML = `<h1 style="font-family: var(--font-display); font-size: clamp(26px, 4.5vw, 44px); font-weight: 800; text-transform: uppercase;">ПОБЕДА В МАТЧЕ!</h1>`;
    header.appendChild(this.bannerEl);
    this.root.appendChild(header);

    // Zone 2: Content
    const content = document.createElement('div');
    content.className = 'zone-content';

    const card = document.createElement('div');
    card.className = 'cyber-panel';
    card.style.textAlign = 'center';
    card.style.minWidth = '280px';

    this.scoreEl = document.createElement('div');
    this.scoreEl.className = 'tabular-nums';
    this.scoreEl.style.fontFamily = 'var(--font-display)';
    this.scoreEl.style.fontSize = '34px';
    this.scoreEl.style.fontWeight = '700';
    this.scoreEl.textContent = '3 : 1';
    card.appendChild(this.scoreEl);

    this.eloChangeEl = document.createElement('div');
    this.eloChangeEl.className = 'tabular-nums';
    this.eloChangeEl.style.fontFamily = 'var(--font-display)';
    this.eloChangeEl.style.fontSize = '22px';
    this.eloChangeEl.style.marginTop = '8px';
    card.appendChild(this.eloChangeEl);

    content.appendChild(card);
    this.root.appendChild(content);

    // Zone 3: Actions
    const actions = document.createElement('div');
    actions.className = 'zone-actions';
    actions.style.flexDirection = 'column';
    actions.style.gap = 'var(--space-3)';

    const rematchBtn = document.createElement('button');
    rematchBtn.className = 'btn-primary';
    rematchBtn.innerHTML = `${ICONS.play} <span>РЕВАНШ</span>`;
    rematchBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onRematchClick();
    });
    actions.appendChild(rematchBtn);

    const subRow = document.createElement('div');
    subRow.style.display = 'flex';
    subRow.style.gap = 'var(--space-3)';
    subRow.style.pointerEvents = 'none';

    this.doubleRewardBtn = document.createElement('button');
    this.doubleRewardBtn.className = 'btn-secondary';
    this.doubleRewardBtn.innerHTML = `${ICONS.video} <span>УДВОИТЬ НАГРАДУ x2</span>`;
    this.doubleRewardBtn.addEventListener('click', () => {
      if (this.rewardClaimed) return;
      PlaygamaService.get().showRewarded('double_victory_reward', (amount) => {
        this.rewardClaimed = true;
        this.doubleRewardBtn.style.display = 'none';
        const cur = StorageService.get().getData();
        StorageService.get().updateData({ coins: cur.coins + amount });
      });
    });
    subRow.appendChild(this.doubleRewardBtn);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'btn-secondary';
    menuBtn.innerHTML = `${ICONS.close} <span>В МЕНЮ</span>`;
    menuBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onMenuClick();
    });
    subRow.appendChild(menuBtn);

    actions.appendChild(subRow);
    this.root.appendChild(actions);

    this.setupListeners();
  }

  private setupListeners(): void {
    EventBus.get().on('MATCH_ENDED', (data: { winner: 'player' | 'bot'; playerScore: number; botScore: number; eloChange: number }) => {
      this.rewardClaimed = false;
      this.doubleRewardBtn.style.display = data.winner === 'player' ? 'inline-flex' : 'none';

      if (data.winner === 'player') {
        this.bannerEl.innerHTML = `<h1 style="font-family: var(--font-display); font-size: clamp(26px, 4.5vw, 44px); font-weight: 800; color: var(--color-highlight); text-transform: uppercase;">ТРИУМФ! ПОБЕДА В МАТЧЕ</h1>`;
        this.eloChangeEl.style.color = 'var(--color-success-headshot)';
        this.eloChangeEl.textContent = `РЕЙТИНГ: +${data.eloChange} ELO`;
      } else {
        this.bannerEl.innerHTML = `<h1 style="font-family: var(--font-display); font-size: clamp(26px, 4.5vw, 44px); font-weight: 800; color: var(--color-critical-alert); text-transform: uppercase;">ПОРАЖЕНИЕ В МАТЧЕ</h1>`;
        this.eloChangeEl.style.color = 'var(--color-critical-alert)';
        this.eloChangeEl.textContent = `РЕЙТИНГ: ${data.eloChange} ELO`;
      }

      this.scoreEl.textContent = `ИТОГОВЫЙ СЧЕТ: ${data.playerScore} - ${data.botScore}`;
    });
  }
}