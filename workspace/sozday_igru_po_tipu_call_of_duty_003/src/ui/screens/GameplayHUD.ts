import { EventBus, BreathState, AlarmState } from '../../core/EventBus';

export class GameplayHUD {
  public root: HTMLDivElement;
  private canvasReticle: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private ammoEl: HTMLElement | null = null;
  private targetsEl: HTMLElement | null = null;
  private windEl: HTMLElement | null = null;
  private noiseBarEl: HTMLElement | null = null;
  private alarmEl: HTMLElement | null = null;

  public currentStamina = 1.0;
  public breathState: BreathState = 'NORMAL';
  public alarmState: AlarmState = 'CLEAR';
  public windSpeed = 6.5;
  public remainingAmmo = 6;
  public eliminatedTargets = 0;
  public totalTargets = 2;
  public noiseMaskingRatio = 0.0;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'gameplay_hud';
    this.root.className = 'screen-container';
    this.root.style.padding = '0';

    this.canvasReticle = document.createElement('canvas');
    this.canvasReticle.id = 'reticle-canvas';
    this.canvasReticle.style.position = 'absolute';
    this.canvasReticle.style.top = '0';
    this.canvasReticle.style.left = '0';
    this.canvasReticle.style.width = '100%';
    this.canvasReticle.style.height = '100%';
    this.canvasReticle.style.pointerEvents = 'none';

