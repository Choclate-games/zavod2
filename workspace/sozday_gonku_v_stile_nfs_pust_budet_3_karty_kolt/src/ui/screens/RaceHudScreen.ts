import { BaseScreen } from '../ScreenRouter';
import { events } from '../../core/EventBus';
import { ICONS } from '../icons';

export class RaceHudScreen implements BaseScreen {
  readonly root: HTMLElement;

  private posLabel!: HTMLElement;
  private lapLabel!: HTMLElement;
  private timerLabel!: HTMLElement;

  private driftScoreToast!: HTMLElement;
  private nearMissToast!: HTMLElement;

  private speedNumLabel!: HTMLElement;
  private gearLabel!: HTMLElement;
  private nitroBar1!: HTMLElement;
  private nitroBar2!: HTMLElement;
  private nitroBar3!: HTMLElement;

  private onPauseClickCallback: () => void;

  constructor(onPauseClick: () => void) {
    this.onPauseClickCallback = onPauseClick;

    this.root = document.createElement('div');
    this.root.className = 'screen screen-race-hud';
    this.root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      pointer-events: none;
      padding: calc(var(--space-3) * var(--ui-scale)) calc(var(--space-5) * var(--ui-scale));
    `;

    this.buildMarkup();
    this.bindEvents();
  }

  private buildMarkup(): void {
    // 1. Top HUD Row
    const topRow = document.createElement('div');
    topRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      pointer-events: none;
    `;

    // Top Left: Race Progress (Pos, Lap, Time)
    const statsBox = document.createElement('div');
    statsBox.className = 'glass-panel cyber-cut';
    statsBox.style.cssText = `
      display: flex;
      gap: calc(var(--space-3) * var(--ui-scale));
      padding: calc(var(--space-2) * var(--ui-scale)) calc(var(--space-4) * var(--ui-scale));
      font-family: var(--font-display);
      font-weight: 800;
    `;

    this.posLabel = document.createElement('div');
    this.posLabel.style.cssText = `color: var(--color-primary); font-size: calc(18px * var(--ui-scale)); font-variant-numeric: tabular-nums;`;
    this.posLabel.textContent = '1ST';

    this.lapLabel = document.createElement('div');
    this.lapLabel.style.cssText = `color: var(--color-text-secondary); font-size: calc(15px * var(--ui-scale)); font-variant-numeric: tabular-nums;`;
    this.lapLabel.textContent = 'LAP 1/2';

    this.timerLabel = document.createElement('div');
    this.timerLabel.style.cssText = `color: var(--color-text-primary); font-size: calc(15px * var(--ui-scale)); font-variant-numeric: tabular-nums; min-width: 75px;`;
    this.timerLabel.textContent = '00:00.00';

    statsBox.appendChild(this.posLabel);
    statsBox.appendChild(this.lapLabel);
    statsBox.appendChild(this.timerLabel);

    // Top Center: Drift & Near Miss Toasts
    const toastBox = document.createElement('div');
    toastBox.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: calc(var(--space-1) * var(--ui-scale));
    `;

    this.driftScoreToast = document.createElement('div');
    this.driftScoreToast.className = 'glass-panel cyber-cut';
    this.driftScoreToast.style.cssText = `
      display: none;
      font-family: var(--font-display);
      font-weight: 900;
      font-size: calc(18px * var(--ui-scale));
      color: var(--color-drift);
      padding: calc(var(--space-2) * var(--ui-scale)) calc(var(--space-4) * var(--ui-scale));
      font-variant-numeric: tabular-nums;
    `;

    this.nearMissToast = document.createElement('div');
    this.nearMissToast.className = 'glass-panel cyber-cut';
    this.nearMissToast.style.cssText = `
      display: none;
      font-family: var(--font-display);
      font-weight: 900;
      font-size: calc(14px * var(--ui-scale));
      color: var(--color-danger);
      padding: calc(var(--space-1) * var(--ui-scale)) calc(var(--space-3) * var(--ui-scale));
      letter-spacing: 0.1em;
    `;
    this.nearMissToast.textContent = '!! NEAR MISS x4.0 !!';

    toastBox.appendChild(this.driftScoreToast);
    toastBox.appendChild(this.nearMissToast);

    // Top Right: Pause button
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'btn btn-secondary cyber-cut';
    pauseBtn.innerHTML = ICONS.pause;
    pauseBtn.style.cssText = `
      pointer-events: auto;
      min-height: 52px;
      width: 52px;
      padding: 0;
    `;
    pauseBtn.addEventListener('click', () => {
      this.onPauseClickCallback();
    });

    topRow.appendChild(statsBox);
    topRow.appendChild(toastBox);
    topRow.appendChild(pauseBtn);

    // 2. Bottom Right: Speedometer & Nitro Gauge
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = `
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
      pointer-events: none;
    `;

    const gaugeBox = document.createElement('div');
    gaugeBox.className = 'glass-panel cyber-cut';
    gaugeBox.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding: calc(var(--space-2) * var(--ui-scale)) calc(var(--space-4) * var(--ui-scale));
      font-family: var(--font-display);
      font-weight: 900;
      pointer-events: none;
    `;

    const speedRow = document.createElement('div');
    speedRow.style.cssText = `display: flex; align-items: baseline; gap: 4px;`;

    this.speedNumLabel = document.createElement('span');
    this.speedNumLabel.style.cssText = `
      font-size: calc(34px * var(--ui-scale));
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
      min-width: calc(70px * var(--ui-scale));
      text-align: right;
    `;
    this.speedNumLabel.textContent = '0';

    const kmhLabel = document.createElement('span');
    kmhLabel.textContent = 'KM/H';
    kmhLabel.style.cssText = `font-size: calc(12px * var(--ui-scale)); color: var(--color-text-muted);`;

    this.gearLabel = document.createElement('span');
    this.gearLabel.textContent = 'G 1';
    this.gearLabel.style.cssText = `font-size: calc(14px * var(--ui-scale)); color: var(--color-primary); margin-left: 8px;`;

    speedRow.appendChild(this.speedNumLabel);
    speedRow.appendChild(kmhLabel);
    speedRow.appendChild(this.gearLabel);

    // 3-Cell Nitro Bar
    const nitroContainer = document.createElement('div');
    nitroContainer.style.cssText = `
      display: flex;
      gap: 3px;
      margin-top: 6px;
      width: calc(140px * var(--ui-scale));
      height: 8px;
    `;

    this.nitroBar1 = this.createNitroCell();
    this.nitroBar2 = this.createNitroCell();
    this.nitroBar3 = this.createNitroCell();

    nitroContainer.appendChild(this.nitroBar1);
    nitroContainer.appendChild(this.nitroBar2);
    nitroContainer.appendChild(this.nitroBar3);

    gaugeBox.appendChild(speedRow);
    gaugeBox.appendChild(nitroContainer);
    bottomRow.appendChild(gaugeBox);

    this.root.appendChild(topRow);
    this.root.appendChild(bottomRow);
  }

