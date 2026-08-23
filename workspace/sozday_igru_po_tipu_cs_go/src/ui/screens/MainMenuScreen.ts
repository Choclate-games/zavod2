import { ICONS } from '../icons';
import { StorageService } from '../../platform/StorageService';
import { AudioManager } from '../../audio/AudioManager';

export class MainMenuScreen {
  public root: HTMLElement;
  private eloText: HTMLElement;
  private coinsText: HTMLElement;

  constructor(
    private onPlayClick: () => void,
    private onShopClick: () => void,
    private onLeaderboardClick: () => void,
    private onSettingsClick: () => void
  ) {
    this.root = document.createElement('div');
    this.root.className = 'screen-root active';

    // Zone 1: Header / Identity
    const header = document.createElement('div');
    header.className = 'zone-header';

    const titleBox = document.createElement('div');
    titleBox.className = 'cyber-panel';
    titleBox.innerHTML = `<h1 style="font-family: var(--font-display); font-size: clamp(20px, 3.5vw, 32px); font-weight: 700; color: var(--color-text-bright); text-transform: uppercase;">ВАН-ТАП: ДУЭЛИ НА КРЫШЕ</h1>`;
    header.appendChild(titleBox);

    const statsBox = document.createElement('div');
    statsBox.className = 'cyber-panel';
    statsBox.style.display = 'flex';
    statsBox.style.gap = 'var(--space-4)';
    statsBox.style.alignItems = 'center';

    const eloWrapper = document.createElement('div');
    eloWrapper.innerHTML = `<span style="color: var(--color-metallic); font-size: 13px;">ELO: </span>`;
    this.eloText = document.createElement('strong');
    this.eloText.className = 'tabular-nums';
    this.eloText.style.color = 'var(--color-secondary)';
    this.eloText.textContent = '1000';
    eloWrapper.appendChild(this.eloText);
    statsBox.appendChild(eloWrapper);

    const coinsWrapper = document.createElement('div');
    coinsWrapper.innerHTML = `<span style="color: var(--color-metallic); font-size: 13px;">ЗОЛОТО: </span>`;
    this.coinsText = document.createElement('strong');
    this.coinsText.className = 'tabular-nums';
    this.coinsText.style.color = 'var(--color-highlight)';
    this.coinsText.textContent = '100';
    coinsWrapper.appendChild(this.coinsText);
    statsBox.appendChild(coinsWrapper);

    header.appendChild(statsBox);
    this.root.appendChild(header);

    // Zone 2: Content (Live 3D Scene in background + mode banner)
    const content = document.createElement('div');
    content.className = 'zone-content';
    const modeBadge = document.createElement('div');
    modeBadge.className = 'cyber-panel';
    modeBadge.innerHTML = `<div style="color: var(--color-metallic); font-size: 14px; text-align: center;">РЕЖИМ: СОПРЕВНОВАТЕЛЬНАЯ ДУЭЛЬ 1v1 (BEST OF 5)</div>`;
    content.appendChild(modeBadge);
    this.root.appendChild(content);

    // Zone 3: Actions (Primary Play Button + Secondary Toolbar)
    const actions = document.createElement('div');
    actions.className = 'zone-actions';
    actions.style.flexDirection = 'column';
    actions.style.gap = 'var(--space-3)';

    const playBtn = document.createElement('button');
    playBtn.className = 'btn-primary';
    playBtn.innerHTML = `${ICONS.play} <span>В БОЙ</span>`;
    playBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onPlayClick();
    });
    actions.appendChild(playBtn);

    const secondaryRow = document.createElement('div');
    secondaryRow.style.display = 'flex';
    secondaryRow.style.gap = 'var(--space-3)';
    secondaryRow.style.pointerEvents = 'none';

    const shopBtn = document.createElement('button');
    shopBtn.className = 'btn-secondary';
    shopBtn.innerHTML = `${ICONS.gun} <span>АРСЕНАЛ</span>`;
    shopBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onShopClick();
    });
    secondaryRow.appendChild(shopBtn);

    const leadBtn = document.createElement('button');
    leadBtn.className = 'btn-secondary';
    leadBtn.innerHTML = `${ICONS.trophy} <span>ТОП</span>`;
    leadBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onLeaderboardClick();
    });
    secondaryRow.appendChild(leadBtn);

    const setBtn = document.createElement('button');
    setBtn.className = 'btn-secondary';
    setBtn.innerHTML = `${ICONS.gear} <span>ОПЦИИ</span>`;
    setBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onSettingsClick();
    });
    secondaryRow.appendChild(setBtn);

    actions.appendChild(secondaryRow);
    this.root.appendChild(actions);

    this.refresh();
  }

  public refresh(): void {
    const data = StorageService.get().getData();
    this.eloText.textContent = data.elo.toString();
    this.coinsText.textContent = data.coins.toString();
  }
}