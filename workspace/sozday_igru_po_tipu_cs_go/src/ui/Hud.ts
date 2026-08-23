import { EventBus } from '../core/EventBus';

export class Hud {
  private container: HTMLElement;
  private timerEl: HTMLElement;
  private scoreDotsEl: HTMLElement;
  private crosshairEl: HTMLElement;
  private crosshairTop: HTMLElement;
  private crosshairBottom: HTMLElement;
  private crosshairLeft: HTMLElement;
  private crosshairRight: HTMLElement;
  private speedEl: HTMLElement;
  private ammoCurEl: HTMLElement;
  private ammoResEl: HTMLElement;
  private oneTapBanner: HTMLElement;

  private lastSpeedText = '';

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'ui-layer';

    // Top Bar (Timer + Score)
    const topBar = document.createElement('div');
    topBar.className = 'hud-top-bar';

    this.timerEl = document.createElement('div');
    this.timerEl.className = 'duel-timer tabular-nums';
    this.timerEl.textContent = '15.0';
    topBar.appendChild(this.timerEl);

    this.scoreDotsEl = document.createElement('div');
    this.scoreDotsEl.className = 'score-dots-container';
    this.renderScoreDots(0, 0);
    topBar.appendChild(this.scoreDotsEl);

    this.container.appendChild(topBar);

    // Crosshair
    this.crosshairEl = document.createElement('div');
    this.crosshairEl.className = 'crosshair-container';

    const dot = document.createElement('div');
    dot.className = 'crosshair-dot';
    this.crosshairEl.appendChild(dot);

    this.crosshairTop = document.createElement('div');
    this.crosshairTop.className = 'crosshair-bar crosshair-top';
    this.crosshairEl.appendChild(this.crosshairTop);

    this.crosshairBottom = document.createElement('div');
    this.crosshairBottom.className = 'crosshair-bar crosshair-bottom';
    this.crosshairEl.appendChild(this.crosshairBottom);

    this.crosshairLeft = document.createElement('div');
    this.crosshairLeft.className = 'crosshair-bar crosshair-left';
    this.crosshairEl.appendChild(this.crosshairLeft);

    this.crosshairRight = document.createElement('div');
    this.crosshairRight.className = 'crosshair-bar crosshair-right';
    this.crosshairEl.appendChild(this.crosshairRight);

    this.container.appendChild(this.crosshairEl);

    // Speed Meter
    this.speedEl = document.createElement('div');
    this.speedEl.className = 'hud-speed tabular-nums';
    this.speedEl.textContent = 'SPEED: 0.0 m/s';
    this.container.appendChild(this.speedEl);

    // Ammo Counter
    const ammoBox = document.createElement('div');
    ammoBox.className = 'hud-ammo';

    this.ammoCurEl = document.createElement('span');
    this.ammoCurEl.className = 'ammo-current tabular-nums';
    this.ammoCurEl.textContent = '7';
    ammoBox.appendChild(this.ammoCurEl);

    const slash = document.createElement('span');
    slash.textContent = '/';
    ammoBox.appendChild(slash);

    this.ammoResEl = document.createElement('span');
    this.ammoResEl.className = 'ammo-reserve tabular-nums';
    this.ammoResEl.textContent = '35';
    ammoBox.appendChild(this.ammoResEl);

    this.container.appendChild(ammoBox);

    // One-Tap Banner
    this.oneTapBanner = document.createElement('div');
    this.oneTapBanner.className = 'one-tap-banner';
    this.oneTapBanner.textContent = 'ONE TAP!';
    this.container.appendChild(this.oneTapBanner);

    this.setupListeners();
  }

  public mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  public show(): void {
    this.container.style.display = 'block';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  private renderScoreDots(pScore: number, bScore: number): void {
    this.scoreDotsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'score-dot' + (i < pScore ? ' player-won' : '');
      this.scoreDotsEl.appendChild(dot);
    }
    const sep = document.createElement('span');
    sep.textContent = ':';
    sep.style.color = 'var(--color-metallic)';
    this.scoreDotsEl.appendChild(sep);
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'score-dot' + (i < bScore ? ' bot-won' : '');
      this.scoreDotsEl.appendChild(dot);
    }
  }

  private setupListeners(): void {
    EventBus.get().on('ROUND_TIME_TICK', (data: { timeLeft: number; isCritical: boolean }) => {
      this.timerEl.textContent = data.timeLeft.toFixed(1);
      if (data.isCritical) {
        this.timerEl.classList.add('critical');
      } else {
        this.timerEl.classList.remove('critical');
      }
    });

    EventBus.get().on('PLAYER_MOVED', (data: { speed: number; isStopped: boolean }) => {
      const speedStr = `SPEED: ${data.speed.toFixed(1)} m/s`;
      if (speedStr !== this.lastSpeedText) {
        this.lastSpeedText = speedStr;
        this.speedEl.textContent = speedStr;
      }

      if (data.isStopped) {
        this.speedEl.classList.add('perfect-stop');
      } else {
        this.speedEl.classList.remove('perfect-stop');
      }

      // Spread offset for crosshair
      const spreadOffset = Math.min(24, data.speed * 4);
      this.crosshairTop.style.transform = `translateY(-${spreadOffset}px)`;
      this.crosshairBottom.style.transform = `translateY(${spreadOffset}px)`;
      this.crosshairLeft.style.transform = `translateX(-${spreadOffset}px)`;
      this.crosshairRight.style.transform = `translateX(${spreadOffset}px)`;
    });

    EventBus.get().on('PLAYER_SHOT', (data: { ammo: number; maxAmmo: number }) => {
      this.ammoCurEl.textContent = data.ammo.toString();
    });

    EventBus.get().on('WEAPON_CHANGED', (data: { ammo: number; maxAmmo: number }) => {
      this.ammoCurEl.textContent = data.ammo.toString();
      this.ammoResEl.textContent = (data.ammo * 5).toString();
    });

    EventBus.get().on('ROUND_ENDED', (data: { playerScore: number; botScore: number }) => {
      this.renderScoreDots(data.playerScore, data.botScore);
    });

    EventBus.get().on('HEADSHOT_TRIGGERED', () => {
      this.oneTapBanner.classList.add('show');
      setTimeout(() => {
        this.oneTapBanner.classList.remove('show');
      }, 900);
    });
  }
}