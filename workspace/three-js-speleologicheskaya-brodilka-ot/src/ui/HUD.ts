import { GameStats, UpgradeCard } from "../utils/Constants";

export class HUD {
  public container: HTMLElement;
  private hpFill: HTMLElement;
  private hpText: HTMLElement;
  private energyFill: HTMLElement;
  private energyText: HTMLElement;
  private energyStatus: HTMLElement;
  private crystalText: HTMLElement;
  private decoyText: HTMLElement;
  private floorText: HTMLElement;
  private noiseFill: HTMLElement;
  private noiseText: HTMLElement;
  private alertBanner: HTMLElement;
  private upgradesList: HTMLElement;
  private btnPause: HTMLElement;

  private onPauseClick: () => void;

  constructor(onPauseClick: () => void) {
    this.onPauseClick = onPauseClick;

    this.container = document.createElement("div");
    this.container.id = "hud-layer";
    this.setupStyles();

    this.container.innerHTML = `
      <div class="hud-top-bar">
        <div class="hud-stat-box floor-box">
          <span class="hud-icon">🧭</span>
          <span id="hud-floor-text">ЯРУС 1</span>
        </div>

        <div class="hud-stat-box hp-box">
          <span class="hud-icon">❤️</span>
          <div class="hud-bar-bg">
            <div id="hud-hp-fill" class="hud-bar-fill hp-fill"></div>
          </div>
          <span id="hud-hp-text" class="hud-val">100/100</span>
        </div>

        <div class="hud-stat-box crystal-box">
          <span class="hud-icon">💎</span>
          <span id="hud-crystal-text" class="hud-val">0</span>
        </div>

        <div class="hud-stat-box decoy-box">
          <span class="hud-icon">🔊</span>
          <span id="hud-decoy-text" class="hud-val">3</span>
        </div>

        <div class="hud-stat-box noise-box">
          <span class="hud-icon">📶</span>
          <div class="hud-bar-bg small">
            <div id="hud-noise-fill" class="hud-bar-fill noise-fill"></div>
          </div>
          <span id="hud-noise-text" class="hud-val">0 dB</span>
        </div>

        <button id="hud-btn-pause" class="hud-pause-btn interactive">⏸️</button>
      </div>

      <div id="hud-alert-banner" class="hud-alert-banner">
        ⚠️ ХИЩНИК СЛЫШИТ ВАС! ЗАМРИТЕ ИЛИ БРОСЬТЕ МАЯК!
      </div>

      <div class="hud-bottom-bar">
        <div class="hud-sonar-gauge">
          <div class="sonar-gauge-header">
            <span class="hud-icon">🔋</span>
            <span class="gauge-title">ЭНЕРГИЯ СОНАРА</span>
            <span id="hud-energy-status" class="gauge-status ready">ГОТОВО</span>
          </div>
          <div class="hud-bar-bg wide">
            <div id="hud-energy-fill" class="hud-bar-fill energy-fill"></div>
          </div>
          <div class="gauge-sub">
            <span id="hud-energy-text">100 / 100</span>
            <span class="gauge-hint">ЛКМ / Кнопка СОНАР</span>
          </div>
        </div>

        <div id="hud-upgrades-list" class="hud-upgrades-list"></div>
      </div>
    `;

    document.getElementById("ui-layer")?.appendChild(this.container);

    this.hpFill = document.getElementById("hud-hp-fill")!;
    this.hpText = document.getElementById("hud-hp-text")!;
    this.energyFill = document.getElementById("hud-energy-fill")!;
    this.energyText = document.getElementById("hud-energy-text")!;
    this.energyStatus = document.getElementById("hud-energy-status")!;
    this.crystalText = document.getElementById("hud-crystal-text")!;
    this.decoyText = document.getElementById("hud-decoy-text")!;
    this.floorText = document.getElementById("hud-floor-text")!;
    this.noiseFill = document.getElementById("hud-noise-fill")!;
    this.noiseText = document.getElementById("hud-noise-text")!;
    this.alertBanner = document.getElementById("hud-alert-banner")!;
    this.upgradesList = document.getElementById("hud-upgrades-list")!;
    this.btnPause = document.getElementById("hud-btn-pause")!;

    this.btnPause.addEventListener("click", () => this.onPauseClick());
  }

