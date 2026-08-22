import { BaseScreen } from '../ScreenRouter';
import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { events, GameEvents } from '../../core/EventBus';
import { platform } from '../../platform/PlaygamaService';
import { ui } from '../UiRoot';

export class MatchResultScreen implements BaseScreen {
  public readonly element: HTMLElement;
  private matchTitle!: HTMLElement;
  private scoreBanner!: HTMLElement;
  private eloChangeText!: HTMLElement;
  private statsTable!: HTMLElement;
  private doubleEloBtn: Button | null = null;
  private lastMatchData: GameEvents['MATCH_END'] | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'screen';
    this.element.id = 'screen-match-result';

    this.buildMarkup();
    ui.screenLayer.appendChild(this.element);

    events.on('MATCH_END', (data) => this.update(data));
  }

  private buildMarkup(): void {
    // Zone 1: Identity
    const zoneIdentity = document.createElement('div');
    zoneIdentity.className = 'zone-identity';
    zoneIdentity.style.alignItems = 'center';

    this.matchTitle = document.createElement('h1');
    this.matchTitle.className = 'game-title';
    this.matchTitle.style.fontSize = '2.4rem';
    this.matchTitle.textContent = 'ПОБЕДА В МАТЧЕ';

    this.scoreBanner = document.createElement('div');
    this.scoreBanner.className = 'num-slot';
    this.scoreBanner.style.fontSize = '3.0rem';
    this.scoreBanner.style.color = 'var(--color-primary-action)';
    this.scoreBanner.textContent = '3 : 1';

    this.eloChangeText = document.createElement('div');
    this.eloChangeText.style.cssText = 'font-weight:700;font-size:1.2rem;color:var(--color-success-green);margin-top:4px;';
    this.eloChangeText.textContent = '+25 ELO (Текущий: 1025)';

    zoneIdentity.appendChild(this.matchTitle);
    zoneIdentity.appendChild(this.scoreBanner);
    zoneIdentity.appendChild(this.eloChangeText);
    this.element.appendChild(zoneIdentity);

    // Zone 2: Primary Action
    const zonePrimary = document.createElement('div');
    zonePrimary.className = 'zone-primary';

    const nextMatchBtn = new Button({
      label: 'СЛЕДУЮЩИЙ МАТЧ',
      variant: 'primary',
      icon: ICONS.PLAY,
      onClick: () => {
        void platform.showInterstitial();
        events.emit('NAVIGATE_SCREEN', 'GameplayHUD');
        events.emit('GAME_STATE_CHANGED', 'PLAYING');
      },
    });
    zonePrimary.appendChild(nextMatchBtn.element);

    if (platform.isRewardedSupported()) {
      this.doubleEloBtn = new Button({
        label: 'УДВОИТЬ ELO ЗА РЕКЛАМУ',
        variant: 'default',
        icon: ICONS.REWARD,
        onClick: () => {
          if (!this.lastMatchData) return;
          void platform.showRewarded('elo_double', () => {
            if (this.lastMatchData) {
              const bonus = Math.abs(this.lastMatchData.eloDelta);
              this.eloChangeText.textContent = `+${this.lastMatchData.eloDelta + bonus} ELO (Удвоено!)`;
              if (this.doubleEloBtn) {
                this.doubleEloBtn.setDisabled(true);
              }
            }
          });
        },
      });
      zonePrimary.appendChild(this.doubleEloBtn.element);
    }

    this.element.appendChild(zonePrimary);

    // Zone 3: Secondary Row
    const zoneSecondary = document.createElement('div');
    zoneSecondary.className = 'zone-secondary';

    this.statsTable = document.createElement('div');
    this.statsTable.className = 'card-panel';
    this.statsTable.style.cssText = 'display:flex;gap:24px;align-items:center;';
    this.statsTable.innerHTML = `
      <div><strong>Убийства:</strong> <span class="num-slot" id="stat-kills">0</span></div>
      <div><strong>Смерти:</strong> <span class="num-slot" id="stat-deaths">0</span></div>
      <div><strong>Хэдшоты:</strong> <span class="num-slot" id="stat-hs">0</span></div>
      <div><strong>HS%:</strong> <span class="num-slot" id="stat-hs-pct">0%</span></div>
    `;
    zoneSecondary.appendChild(this.statsTable);

    const menuBtn = new Button({
      label: 'В ГЛАВНОЕ МЕНЮ',
      icon: ICONS.BACK,
      onClick: () => {
        void platform.showInterstitial();
        events.emit('NAVIGATE_SCREEN', 'MainMenu');
        events.emit('GAME_STATE_CHANGED', 'MENU');
      },
    });
    zoneSecondary.appendChild(menuBtn.element);

    this.element.appendChild(zoneSecondary);
  }

  public update(data: GameEvents['MATCH_END']): void {
    this.lastMatchData = data;
    this.matchTitle.textContent = data.playerWon ? 'ПОБЕДА В МАТЧЕ' : 'ПОРАЖЕНИЕ В МАТЧЕ';
    this.matchTitle.style.color = data.playerWon ? 'var(--color-success-green)' : 'var(--color-c4-danger)';
    this.scoreBanner.textContent = `${data.scoreCT} : ${data.scoreT}`;

    const sign = data.eloDelta >= 0 ? '+' : '';
    this.eloChangeText.textContent = `${sign}${data.eloDelta} ELO (Ранг: ${data.rankName}, Всего: ${data.newElo})`;
    this.eloChangeText.style.color = data.eloDelta >= 0 ? 'var(--color-success-green)' : 'var(--color-c4-danger)';

    const killsEl = this.statsTable.querySelector('#stat-kills');
    const deathsEl = this.statsTable.querySelector('#stat-deaths');
    const hsEl = this.statsTable.querySelector('#stat-hs');
    const hsPctEl = this.statsTable.querySelector('#stat-hs-pct');

    if (killsEl) killsEl.textContent = data.kills.toString();
    if (deathsEl) deathsEl.textContent = data.deaths.toString();
    if (hsEl) hsEl.textContent = data.headshots.toString();
    if (hsPctEl) hsPctEl.textContent = `${data.headshotPercent}%`;

    if (this.doubleEloBtn) {
      this.doubleEloBtn.setDisabled(!data.playerWon);
    }
  }

  public show(): void {
    this.element.classList.add('active');
  }

  public hide(): void {
    this.element.classList.remove('active');
  }
}
