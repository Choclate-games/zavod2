import { UpgradeCard } from "../utils/Constants";

export class CardModal {
  public container: HTMLElement;
  private cardsRow: HTMLElement;
  private btnReroll: HTMLElement;
  private onSelectCallback: (card: UpgradeCard) => void;
  private onRerollCallback: () => void;

  constructor(
    onSelect: (card: UpgradeCard) => void,
    onReroll: () => void
  ) {
    this.onSelectCallback = onSelect;
    this.onRerollCallback = onReroll;

    this.container = document.createElement("div");
    this.container.id = "card-modal-layer";
    this.setupStyles();

    this.container.innerHTML = `
      <div class="card-modal-backdrop">
        <div class="card-modal-panel interactive">
          <div class="card-modal-header">
            <h2 class="card-modal-title">СЕЙСМИЧЕСКАЯ СТАНЦИЯ: МОДИФИКАЦИЯ LIDAR</h2>
            <p class="card-modal-sub">Выберите 1 из 3 акустических протоколов сканера</p>
          </div>

          <div id="cards-row" class="cards-row"></div>

          <div class="card-modal-footer">
            <button id="btn-reroll-cards" class="btn-secondary interactive">
              🎲 Переброс протоколов (Реклама)
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("ui-layer")?.appendChild(this.container);

    this.cardsRow = document.getElementById("cards-row")!;
    this.btnReroll = document.getElementById("btn-reroll-cards")!;

    this.btnReroll.addEventListener("click", () => this.onRerollCallback());
  }

  private setupStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      #card-modal-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        display: none;
        z-index: 20;
      }

      .card-modal-backdrop {
        width: 100%;
        height: 100%;
        background: rgba(2, 6, 15, 0.85);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      }

      .card-modal-panel {
        background: rgba(10, 18, 32, 0.95);
        border: 2px solid #00f0ff;
        border-radius: 16px;
        padding: 24px 32px;
        max-width: 900px;
        width: 90%;
        box-shadow: 0 0 35px rgba(0, 240, 255, 0.25);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }

      .card-modal-header {
        text-align: center;
      }

      .card-modal-title {
        color: #00f0ff;
        font-size: 20px;
        letter-spacing: 1.5px;
        margin-bottom: 4px;
      }

      .card-modal-sub {
        color: #94a3b8;
        font-size: 13px;
      }

      .cards-row {
        display: flex;
        gap: 16px;
        justify-content: center;
        flex-wrap: wrap;
        width: 100%;
      }

      .upgrade-card-item {
        background: rgba(15, 23, 42, 0.9);
        border-radius: 12px;
        padding: 20px 16px;
        width: 220px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
        border: 2px solid #475569;
      }

      .upgrade-card-item:hover {
        transform: translateY(-6px);
      }

      .upgrade-card-item.common { border-color: #00f0ff; box-shadow: 0 0 15px rgba(0, 240, 255, 0.2); }
      .upgrade-card-item.rare { border-color: #38bdf8; box-shadow: 0 0 18px rgba(56, 189, 248, 0.35); }
      .upgrade-card-item.epic { border-color: #bf55ec; box-shadow: 0 0 20px rgba(191, 85, 236, 0.4); }
      .upgrade-card-item.legendary { border-color: #ffd700; box-shadow: 0 0 25px rgba(255, 215, 0, 0.5); }

      .card-icon { font-size: 40px; }
      .card-name { font-size: 16px; font-weight: bold; color: #fff; }
      .card-rarity { font-size: 11px; text-transform: uppercase; font-weight: bold; }

      .card-rarity.common { color: #00f0ff; }
      .card-rarity.rare { color: #38bdf8; }
      .card-rarity.epic { color: #bf55ec; }
      .card-rarity.legendary { color: #ffd700; }

      .card-desc { font-size: 12px; color: #cbd5e1; line-height: 1.4; }

      .btn-secondary {
        background: rgba(30, 41, 59, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #e2e8f0;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.15s;
      }

      .btn-secondary:hover {
        background: rgba(51, 65, 85, 0.9);
      }
    `;
    document.head.appendChild(style);
  }

  public show(cards: UpgradeCard[], allowRerollAd: boolean = true): void {
    this.cardsRow.innerHTML = "";
    cards.forEach((card) => {
      const cardEl = document.createElement("div");
      cardEl.className = `upgrade-card-item ${card.rarity}`;
      cardEl.innerHTML = `
        <div class="card-icon">${card.icon}</div>
        <div class="card-rarity ${card.rarity}">${card.rarity}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-desc">${card.description}</div>
      `;

      cardEl.addEventListener("click", () => {
        this.hide();
        this.onSelectCallback(card);
      });

      this.cardsRow.appendChild(cardEl);
    });

    this.btnReroll.style.display = allowRerollAd ? "inline-block" : "none";
    this.container.style.display = "block";
  }

  public hide(): void {
    this.container.style.display = "none";
  }
}