  private setupStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      #hud-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: calc(12px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left));
        box-sizing: border-box;
        z-index: 12;
      }

      .hud-top-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .hud-stat-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(10, 18, 32, 0.82);
        border: 1px solid rgba(0, 240, 255, 0.3);
        border-radius: 8px;
        padding: 6px 12px;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }

      .hud-icon { font-size: 18px; }
      .hud-val { font-size: 14px; font-weight: bold; }

      .hud-bar-bg {
        width: 110px;
        height: 10px;
        background: rgba(255,255,255,0.1);
        border-radius: 5px;
        overflow: hidden;
      }

      .hud-bar-bg.small { width: 60px; }
      .hud-bar-bg.wide { width: 220px; height: 14px; }

      .hud-bar-fill {
        height: 100%;
        width: 100%;
        transition: width 0.15s ease-out;
      }

      .hp-fill { background: linear-gradient(90deg, #ff3366, #ff6b8b); box-shadow: 0 0 8px #ff3366; }
      .energy-fill { background: linear-gradient(90deg, #00f0ff, #38bdf8); box-shadow: 0 0 10px #00f0ff; }
      .noise-fill { background: linear-gradient(90deg, #00ff88, #ffd700, #ff3366); }

      .hud-pause-btn {
        margin-left: auto;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: rgba(10, 18, 32, 0.85);
        border: 1px solid rgba(0, 240, 255, 0.4);
        color: #fff;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .hud-alert-banner {
        align-self: center;
        background: rgba(255, 34, 68, 0.9);
        color: #fff;
        font-weight: bold;
        font-size: 14px;
        padding: 8px 18px;
        border-radius: 20px;
        box-shadow: 0 0 20px #ff2244;
        animation: pulseAlert 0.8s infinite alternate;
        display: none;
      }

      @keyframes pulseAlert {
        from { transform: scale(1); opacity: 0.9; }
        to { transform: scale(1.05); opacity: 1; }
      }

      .hud-bottom-bar {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        width: 100%;
      }

      .hud-sonar-gauge {
        background: rgba(10, 18, 32, 0.88);
        border: 1px solid rgba(0, 240, 255, 0.35);
        border-radius: 12px;
        padding: 10px 16px;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      }

      .sonar-gauge-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }

      .gauge-title {
        font-size: 12px;
        font-weight: bold;
        letter-spacing: 1px;
        color: #00f0ff;
      }

      .gauge-status {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: auto;
        font-weight: bold;
      }

      .gauge-status.ready { background: rgba(0, 255, 136, 0.2); color: #00ff88; }
      .gauge-status.recharge { background: rgba(255, 215, 0, 0.2); color: #ffd700; }

      .gauge-sub {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #94a3b8;
        margin-top: 4px;
      }

      .hud-upgrades-list {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .upgrade-badge {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid #00f0ff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
      }
    `;
    document.head.appendChild(style);
  }

  public update(stats: GameStats, floorIndex: number, crystalsInRun: number, currentNoise: number): void {
    // 1. HP
    const hpPct = Math.max(0, (stats.hp / stats.maxHp) * 100);
    this.hpFill.style.width = `${hpPct}%`;
    this.hpText.textContent = `${Math.round(stats.hp)}/${stats.maxHp}`;

    // 2. Energy
    const energyPct = Math.max(0, (stats.energy / stats.maxEnergy) * 100);
    this.energyFill.style.width = `${energyPct}%`;
    this.energyText.textContent = `${Math.round(stats.energy)} / ${stats.maxEnergy}`;

    const isReady = stats.energy >= stats.pulseEnergyCost;
    this.energyStatus.textContent = isReady ? "ГОТОВО" : "ЗАРЯДКА...";
    this.energyStatus.className = `gauge-status ${isReady ? "ready" : "recharge"}`;

    // 3. Stats & Counters
    this.floorText.textContent = `ЯРУС ${floorIndex}`;
    this.crystalText.textContent = `${crystalsInRun}`;
    this.decoyText.textContent = `${stats.decoyCharges}/${stats.maxDecoyCharges}`;

    // 4. Noise Radar
    const noisePct = Math.min(100, (currentNoise / 60) * 100);
    this.noiseFill.style.width = `${noisePct}%`;
    this.noiseText.textContent = `${Math.round(currentNoise)} dB`;

    // 5. Threat alert
    if (currentNoise >= 35) {
      this.alertBanner.style.display = "block";
    } else {
      this.alertBanner.style.display = "none";
    }
  }

  public renderUpgrades(upgrades: UpgradeCard[]): void {
    this.upgradesList.innerHTML = "";
    upgrades.forEach((u) => {
      const badge = document.createElement("div");
      badge.className = "upgrade-badge";
      badge.title = `${u.name}: ${u.description}`;
      badge.textContent = u.icon;
      this.upgradesList.appendChild(badge);
    });
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? "flex" : "none";
  }
}
