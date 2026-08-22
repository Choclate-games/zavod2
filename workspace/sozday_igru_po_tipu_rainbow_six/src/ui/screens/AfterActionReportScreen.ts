import type { AssaultStats } from "../../core/Types";

export class AfterActionReportScreen {
  public element: HTMLDivElement;
  private onNextRoom: () => void;
  private onDoubleReward: () => void;
  private onMainMenu: () => void;

  private titleEl!: HTMLHeadingElement;
  private rankEl!: HTMLDivElement;
  private starsEl!: HTMLDivElement;
  private statsContainerEl!: HTMLDivElement;
  private rewardTextEl!: HTMLSpanElement;
  private btnDoubleEl!: HTMLButtonElement;
  private btnNextEl!: HTMLButtonElement;

  public currentStats!: AssaultStats;
  public isDoubled = false;

  constructor(
    onNextRoom: () => void,
    onDoubleReward: () => void,
    onMainMenu: () => void
  ) {
    this.onNextRoom = onNextRoom;
    this.onDoubleReward = onDoubleReward;
    this.onMainMenu = onMainMenu;

    this.element = document.createElement("div");
    this.element.id = "screen-after-action";
    this.element.style.position = "absolute";
    this.element.style.inset = "0";
    this.element.style.display = "flex";
    this.element.style.justifyContent = "center";
    this.element.style.alignItems = "center";
    this.element.style.backgroundColor = "rgba(13, 17, 23, 0.95)";
    this.element.style.zIndex = "var(--z-screen)";
    this.element.style.pointerEvents = "auto";
    this.element.style.padding = "20px";

    this.buildDOM();
  }

  private buildDOM(): void {
    const card = document.createElement("div");
    card.className = "tactical-card";
    card.style.maxWidth = "480px";
    card.style.width = "100%";
    card.style.textAlign = "center";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.alignItems = "center";
    card.style.gap = "var(--space-sm)";

    this.titleEl = document.createElement("h2");
    this.titleEl.style.fontFamily = "var(--font-mono)";
    this.titleEl.style.color = "var(--safe-success)";
    this.titleEl.style.margin = "0";
    this.titleEl.textContent = "СЕКТОР ЗАЧИЩЕН!";

    this.rankEl = document.createElement("div");
    this.rankEl.style.fontFamily = "var(--font-mono)";
    this.rankEl.style.fontSize = "38px";
    this.rankEl.style.fontWeight = "bold";
    this.rankEl.style.color = "var(--tactical-info)";
    this.rankEl.textContent = "РАНГ S";

    this.starsEl = document.createElement("div");
    this.starsEl.style.fontSize = "22px";
    this.starsEl.style.color = "var(--color-primary)";
    this.starsEl.textContent = "⭐⭐⭐";

    this.statsContainerEl = document.createElement("div");
    this.statsContainerEl.style.width = "100%";
    this.statsContainerEl.style.backgroundColor = "rgba(0, 0, 0, 0.35)";
    this.statsContainerEl.style.border = "1px solid var(--border-color)";
    this.statsContainerEl.style.borderRadius = "var(--radius-sm)";
    this.statsContainerEl.style.padding = "10px";
    this.statsContainerEl.style.margin = "8px 0";
    this.statsContainerEl.style.fontFamily = "var(--font-mono)";
    this.statsContainerEl.style.fontSize = "12px";
    this.statsContainerEl.style.textAlign = "left";
    this.statsContainerEl.style.lineHeight = "1.6";

    const rewardRow = document.createElement("div");
    rewardRow.style.display = "flex";
    rewardRow.style.justifyContent = "space-between";
    rewardRow.style.width = "100%";
    rewardRow.style.fontFamily = "var(--font-mono)";
    rewardRow.style.fontSize = "14px";
    rewardRow.style.fontWeight = "bold";

    const rewardLabel = document.createElement("span");
    rewardLabel.style.color = "var(--text-muted)";
    rewardLabel.textContent = "НАГРАДА ЗА ОПЕРАЦИЮ:";

    this.rewardTextEl = document.createElement("span");
    this.rewardTextEl.className = "tabular-nums";
    this.rewardTextEl.style.color = "var(--safe-success)";
    this.rewardTextEl.textContent = "+450 CR";

    rewardRow.appendChild(rewardLabel);
    rewardRow.appendChild(this.rewardTextEl);

    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.flexDirection = "column";
    btnGroup.style.gap = "10px";
    btnGroup.style.width = "100%";
    btnGroup.style.marginTop = "10px";

    this.btnDoubleEl = document.createElement("button");
    this.btnDoubleEl.className = "tactical-btn";
    this.btnDoubleEl.style.borderColor = "var(--color-primary)";
    this.btnDoubleEl.style.color = "var(--color-primary)";
    this.btnDoubleEl.style.padding = "12px";
    this.btnDoubleEl.textContent = "🎁 УДВОИТЬ НАГРАДУ (РЕКЛАМА)";
    this.btnDoubleEl.onclick = () => this.onDoubleReward();

    this.btnNextEl = document.createElement("button");
    this.btnNextEl.className = "tactical-btn primary";
    this.btnNextEl.style.padding = "14px";
    this.btnNextEl.textContent = "➡️ СЛЕДУЮЩИЙ СЕКТОР";
    this.btnNextEl.onclick = () => this.onNextRoom();

    const btnMenu = document.createElement("button");
    btnMenu.className = "tactical-btn";
    btnMenu.style.padding = "10px";
    btnMenu.textContent = "◀ В ГЛАВНОЕ МЕНЮ";
    btnMenu.onclick = () => this.onMainMenu();

    btnGroup.appendChild(this.btnDoubleEl);
    btnGroup.appendChild(this.btnNextEl);
    btnGroup.appendChild(btnMenu);

    card.appendChild(this.titleEl);
    card.appendChild(this.rankEl);
    card.appendChild(this.starsEl);
    card.appendChild(this.statsContainerEl);
    card.appendChild(rewardRow);
    card.appendChild(btnGroup);

    this.element.appendChild(card);
  }