  private createNitroCell(): HTMLElement {
    const bg = document.createElement('div');
    bg.style.cssText = `
      flex: 1;
      height: 100%;
      background: var(--color-neutral-dark);
      overflow: hidden;
    `;
    const fill = document.createElement('div');
    fill.style.cssText = `
      width: 100%;
      height: 100%;
      background: var(--color-nitro);
      transform-origin: left;
      transform: scaleX(0);
      transition: transform var(--dur-elem) var(--ease-out);
    `;
    bg.appendChild(fill);
    return fill;
  }

  private bindEvents(): void {
    events.on('SPEED_CHANGED', (payload) => {
      this.speedNumLabel.textContent = Math.round(payload.speedKmh).toString();
      this.gearLabel.textContent = `G ${payload.gear}`;
    });

    events.on('NITRO_CHANGED', (payload) => {
      const ratio = payload.nitroRatio; // 0..3
      this.nitroBar1.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
      this.nitroBar2.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio - 1))})`;
      this.nitroBar3.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio - 2))})`;
    });

    events.on('DRIFT_STATE_CHANGED', (payload) => {
      if (payload.isDrifting && payload.score > 0) {
        this.driftScoreToast.style.display = 'block';
        this.driftScoreToast.textContent = `DRIFT +${payload.score} x${payload.multiplier.toFixed(1)}`;
      } else {
        this.driftScoreToast.style.display = 'none';
      }

      this.nearMissToast.style.display = payload.isNearMiss ? 'block' : 'none';
    });

    events.on('RACE_PROGRESS_CHANGED', (payload) => {
      const suffix = payload.position === 1 ? 'ST' : payload.position === 2 ? 'ND' : payload.position === 3 ? 'RD' : 'TH';
      this.posLabel.textContent = `${payload.position}${suffix}`;
      this.lapLabel.textContent = `LAP ${payload.lap}/${payload.totalLaps}`;

      const mins = Math.floor(payload.timeSec / 60);
      const secs = (payload.timeSec % 60).toFixed(2);
      this.timerLabel.textContent = `${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
    });
  }

  show(): void {
    this.driftScoreToast.style.display = 'none';
    this.nearMissToast.style.display = 'none';
  }

  hide(): void {
    this.driftScoreToast.style.display = 'none';
    this.nearMissToast.style.display = 'none';
  }
}
