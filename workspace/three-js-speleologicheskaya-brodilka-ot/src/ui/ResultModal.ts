export interface ResultData {
  isVictory: boolean;
  depthReached: number;
  crystalsEarned: number;
  enemiesStunned: number;
  durationSeconds: number;
}

export class ResultModal {
  public container: HTMLElement;
  private titleEl: HTMLElement;
  private iconEl: HTMLElement;
  private statsBox: HTMLElement;
  private btnDouble: HTMLElement;
  private btnRestart: HTMLElement;
  private btnCamp: HTMLElement;

  private onRestartCallback: () => void;
  private onCampCallback: () => void;
  private onDoubleCallback: () => void;

  constructor(
    onRestart: () => void,
    onCamp: () => void,
    onDouble: () => void
  ) {
    this.onRestartCallback = onRestart;
    this.onCampCallback = onCamp;
    this.onDoubleCallback = onDouble;

    this.container = document.createElement("div");
    this.container.id = "result-modal-layer";
    this.setupStyles();

    this.container.innerHTML = `
      <div class="result-backdrop">
        <div class="result-panel interactive">
          <div id="result-icon" class="result-icon">💀</div>
          <h2 id="result-title" class="result-title">СИГНАЛ ПОТЕРЯН</h2>

          <div id="result-stats" class="result-stats-grid"></div>

          <div class="result-actions">
            <button id="btn-double-crystals" class="btn-result-double interactive">
              💎 Удвоить кристаллы (x2) (Реклама)
            </button>
            <div class="result-btn-row">
              <button id="btn-result-camp" class="btn-result-sec interactive">⛺ В лагерь</button>
              <button id="btn-result-restart" class="btn-result-pri interactive">🔄 Повторить забег</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("ui-layer")?.appendChild(this.container);

    this.titleEl = document.getElementById("result-title")!;
    this.iconEl = document.getElementById("result-icon")!;
    this.statsBox = document.getElementById("result-stats")!;
    this.btnDouble = document.getElementById("btn-double-crystals")!;
    this.btnRestart = document.getElementById("btn-result-restart")!;
    this.btnCamp = document.getElementById("btn-result-camp")!;

    this.btnDouble.addEventListener("click", () => {
      this.btnDouble.style.display = "none";
      this.onDoubleCallback();
    });

    this.btnRestart.addEventListener("click", () => {
      this.hide();
      this.onRestartCallback();
    });

    this.btnCamp.addEventListener("click", () => {
      this.hide();
      this.onCampCallback();
    });
  }

  private setupStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      #result-modal-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        display: none;
        z-index: 25;
      }

      .result-backdrop {
        width: 100%;
        height: 100%;
        background: rgba(2, 6, 15, 0.92);
        backdrop-filter: blur(12px);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      }

      .result-panel {
        background: rgba(10, 18, 32, 0.95);
        border: 2px solid rgba(0, 240, 255, 0.35);
        border-radius: 18px;
        padding: 28px 36px;
        max-width: 520px;
        width: 90%;
        text-align: center;
        box-shadow: 0 0 40px rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .result-icon { font-size: 54px; }
      .result-title { font-size: 24px; font-weight: bold; letter-spacing: 1.5px; }

      .result-title.victory { color: #00ff88; text-shadow: 0 0 15px rgba(0,255,136,0.5); }
      .result-title.defeat { color: #ff3366; text-shadow: 0 0 15px rgba(255,51,102,0.5); }

      .result-stats-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 14px 18px;
        box-sizing: border-box;
      }

      .stat-row {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        color: #94a3b8;
      }

      .stat-val { font-weight: bold; color: #fff; }

      .result-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
      }

      .btn-result-double {
        background: linear-gradient(135deg, #bf55ec, #8a2be2);
        border: none;
        color: #fff;
        padding: 12px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 0 20px rgba(191, 85, 236, 0.4);
      }

      .result-btn-row {
        display: flex;
        gap: 12px;
      }

      .btn-result-sec {
        flex: 1;
        background: rgba(30, 41, 59, 0.8);
        border: 1px solid rgba(255,255,255,0.2);
        color: #e2e8f0;
        padding: 12px;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
      }

      .btn-result-pri {
        flex: 1.2;
        background: linear-gradient(135deg, #00f0ff, #0088cc);
        border: none;
        color: #040812;
        padding: 12px;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 0 15px rgba(0, 240, 255, 0.3);
      }
    `;
    document.head.appendChild(style);
  }

  public show(data: ResultData, allowDoubleAd: boolean = true): void {
    if (data.isVictory) {
      this.iconEl.textContent = "🏆";
      this.titleEl.textContent = "ЭКСПЕДИЦИЯ ЗАВЕРШЕНА!";
      this.titleEl.className = "result-title victory";
    } else {
      this.iconEl.textContent = "💀";
      this.titleEl.textContent = "СИГНАЛ ПОТЕРЯН";
      this.titleEl.className = "result-title defeat";
    }

    const mins = Math.floor(data.durationSeconds / 60);
    const secs = Math.floor(data.durationSeconds % 60);
    const timeStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

    this.statsBox.innerHTML = `
      <div class="stat-row">
        <span>Достигнутый ярус:</span>
        <span class="stat-val">Ярус ${data.depthReached}</span>
      </div>
      <div class="stat-row">
        <span>Добыто био-кристаллов:</span>
        <span class="stat-val" style="color: #bf55ec;">💎 ${data.crystalsEarned}</span>
      </div>
      <div class="stat-row">
        <span>Оглушено хищников:</span>
        <span class="stat-val">${data.enemiesStunned}</span>
      </div>
      <div class="stat-row">
        <span>Время экспедиции:</span>
        <span class="stat-val">${timeStr}</span>
      </div>
    `;

    this.btnDouble.style.display = allowDoubleAd && data.crystalsEarned > 0 ? "block" : "none";
    this.container.style.display = "block";
  }

  public hide(): void {
    this.container.style.display = "none";
  }
}