  setup(stats: AssaultStats, isFinalRoom: boolean): void {
    this.currentStats = stats;
    this.isDoubled = false;
    this.btnDoubleEl.style.display = "block";
    this.btnDoubleEl.disabled = false;

    this.rankEl.textContent = `РАНГ ${stats.rank}`;
    this.starsEl.textContent = "⭐".repeat(stats.stars);

    const accuracy =
      stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 100;

    this.statsContainerEl.innerHTML = `
      <div style="display:flex; justify-content:space-between;">
        <span>Время зачистки:</span>
        <strong class="tabular-nums">${stats.durationSeconds}с</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Точность стрельбы:</span>
        <strong class="tabular-nums">${accuracy}% (${stats.shotsHit}/${stats.shotsFired})</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Хедшоты:</span>
        <strong style="color:var(--critical-danger);" class="tabular-nums">${stats.headshots}</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Убийств прорывом C4:</span>
        <strong style="color:var(--color-primary);" class="tabular-nums">${stats.breachKills}</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Целостность щита:</span>
        <strong style="color:var(--tactical-info);" class="tabular-nums">${stats.shieldIntegrityPercent}%</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:4px; border-top:1px dashed var(--border-color); padding-top:4px;">
        <span>Тактические очки:</span>
        <strong style="color:var(--text-main);" class="tabular-nums">${stats.score} PTS</strong>
      </div>
    `;

    this.rewardTextEl.textContent = `+${stats.creditsEarned} CR`;

    if (isFinalRoom) {
      this.titleEl.textContent = "🏆 ПОСОЛЬСТВО ПОЛНОСТЬЮ ЗАЧИЩЕНО!";
      this.btnNextEl.textContent = "🏆 ЗАВЕРШИТЬ ОПЕРАЦИЮ";
    } else {
      this.titleEl.textContent = "СЕКТОР ЗАЧИЩЕН!";
      this.btnNextEl.textContent = "➡️ СЛЕДУЮЩИЙ СЕКТОР";
    }
  }

  setRewardDoubled(newTotalCredits: number): void {
    this.isDoubled = true;
    this.btnDoubleEl.disabled = true;
    this.btnDoubleEl.textContent = "✓ НАГРАДА УДВОЕНА";
    this.rewardTextEl.textContent = `+${newTotalCredits} CR (2X)`;
  }

  show(): void {
    this.element.style.display = "flex";
  }

  hide(): void {
    this.element.style.display = "none";
  }
}
