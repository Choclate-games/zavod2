import { BaseScreen } from '../ScreenRouter';
import { playgama } from '../../platform/PlaygamaService';
import { events } from '../../core/EventBus';
import { NEON_COLORS } from '../../core/Constants';
import { ICONS } from '../icons';

export class MainMenuScreen implements BaseScreen {
  readonly root: HTMLElement;
  private creditsLabel!: HTMLElement;
  private repLabel!: HTMLElement;
  private onSelectTrackCallback: () => void;

  constructor(onSelectTrack: () => void) {
    this.onSelectTrackCallback = onSelectTrack;
    this.root = document.createElement('div');
    this.root.className = 'screen screen-main-menu';
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
    // 1. Top Header Bar (Identity Zone)
    const header = document.createElement('div');
    header.className = 'glass-panel cyber-cut';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: calc(var(--space-3) * var(--ui-scale)) calc(var(--space-5) * var(--ui-scale));
      pointer-events: auto;
    `;

    const titleGroup = document.createElement('div');
    titleGroup.innerHTML = `
      <div style="font-family: var(--font-display); font-size: calc(20px * var(--ui-scale)); font-weight: 900; color: var(--color-primary); letter-spacing: 0.1em;">НОЧНОЙ СИНДИКАТ</div>
      <div style="font-size: calc(11px * var(--ui-scale)); color: var(--color-text-secondary); text-transform: uppercase;">ДУЭЛИ И КОНТРАКТЫ • NFS UNDERGROUND</div>
    `;

    const statsGroup = document.createElement('div');
    statsGroup.style.cssText = `
      display: flex;
      gap: calc(var(--space-4) * var(--ui-scale));
      font-family: var(--font-display);
      font-weight: 700;
    `;

    this.creditsLabel = document.createElement('div');
    this.creditsLabel.style.cssText = `color: var(--color-drift); font-variant-numeric: tabular-nums;`;

    this.repLabel = document.createElement('div');
    this.repLabel.style.cssText = `color: var(--color-primary); font-variant-numeric: tabular-nums;`;

    statsGroup.appendChild(this.creditsLabel);
    statsGroup.appendChild(this.repLabel);

    header.appendChild(titleGroup);
    header.appendChild(statsGroup);

    // 2. Middle Left: Garage Tuning & Neon Color Panel (Secondary Grid)
    const tuningPanel = document.createElement('div');
    tuningPanel.className = 'glass-panel cyber-cut';
    tuningPanel.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: calc(var(--space-3) * var(--ui-scale));
      padding: calc(var(--space-4) * var(--ui-scale));
      width: calc(280px * var(--ui-scale));
      pointer-events: auto;
      margin-top: calc(var(--space-3) * var(--ui-scale));
    `;

    const tuningTitle = document.createElement('div');
    tuningTitle.textContent = 'ГАРАЖ И ТЮНИНГ';
    tuningTitle.style.cssText = `
      font-family: var(--font-display);
      font-weight: 800;
      font-size: calc(14px * var(--ui-scale));
      color: var(--color-text-primary);
      border-bottom: 1px solid var(--color-panel-border);
      padding-bottom: calc(var(--space-1) * var(--ui-scale));
    `;
    tuningPanel.appendChild(tuningTitle);

    // Upgrades list: Engine, Turbo, Tires, Nitro
    const upgrades = [
      { id: 'engine', name: 'ДВИГАТЕЛЬ (ECU)', cost: 2500 },
      { id: 'turbo', name: 'ТУРБОНАДДУВ', cost: 3000 },
      { id: 'tires', name: 'СПОРТ-ШИНЫ', cost: 2000 },
      { id: 'nitro', name: 'НИТРО-СИСТЕМА', cost: 3500 },
    ];

    upgrades.forEach((u) => {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const label = document.createElement('span');
      label.textContent = u.name;
      label.style.cssText = `font-size: calc(11px * var(--ui-scale)); color: var(--color-text-secondary);`;

      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary cyber-cut';
      btn.textContent = `+1 (${u.cost})`;
      btn.style.cssText = `
        min-height: 38px;
        padding: calc(var(--space-1) * var(--ui-scale)) calc(var(--space-2) * var(--ui-scale));
        font-size: calc(11px * var(--ui-scale));
      `;

      btn.addEventListener('click', () => {
        const prof = playgama.getProfile();
        if (prof.credits >= u.cost) {
          prof.credits -= u.cost;
          (prof.upgrades as any)[u.id] = ((prof.upgrades as any)[u.id] || 1) + 1;
          playgama.saveDebounced();
          this.updateDisplay();
          events.emit('VEHICLE_UPGRADED', {
            engineLevel: prof.upgrades.engine,
            turboLevel: prof.upgrades.turbo,
            tiresLevel: prof.upgrades.tires,
            nitroLevel: prof.upgrades.nitro,
            neonColorIndex: prof.selectedNeon,
          });
        }
      });

      row.appendChild(label);
      row.appendChild(btn);
      tuningPanel.appendChild(row);
    });

    // Neon selector buttons
    const neonTitle = document.createElement('div');
    neonTitle.textContent = 'НЕОНОВАЯ ПОДСВЕТКА';
    neonTitle.style.cssText = `
      font-family: var(--font-display);
      font-size: calc(12px * var(--ui-scale));
      font-weight: 700;
      margin-top: calc(var(--space-2) * var(--ui-scale));
      color: var(--color-primary);
    `;
    tuningPanel.appendChild(neonTitle);

    const neonRow = document.createElement('div');
    neonRow.style.cssText = `display: flex; gap: calc(var(--space-2) * var(--ui-scale));`;

    NEON_COLORS.forEach((nc, idx) => {
      const nBtn = document.createElement('button');
      nBtn.className = 'btn btn-secondary cyber-cut';
      nBtn.textContent = nc.name.split(' ')[0];
      nBtn.style.cssText = `
        min-height: 32px;
        padding: calc(var(--space-1) * var(--ui-scale)) calc(var(--space-2) * var(--ui-scale));
        font-size: calc(10px * var(--ui-scale));
      `;
      nBtn.addEventListener('click', () => {
        const prof = playgama.getProfile();
        prof.selectedNeon = idx;
        playgama.saveDebounced();
        events.emit('VEHICLE_UPGRADED', {
          engineLevel: prof.upgrades.engine,
          turboLevel: prof.upgrades.turbo,
          tiresLevel: prof.upgrades.tires,
          nitroLevel: prof.upgrades.nitro,
          neonColorIndex: idx,
        });
      });
      neonRow.appendChild(nBtn);
    });
    tuningPanel.appendChild(neonRow);

    // 3. Bottom Action Row (Primary Action Zone)
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = `
      display: flex;
      justify-content: flex-end;
      pointer-events: auto;
    `;

    const startBtn = document.createElement('button');
    startBtn.className = 'btn btn-primary cyber-cut';
    startBtn.innerHTML = `${ICONS.play} ВЫБОР ТРАССЫ`;
    startBtn.style.cssText = `
      min-height: 96px;
      min-width: calc(240px * var(--ui-scale));
      font-size: calc(20px * var(--ui-scale));
    `;
    startBtn.addEventListener('click', () => {
      this.onSelectTrackCallback();
    });
    bottomRow.appendChild(startBtn);

    this.root.appendChild(header);
    this.root.appendChild(tuningPanel);
    this.root.appendChild(bottomRow);
  }

  show(): void {
    this.updateDisplay();
  }

  hide(): void {}

  private updateDisplay(): void {
    const prof = playgama.getProfile();
    this.creditsLabel.textContent = `КРЕДИТЫ: ${prof.credits.toLocaleString()}`;
    this.repLabel.textContent = `РЕПУТАЦИЯ: РАСПРЕДЕЛЕНИЕ TIER-${prof.repTier}`;
  }
}
