import { ICONS } from '../icons';
import { StorageService } from '../../platform/StorageService';
import { AudioManager } from '../../audio/AudioManager';

export class LeaderboardModalScreen {
  public root: HTMLElement;
  private listContainer: HTMLElement;

  constructor(private onCloseClick: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop';

    const card = document.createElement('div');
    card.className = 'cyber-panel modal-card';

    // Zone 1: Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = 'var(--space-4)';

    header.innerHTML = `<h2 style="font-family: var(--font-display); font-size: 24px; color: var(--color-secondary); text-transform: uppercase;">ТОП ДУЭЛЯНТОВ: ELO-РЕЙТИНГ</h2>`;
    
    const closeTopBtn = document.createElement('button');
    closeTopBtn.className = 'btn-secondary';
    closeTopBtn.style.minHeight = '48px';
    closeTopBtn.style.minWidth = '48px';
    closeTopBtn.innerHTML = ICONS.close;
    closeTopBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onCloseClick();
    });
    header.appendChild(closeTopBtn);
    card.appendChild(header);

    // Zone 2: Content (Leaderboard List)
    this.listContainer = document.createElement('div');
    this.listContainer.style.display = 'flex';
    this.listContainer.style.flexDirection = 'column';
    this.listContainer.style.gap = 'var(--space-2)';
    this.listContainer.style.overflowY = 'auto';
    this.listContainer.style.maxHeight = '50vh';
    this.listContainer.style.marginBottom = 'var(--space-4)';
    card.appendChild(this.listContainer);

    // Zone 3: Actions
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'center';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-secondary';
    closeBtn.innerHTML = `<span>ЗАКРЫТЬ</span>`;
    closeBtn.addEventListener('click', () => {
      AudioManager.get().playClick();
      this.onCloseClick();
    });
    actions.appendChild(closeBtn);
    card.appendChild(actions);

    this.root.appendChild(card);
    this.refresh();
  }

  public show(): void {
    this.root.classList.add('active');
    this.refresh();
  }

  public hide(): void {
    this.root.classList.remove('active');
  }

  public refresh(): void {
    const pData = StorageService.get().getData();
    const mockLeaders = [
      { rank: 1, name: 's1mple_roof', elo: 2450 },
      { rank: 2, name: 'NiKo_OneTap', elo: 2310 },
      { rank: 3, name: 'm0NESY_peek', elo: 2180 },
      { rank: 4, name: 'ZywOo_cs', elo: 2050 },
      { rank: 5, name: 'B1t_Headshot', elo: 1920 },
      { rank: 6, name: 'Ты (Игрок)', elo: pData.elo, isPlayer: true }
    ];

    mockLeaders.sort((a, b) => b.elo - a.elo);

    this.listContainer.innerHTML = '';
    mockLeaders.forEach((l, idx) => {
      const row = document.createElement('div');
      row.className = l.isPlayer ? 'leaderboard-row player' : 'leaderboard-row';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '8px 12px';
      row.style.borderRadius = 'var(--radius-sm)';

      row.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: center;">
          <strong style="color: ${idx < 3 ? 'var(--color-highlight)' : 'var(--color-metallic)'}; width: 24px;">#${idx + 1}</strong>
          <span style="color: ${l.isPlayer ? 'var(--color-secondary)' : 'var(--color-text-bright)'}; font-weight: 600;">${l.name}</span>
        </div>
        <strong class="tabular-nums" style="color: var(--color-text-bright); font-family: var(--font-display); font-size: 18px;">${l.elo} ELO</strong>
      `;
      this.listContainer.appendChild(row);
    });
  }
}