    this.render();
    this.root.appendChild(this.canvasReticle);
    this.ctx = this.canvasReticle.getContext('2d');

    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    this.bindEvents();
  }

  private render(): void {
    this.root.innerHTML = `
      <div style="position: absolute; top: calc(var(--safe-top) + 12px); left: 50%; transform: translateX(-50%); width: 280px; display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: none;">
        <div style="font-size: 11px; letter-spacing: 1px; color: var(--color-text-muted);">АКУСТИЧЕСКАЯ МАСКИРОВКА</div>
        <div style="width: 100%; height: 8px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 2px; overflow: hidden;">
          <div id="hud-noise-bar" style="width: 0%; height: 100%; background: var(--color-accent); transition: width 0.1s linear;"></div>
        </div>
      </div>

      <div style="position: absolute; top: calc(var(--safe-top) + 12px); right: calc(var(--safe-right) + 20px); display: flex; flex-direction: column; gap: 8px; pointer-events: none;">
        <div class="tactical-card" style="padding: 10px 16px; min-width: 140px;">
          <div style="font-size: 11px; color: var(--color-text-muted);">ЦЕЛИ VIP</div>
          <div id="hud-targets" class="tabular-nums" style="font-size: 18px; font-weight: 700; color: var(--color-accent);">0 / 2</div>
        </div>
        <div class="tactical-card" style="padding: 10px 16px; min-width: 140px;">
          <div style="font-size: 11px; color: var(--color-text-muted);">БОЕКОМПЛЕКТ</div>
          <div id="hud-ammo" class="tabular-nums" style="font-size: 18px; font-weight: 700; color: var(--color-text);">6</div>
        </div>
      </div>

      <div style="position: absolute; bottom: calc(var(--safe-bottom) + 16px); left: calc(var(--safe-left) + 20px); display: flex; flex-direction: column; gap: 8px; pointer-events: none;">
        <div class="tactical-card" style="padding: 10px 16px; min-width: 140px;">
          <div style="font-size: 11px; color: var(--color-text-muted);">ВЕТЕР ПОЛЯРНЫЙ</div>
          <div id="hud-wind" class="tabular-nums" style="font-size: 16px; font-weight: 700; color: var(--color-amber);">6.5 м/с ◄</div>
        </div>
        <div id="hud-alarm-status" class="tactical-card" style="padding: 10px 16px; min-width: 140px; display: none;">
          <div style="font-size: 11px; color: var(--color-danger); font-weight: 700;">ТРЕВОГА СЕКТОРА</div>
        </div>
      </div>
    `;

    this.ammoEl = this.root.querySelector('#hud-ammo');
    this.targetsEl = this.root.querySelector('#hud-targets');
    this.windEl = this.root.querySelector('#hud-wind');
    this.noiseBarEl = this.root.querySelector('#hud-noise-bar');
    this.alarmEl = this.root.querySelector('#hud-alarm-status');
  }

  private bindEvents(): void {
    EventBus.on('BREATH_STATE_CHANGED', (st: BreathState) => {
      this.breathState = st;
      if (st === 'HYPERVENTILATION') {
        if (this.root) this.root.style.filter = 'contrast(1.2)';
      } else if (st === 'HOLDING') {
        if (this.root) this.root.style.filter = 'none';
      } else if (st === 'RECOVERY' || st === 'NORMAL') {
        if (this.root) this.root.style.filter = 'none';
      }
    });

    EventBus.on('ALARM_STATE_CHANGED', (st: AlarmState) => {
      this.alarmState = st;
      if (this.alarmEl) {
        this.alarmEl.style.display = st === 'CLEAR' ? 'none' : 'block';
      }
    });

    EventBus.on('MISSION_OBJECTIVE_UPDATED', (data: { eliminated: number; total: number; ammo: number }) => {
      this.eliminatedTargets = data.eliminated;
      this.totalTargets = data.total;
      this.remainingAmmo = data.ammo;
      if (this.ammoEl) this.ammoEl.textContent = `${data.ammo}`;
      if (this.targetsEl) this.targetsEl.textContent = `${data.eliminated} / ${data.total}`;
    });
  }

  private onResize(): void {
    this.canvasReticle.width = window.innerWidth;
    this.canvasReticle.height = window.innerHeight;
  }

  public update(staminaNorm: number, wind: number, noiseRatio: number): void {
    this.currentStamina = staminaNorm;
    this.windSpeed = wind;
    this.noiseMaskingRatio = noiseRatio;

    if (this.windEl) {
      this.windEl.textContent = `${wind.toFixed(1)} м/с ◄`;
    }
    if (this.noiseBarEl) {
      this.noiseBarEl.style.width = `${Math.round(noiseRatio * 100)}%`;
      this.noiseBarEl.style.backgroundColor = noiseRatio > 0.1 ? 'var(--color-accent)' : 'var(--color-text-muted)';
    }

    this.drawReticle();
  }

  private drawReticle(): void {
    if (!this.ctx) return;
    const w = this.canvasReticle.width;
    const h = this.canvasReticle.height;
    const cx = w / 2;
    const cy = h / 2;

    this.ctx.clearRect(0, 0, w, h);

    const style = getComputedStyle(document.documentElement);
    const colorAccent = style.getPropertyValue('--color-accent').trim() || 'green';
    const colorText = style.getPropertyValue('--color-text').trim() || 'white';
    const colorDanger = style.getPropertyValue('--color-danger').trim() || 'red';

    // Mil-Dot crosshairs
    this.ctx.strokeStyle = this.breathState === 'HOLDING' ? colorAccent : colorText;
    this.ctx.lineWidth = 1.5;

    // Center lines
    this.ctx.beginPath();
    this.ctx.moveTo(cx - 160, cy);
    this.ctx.lineTo(cx + 160, cy);
    this.ctx.moveTo(cx, cy - 160);
    this.ctx.lineTo(cx, cy + 160);
    this.ctx.stroke();

    // Mil dots (every 28px)
    this.ctx.fillStyle = this.ctx.strokeStyle;
    for (let i = 1; i <= 5; i++) {
      const offset = i * 28;
      // Right & Left
      this.ctx.beginPath();
      this.ctx.arc(cx + offset, cy, 2, 0, Math.PI * 2);
      this.ctx.arc(cx - offset, cy, 2, 0, Math.PI * 2);
      // Top & Bottom
      this.ctx.arc(cx, cy + offset, 2, 0, Math.PI * 2);
      this.ctx.arc(cx, cy - offset, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Circular breath stamina meter around reticle center
    const radius = 50;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.currentStamina);
    this.ctx.strokeStyle = this.currentStamina < 0.25 ? colorDanger : colorAccent;
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
  }

  public show(): void {
    this.root.classList.remove('hidden');
  }

  public hide(): void {
    this.root.classList.add('hidden');
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvasReticle.width, this.canvasReticle.height);
    }
  }
}
