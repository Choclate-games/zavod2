import { BaseScreen } from '../ScreenRouter';
import { TRACKS, TrackDef } from '../../core/Constants';
import { ICONS } from '../icons';

export class TrackSelectScreen implements BaseScreen {
  readonly root: HTMLElement;
  private selectedTrackId = 'downtown_loop';
  private cardElements: HTMLElement[] = [];
  private onStartRaceCallback: (trackId: string) => void;
  private onBackCallback: () => void;

  constructor(onStartRace: (trackId: string) => void, onBack: () => void) {
    this.onStartRaceCallback = onStartRace;
    this.onBackCallback = onBack;

    this.root = document.createElement('div');
    this.root.className = 'screen screen-track-select';
    this.root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      pointer-events: none;
      padding: calc(var(--space-4) * var(--ui-scale)) calc(var(--space-6) * var(--ui-scale));
    `;

    this.buildMarkup();
  }

  private buildMarkup(): void {
    // 1. Header (Identity Zone)
    const header = document.createElement('div');
    header.className = 'glass-panel cyber-cut';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: calc(var(--space-3) * var(--ui-scale)) calc(var(--space-5) * var(--ui-scale));
      pointer-events: auto;
    `;

    const title = document.createElement('div');
    title.innerHTML = `
      <div style="font-family: var(--font-display); font-size: calc(20px * var(--ui-scale)); font-weight: 900; color: var(--color-primary);">ВЫБОР КОНТРАКТА И ТРАССЫ</div>
      <div style="font-size: calc(11px * var(--ui-scale)); color: var(--color-text-secondary);">3 ДОСТУПНЫХ ГОНОЧНЫХ ЛОКАЦИИ</div>
    `;

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary cyber-cut';
    backBtn.innerHTML = `${ICONS.arrowLeft} В ГАРАЖ`;
    backBtn.style.cssText = `min-height: 48px;`;
    backBtn.addEventListener('click', () => this.onBackCallback());

    header.appendChild(title);
    header.appendChild(backBtn);

    // 2. Middle: 3 Track Cards (Secondary Grid)
    const trackGrid = document.createElement('div');
    trackGrid.style.cssText = `
      display: flex;
      gap: calc(var(--space-4) * var(--ui-scale));
      justify-content: center;
      align-items: center;
      pointer-events: auto;
      margin: calc(var(--space-3) * var(--ui-scale)) 0;
    `;

    Object.values(TRACKS).forEach((t: TrackDef) => {
      const card = document.createElement('div');
      card.className = 'glass-panel cyber-cut';
      card.style.cssText = `
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: calc(var(--space-4) * var(--ui-scale));
        width: calc(260px * var(--ui-scale));
        min-height: calc(220px * var(--ui-scale));
        cursor: pointer;
        transition: transform var(--dur-elem) var(--ease-out), border-color var(--dur-elem) var(--ease-out);
      `;

      card.innerHTML = `
        <div>
          <div style="font-family: var(--font-display); font-size: calc(16px * var(--ui-scale)); font-weight: 800; color: var(--color-primary);">${t.name}</div>
          <div style="font-size: calc(11px * var(--ui-scale)); color: var(--color-text-muted); margin-top: 4px; text-transform: uppercase;">${t.type === 'circuit' ? 'Кольцо (Circuit)' : t.type === 'sprint' ? 'Спринт (Sprint)' : 'Дрифт-Арена (Drift)'}</div>
          <div style="font-size: calc(12px * var(--ui-scale)); color: var(--color-text-secondary); margin-top: 8px;">${t.description}</div>
        </div>
        <div style="margin-top: 12px; font-size: calc(11px * var(--ui-scale));">
          <div style="color: var(--color-drift); font-weight: 700;">НАГРАДА: +${t.rewardCredits.toLocaleString()} КР</div>
          <div style="color: var(--color-text-secondary); margin-top: 2px;">Длина: ${t.lengthKm} км • Кругов: ${t.totalLaps}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectedTrackId = t.id;
        this.updateCardSelection();
      });

      this.cardElements.push(card);
      trackGrid.appendChild(card);
    });

    // 3. Bottom Action Row (Primary Action Zone)
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = `
      display: flex;
      justify-content: flex-end;
      pointer-events: auto;
    `;

    const startBtn = document.createElement('button');
    startBtn.className = 'btn btn-primary cyber-cut';
    startBtn.innerHTML = `${ICONS.play} СТАРТ ЗАЕЗДА`;
    startBtn.style.cssText = `
      min-height: 96px;
      min-width: calc(260px * var(--ui-scale));
      font-size: calc(20px * var(--ui-scale));
    `;
    startBtn.addEventListener('click', () => {
      this.onStartRaceCallback(this.selectedTrackId);
    });
    bottomRow.appendChild(startBtn);

    this.root.appendChild(header);
    this.root.appendChild(trackGrid);
    this.root.appendChild(bottomRow);

    this.updateCardSelection();
  }

  private updateCardSelection(): void {
    const trackKeys = Object.keys(TRACKS);
    this.cardElements.forEach((el, idx) => {
      const isSel = trackKeys[idx] === this.selectedTrackId;
      el.style.transform = isSel ? 'scale(1.05)' : 'scale(1.0)';
      el.style.borderColor = isSel ? 'var(--color-primary)' : 'var(--color-panel-border)';
    });
  }

  show(): void {
    this.updateCardSelection();
  }

  hide(): void {}
}
