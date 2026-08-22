import type { RoomConfig, BreachPointData, ExplosiveId } from "../../core/Types";

export class BreachPlanningScreen {
  public element: HTMLDivElement;
  private onConfirmAssault: (selectedPoint: BreachPointData, explosiveId: ExplosiveId) => void;
  private onBack: () => void;

  private currentRoom!: RoomConfig;
  private selectedPointIndex = 0;
  private selectedExplosiveId: ExplosiveId = "c4_standard";

  private titleEl!: HTMLHeadingElement;
  private subtitleEl!: HTMLDivElement;
  private descEl!: HTMLDivElement;
  private intelEl!: HTMLDivElement;
  private pointsContainerEl!: HTMLDivElement;
  private explosiveSelectEl!: HTMLSelectElement;

  constructor(
    onConfirmAssault: (selectedPoint: BreachPointData, explosiveId: ExplosiveId) => void,
    onBack: () => void
  ) {
    this.onConfirmAssault = onConfirmAssault;
    this.onBack = onBack;

    this.element = document.createElement("div");
    this.element.id = "screen-breach-planning";
    this.element.style.position = "absolute";
    this.element.style.inset = "0";
    this.element.style.display = "flex";
    this.element.style.flexDirection = "column";
    this.element.style.justifyContent = "center";
    this.element.style.alignItems = "center";
    this.element.style.backgroundColor = "rgba(13, 17, 23, 0.94)";
    this.element.style.zIndex = "var(--z-screen)";
    this.element.style.pointerEvents = "auto";
    this.element.style.padding = "20px";

    this.buildDOM();
  }

  private buildDOM(): void {
    const card = document.createElement("div");
    card.className = "tactical-card";
    card.style.maxWidth = "520px";
    card.style.width = "100%";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "var(--space-md)";

    this.titleEl = document.createElement("h2");
    this.titleEl.style.fontFamily = "var(--font-mono)";
    this.titleEl.style.color = "var(--text-main)";
    this.titleEl.style.margin = "0";
    this.titleEl.textContent = "БРИФИНГ ШТУРМА";

    this.subtitleEl = document.createElement("div");
    this.subtitleEl.style.fontFamily = "var(--font-mono)";
    this.subtitleEl.style.color = "var(--tactical-info)";
    this.subtitleEl.style.fontSize = "12px";
    this.subtitleEl.textContent = "СЕКТОР 1/3";

    this.descEl = document.createElement("div");
    this.descEl.style.fontFamily = "var(--font-mono)";
    this.descEl.style.fontSize = "12px";
    this.descEl.style.color = "var(--text-muted)";
    this.descEl.style.lineHeight = "1.5";

    this.intelEl = document.createElement("div");
    this.intelEl.style.backgroundColor = "rgba(0, 0, 0, 0.35)";
    this.intelEl.style.border = "1px dashed var(--border-color)";
    this.intelEl.style.borderRadius = "var(--radius-sm)";
    this.intelEl.style.padding = "8px 12px";
    this.intelEl.style.fontFamily = "var(--font-mono)";
    this.intelEl.style.fontSize = "11px";
    this.intelEl.style.color = "var(--safe-success)";

    const pointsLabel = document.createElement("div");
    pointsLabel.style.fontFamily = "var(--font-mono)";
    pointsLabel.style.fontSize = "12px";
    pointsLabel.style.color = "var(--text-main)";
    pointsLabel.style.fontWeight = "bold";
    pointsLabel.textContent = "1. ВЫБЕРИТЕ ВЕКТОР ПРОРЫВА:";

    this.pointsContainerEl = document.createElement("div");
    this.pointsContainerEl.style.display = "flex";
    this.pointsContainerEl.style.flexDirection = "column";
    this.pointsContainerEl.style.gap = "8px";

    const expLabel = document.createElement("div");
    expLabel.style.fontFamily = "var(--font-mono)";
    expLabel.style.fontSize = "12px";
    expLabel.style.color = "var(--text-main)";
    expLabel.style.fontWeight = "bold";
    expLabel.textContent = "2. ТИП ПРОБИВНОГО ЗАРЯДА:";

    this.explosiveSelectEl = document.createElement("select");
    this.explosiveSelectEl.style.backgroundColor = "var(--bg-card)";
    this.explosiveSelectEl.style.color = "var(--text-main)";
    this.explosiveSelectEl.style.border = "1px solid var(--border-color)";
    this.explosiveSelectEl.style.padding = "8px";
    this.explosiveSelectEl.style.borderRadius = "var(--radius-sm)";
    this.explosiveSelectEl.style.fontFamily = "var(--font-mono)";

    const c4Opt = document.createElement("option");
    c4Opt.value = "c4_standard";
    c4Opt.textContent = "Пластичный C4 (Базовый)";

    const thermiteOpt = document.createElement("option");
    thermiteOpt.value = "thermite_x";
    thermiteOpt.textContent = "Термо-лента Thermite-X (Армированные стены)";

    const heavyOpt = document.createElement("option");
    heavyOpt.value = "heavy_c4";
    heavyOpt.textContent = "Кумулятивный Молот (Тяжелый взрыв)";

    this.explosiveSelectEl.appendChild(c4Opt);
    this.explosiveSelectEl.appendChild(thermiteOpt);
    this.explosiveSelectEl.appendChild(heavyOpt);

    this.explosiveSelectEl.onchange = (e) => {
      this.selectedExplosiveId = (e.target as HTMLSelectElement).value as ExplosiveId;
    };

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "tactical-btn primary";
    btnConfirm.style.padding = "14px";
    btnConfirm.style.fontSize = "15px";
    btnConfirm.textContent = "💥 ВЗЛОМАТЬ И НАЧАТЬ ШТУРМ";
    btnConfirm.onclick = () => {
      const pt = this.currentRoom.breachPoints[this.selectedPointIndex];
      this.onConfirmAssault(pt, this.selectedExplosiveId);
    };

    const btnBack = document.createElement("button");
    btnBack.className = "tactical-btn";
    btnBack.style.padding = "10px";
    btnBack.textContent = "◀ НАЗАД В МЕНЮ";
    btnBack.onclick = () => this.onBack();

    card.appendChild(this.titleEl);
    card.appendChild(this.subtitleEl);
    card.appendChild(this.descEl);
    card.appendChild(this.intelEl);
    card.appendChild(pointsLabel);
    card.appendChild(this.pointsContainerEl);
    card.appendChild(expLabel);
    card.appendChild(this.explosiveSelectEl);
    card.appendChild(btnConfirm);
    card.appendChild(btnBack);

    this.element.appendChild(card);
  }

