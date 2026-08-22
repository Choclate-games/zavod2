import { BaseScreen } from '../ScreenRouter';
import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { events } from '../../core/EventBus';
import { storage } from '../../platform/StorageService';
import { ui } from '../UiRoot';

export class MainMenuScreen implements BaseScreen {
  public readonly element: HTMLElement;
  private selectedTeam: 'CT' | 'T' = 'CT';
  private eloText!: HTMLElement;
  private rankText!: HTMLElement;
  private ctBtn!: Button;
  private tBtn!: Button;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'screen';
    this.element.id = 'screen-main-menu';

    this.buildMarkup();
    ui.screenLayer.appendChild(this.element);
  }

  private buildMarkup(): void {
    // Zone 1: Identity
    const zoneIdentity = document.createElement('div');
    zoneIdentity.className = 'zone-identity';

    const title = document.createElement('h1');
    title.className = 'game-title';
    title.textContent = 'DUST 2: РЕТЕЙК И ДУЭЛИ';

    const subtitle = document.createElement('div');
    subtitle.className = 'game-subtitle';
    subtitle.textContent = 'ТАКТИЧЕСКИЙ FPS 3v3 • БОРЬБА ЗА ТОЧКИ A И B';

    const profileCard = document.createElement('div');
    profileCard.className = 'card-panel';
    profileCard.style.cssText = 'display:inline-flex;align-items:center;gap:16px;margin-top:8px;padding:8px 16px;width:fit-content;';

    const rankBadge = document.createElement('span');
    rankBadge.innerHTML = ICONS.TROPHY;
    rankBadge.style.color = 'var(--color-primary-action)';

    const eloInfo = document.createElement('div');
    this.rankText = document.createElement('div');
    this.rankText.style.cssText = 'font-weight:700;font-size:1.1rem;text-transform:uppercase;color:var(--color-text-primary);';
    this.rankText.textContent = 'GOLD NOVA III';

    this.eloText = document.createElement('div');
    this.eloText.className = 'num-slot';
    this.eloText.style.cssText = 'font-size:0.9rem;color:var(--color-text-muted);';
    this.eloText.textContent = '1000 ELO';

    eloInfo.appendChild(this.rankText);
    eloInfo.appendChild(this.eloText);

    profileCard.appendChild(rankBadge);
    profileCard.appendChild(eloInfo);

    zoneIdentity.appendChild(title);
    zoneIdentity.appendChild(subtitle);
    zoneIdentity.appendChild(profileCard);
    this.element.appendChild(zoneIdentity);

    // Zone 2: Primary Action
    const zonePrimary = document.createElement('div');
    zonePrimary.className = 'zone-primary';

    const playBtn = new Button({
      label: 'В БОЙ (РЕТЕЙК 3v3)',
      variant: 'primary',
      icon: ICONS.PLAY,
      onClick: () => {
        events.emit('NAVIGATE_SCREEN', 'GameplayHUD');
        events.emit('GAME_STATE_CHANGED', 'PLAYING');
      },
    });
    zonePrimary.appendChild(playBtn.element);
    this.element.appendChild(zonePrimary);

    // Zone 3: Secondary Row
    const zoneSecondary = document.createElement('div');
    zoneSecondary.className = 'zone-secondary';

    // Team Selection Buttons
    const teamGroup = document.createElement('div');
    teamGroup.style.cssText = 'display:flex;align-items:center;gap:12px;';

    this.ctBtn = new Button({
      label: 'СПЕЦНАЗ (CT)',
      variant: 'ct',
      icon: ICONS.TEAM_CT,
      onClick: () => this.selectTeam('CT'),
    });
    this.ctBtn.setSelected(true);

    this.tBtn = new Button({
      label: 'ТЕРРОРИСТЫ (T)',
      variant: 't',
      icon: ICONS.TEAM_T,
      onClick: () => this.selectTeam('T'),
    });

    teamGroup.appendChild(this.ctBtn.element);
    teamGroup.appendChild(this.tBtn.element);
    zoneSecondary.appendChild(teamGroup);

    // Navigation Buttons (Arsenal & Settings)
    const navGroup = document.createElement('div');
    navGroup.style.cssText = 'display:flex;align-items:center;gap:12px;';

    const arsenalBtn = new Button({
      label: 'АРСЕНАЛ И СКИНЫ',
      icon: ICONS.CASE,
      onClick: () => {
        events.emit('NAVIGATE_SCREEN', 'ArsenalScreen');
        events.emit('GAME_STATE_CHANGED', 'ARSENAL');
      },
    });

    const settingsBtn = new Button({
      label: 'НАСТРОЙКИ',
      icon: ICONS.SETTINGS,
      onClick: () => {
        events.emit('NAVIGATE_SCREEN', 'PauseModal');
      },
    });

    navGroup.appendChild(arsenalBtn.element);
    navGroup.appendChild(settingsBtn.element);
    zoneSecondary.appendChild(navGroup);

    this.element.appendChild(zoneSecondary);
  }

  private selectTeam(team: 'CT' | 'T'): void {
    this.selectedTeam = team;
    this.ctBtn.setSelected(team === 'CT');
    this.tBtn.setSelected(team === 'T');
    events.emit('TEAM_SELECTED', team);
  }

  public show(): void {
    this.element.classList.add('active');
    const data = storage.getData();
    const rankNames = ['Silver I', 'Silver Elite', 'Gold Nova III', 'Master Guardian', 'Legendary Eagle', 'Global Elite'];
    this.rankText.textContent = rankNames[data.rankIndex] || 'Gold Nova';
    this.eloText.textContent = `${data.elo} ELO`;
  }

  public hide(): void {
    this.element.classList.remove('active');
  }
}
