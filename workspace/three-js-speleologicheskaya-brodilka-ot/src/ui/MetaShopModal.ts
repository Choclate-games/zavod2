import { META_UPGRADES, MetaUpgradeDef } from "../utils/Constants";
import { PlayerSaveData } from "../core/GameState";
import { ProgressionManager } from "../systems/ProgressionManager";

export class MetaShopModal {
  public container: HTMLElement;
  private crystalWalletText: HTMLElement;
  private itemsGrid: HTMLElement;
  private btnClose: HTMLElement;
  private btnStartExpedition: HTMLElement;

  private progression: ProgressionManager;
  private onStartCallback: () => void;
  private onCloseCallback: () => void;
  private currentSave: PlayerSaveData | null = null;

  constructor(
    progression: ProgressionManager,
    onStart: () => void,
    onClose: () => void
  ) {
    this.progression = progression;
    this.onStartCallback = onStart;
    this.onCloseCallback = onClose;

    this.container = document.createElement("div");
    this.container.id = "meta-shop-modal";
    this.setupStyles();

    this.container.innerHTML = `
      <div class="shop-backdrop">
        <div class="shop-panel interactive">
          <div class="shop-header">
            <div class="shop-title-box">
              <h2 class="shop-title">⛺ БАЗОВЫЙ ЛАГЕРЬ СПЕЛЕОЛОГОВ</h2>
              <p class="shop-sub">Постоянная модификация спелеокостюма и сенсоров за Кристаллы</p>
            </div>
            <div class="shop-wallet">
              <span class="wallet-icon">💎</span>
              <span id="shop-wallet-val" class="wallet-val">0</span>
            </div>
          </div>

          <div id="shop-items-grid" class="shop-items-grid"></div>

          <div class="shop-footer">
            <button id="shop-btn-close" class="btn-shop-secondary interactive">В главное меню</button>
            <button id="shop-btn-start" class="btn-shop-primary interactive">🚀 НАЧАТЬ ЭКСПЕДИЦИЮ</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("ui-layer")?.appendChild(this.container);

    this.crystalWalletText = document.getElementById("shop-wallet-val")!;
    this.itemsGrid = document.getElementById("shop-items-grid")!;
    this.btnClose = document.getElementById("shop-btn-close")!;
    this.btnStartExpedition = document.getElementById("shop-btn-start")!;

    this.btnClose.addEventListener("click", () => {
      this.hide();
      this.onCloseCallback();
    });

    this.btnStartExpedition.addEventListener("click", () => {
      this.hide();
      this.onStartCallback();
    });
  }

  private setupStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      #meta-shop-modal {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        display: none;
        z-index: 22;
      }

      .shop-backdrop {
        width: 100%;
        height: 100%;
        background: rgba(2, 6, 15, 0.9);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      }

      .shop-panel {
        background: rgba(10, 18, 32, 0.95);
        border: 2px solid rgba(0, 240, 255, 0.4);
        border-radius: 16px;
        padding: 24px 32px;
        max-width: 850px;
        width: 90%;
        box-shadow: 0 0 35px rgba(0, 240, 255, 0.2);
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .shop-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 12px;
      }

      .shop-title {
        color: #00f0ff;
        font-size: 20px;
        margin-bottom: 4px;
      }

      .shop-sub {
        color: #94a3b8;
        font-size: 13px;
      }

      .shop-wallet {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(191, 85, 236, 0.15);
        border: 1px solid #bf55ec;
        border-radius: 8px;
        padding: 6px 14px;
      }

      .wallet-icon { font-size: 20px; }
      .wallet-val { font-size: 18px; font-weight: bold; color: #bf55ec; }

      .shop-items-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 16px;
      }

      .shop-item-card {
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(0, 240, 255, 0.2);
        border-radius: 10px;
        padding: 14px;
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .item-icon { font-size: 32px; }
      .item-info { flex: 1; }
      .item-name { font-size: 14px; font-weight: bold; color: #fff; margin-bottom: 2px; }
      .item-desc { font-size: 11px; color: #94a3b8; line-height: 1.3; margin-bottom: 4px; }
      .item-level { font-size: 11px; color: #00f0ff; font-weight: bold; }

      .btn-buy {
        background: linear-gradient(135deg, #00f0ff, #0088cc);
        border: none;
        color: #000;
        font-weight: bold;
        font-size: 12px;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: transform 0.1s;
      }

      .btn-buy:disabled {
        background: #334155;
        color: #64748b;
        cursor: not-allowed;
      }

      .shop-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .btn-shop-secondary {
        background: rgba(30, 41, 59, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #e2e8f0;
        padding: 10px 18px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 13px;
        cursor: pointer;
      }

      .btn-shop-primary {
        background: linear-gradient(135deg, #00f0ff, #00a8b3);
        border: none;
        color: #040812;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 14px;
        letter-spacing: 1px;
        cursor: pointer;
        box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
      }
    `;
    document.head.appendChild(style);
  }

  public show(save: PlayerSaveData): void {
    this.currentSave = save;
    this.render();
    this.container.style.display = "block";
  }

  public hide(): void {
    this.container.style.display = "none";
  }

  private render(): void {
    if (!this.currentSave) return;

    this.crystalWalletText.textContent = `${this.currentSave.totalCrystals}`;
    this.itemsGrid.innerHTML = "";

    META_UPGRADES.forEach((def) => {
      const level = this.progression.getUpgradeLevel(this.currentSave!, def.id);
      const cost = this.progression.getUpgradeCost(this.currentSave!, def.id);
      const isMax = cost < 0;
      const canAfford = !isMax && this.currentSave!.totalCrystals >= cost;

      const itemEl = document.createElement("div");
      itemEl.className = "shop-item-card";
      itemEl.innerHTML = `
        <div class="item-icon">${def.icon}</div>
        <div class="item-info">
          <div class="item-name">${def.name}</div>
          <div class="item-desc">${def.description}</div>
          <div class="item-level">Уровень: ${level} / ${def.maxLevel}</div>
        </div>
        <button class="btn-buy" ${!canAfford ? "disabled" : ""}>
          ${isMax ? "МАКС" : `💎 ${cost}`}
        </button>
      `;

      const buyBtn = itemEl.querySelector(".btn-buy") as HTMLButtonElement;
      if (!isMax) {
        buyBtn.addEventListener("click", () => {
          if (this.progression.buyUpgrade(this.currentSave!, def.id)) {
            this.render();
          }
        });
      }

      this.itemsGrid.appendChild(itemEl);
    });
  }
}