  setup(room: RoomConfig): void {
    this.currentRoom = room;
    this.selectedPointIndex = 0;
    this.selectedExplosiveId = room.id === 3 ? "thermite_x" : "c4_standard";
    this.explosiveSelectEl.value = this.selectedExplosiveId;

    this.titleEl.textContent = `ШТУРМ: ${room.name}`;
    this.subtitleEl.textContent = room.subtitle;
    this.descEl.textContent = room.description;

    const enemyCount = room.enemies.length;
    const hasTrap = room.tripmines.length > 0;
    const hasBomb = !!room.bomb;

    this.intelEl.innerHTML = `
      <strong>ДАННЫЕ РАЗВЕДКИ:</strong><br/>
      • Противников в секторе: ${enemyCount}<br/>
      • Лазерные растяжки: ${hasTrap ? "ОБНАРУЖЕНЫ (1 шт)" : "НЕТ"}<br/>
      • Взрывное устройство: ${hasBomb ? "АКТИВНО (25 сек)" : "НЕТ"}
    `;

    this.renderPoints();
  }

  private renderPoints(): void {
    this.pointsContainerEl.innerHTML = "";

    this.currentRoom.breachPoints.forEach((pt, idx) => {
      const isSelected = idx === this.selectedPointIndex;
      const btn = document.createElement("button");
      btn.className = `tactical-btn ${isSelected ? "primary" : ""}`;
      btn.style.width = "100%";
      btn.style.justifyContent = "space-between";
      btn.style.padding = "10px 14px";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = pt.name;

      const typeSpan = document.createElement("span");
      typeSpan.style.fontSize = "11px";
      typeSpan.style.opacity = "0.8";
      typeSpan.textContent = pt.isReinforced ? "[АРМИРОВАНО]" : "[СТАНДАРТ]";

      btn.appendChild(nameSpan);
      btn.appendChild(typeSpan);

      btn.onclick = () => {
        this.selectedPointIndex = idx;
        this.renderPoints();
      };

      this.pointsContainerEl.appendChild(btn);
    });
  }

  show(): void {
    this.element.style.display = "flex";
  }

  hide(): void {
    this.element.style.display = "none";
  }
}
