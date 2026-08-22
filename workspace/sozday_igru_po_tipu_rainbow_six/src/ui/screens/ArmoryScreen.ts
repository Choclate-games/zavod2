import type { PlayerProgressSave, WeaponId, ShieldLevel } from "../../core/Types";
import { WEAPON_CONFIGS } from "../../gameplay/WeaponSystem";
import { SHIELD_CONFIGS } from "../../gameplay/ShieldController";

export class ArmoryScreen {
  public element: HTMLDivElement;
  private onBack: () => void;
  private onSaveUpdated: (save: Partial<PlayerProgressSave>) => void;
  private currentSave!: PlayerProgressSave;
  private creditsEl!: HTMLSpanElement;
  private listContainerEl!: HTMLDivElement;

  constructor(
    onBack: () => void,
    onSaveUpdated: (save: Partial<PlayerProgressSave>) => void
  ) {
    this.onBack = onBack;
    this.onSaveUpdated = onSaveUpdated;

    this.element = document.createElement("div");
    this.element.id = "screen-armory";
    this.element.style.position = "absolute";
    this.element.style.inset = "0";
    this.element.style.display = "flex";
    this.element.style.flexDirection = "column";
    this.element.style.backgroundColor = "rgba(13, 17, 23, 0.96)";
    this.element.style.zIndex = "var(--z-screen)";
    this.element.style.pointerEvents = "auto";
    this.element.style.padding = "20px";
    this.element.style.overflowY = "auto";

    this.buildDOM();
  }

  private buildDOM(): void {
    // Header
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "var(--space-md)";
    header.style.maxWidth = "800px";
    header.style.width = "100%";
    header.style.margin = "0 auto var(--space-md) auto";

    const title = document.createElement("h2");
    title.style.fontFamily = "var(--font-mono)";
    title.style.color = "var(--text-main)";
    title.style.margin = "0";
    title.textContent = "🛡️ ТАКТИЧЕСКИЙ АРСЕНАЛ";

    this.creditsEl = document.createElement("span");
    this.creditsEl.className = "tabular-nums";
    this.creditsEl.style.fontFamily = "var(--font-mono)";
    this.creditsEl.style.color = "var(--safe-success)";
    this.creditsEl.style.fontSize = "16px";
    this.creditsEl.style.fontWeight = "bold";
    this.creditsEl.textContent = "💵 500 CR";

    header.appendChild(title);
    header.appendChild(this.creditsEl);
    this.element.appendChild(header);

    // List container
    this.listContainerEl = document.createElement("div");
    this.listContainerEl.style.maxWidth = "800px";
    this.listContainerEl.style.width = "100%";
    this.listContainerEl.style.margin = "0 auto";
    this.listContainerEl.style.display = "flex";
    this.listContainerEl.style.flexDirection = "column";
    this.listContainerEl.style.gap = "var(--space-md)";
    this.element.appendChild(this.listContainerEl);

    // Back Button at bottom
    const footer = document.createElement("div");
    footer.style.maxWidth = "800px";
    footer.style.width = "100%";
    footer.style.margin = "var(--space-lg) auto 0 auto";

    const btnBack = document.createElement("button");
    btnBack.className = "tactical-btn";
    btnBack.style.width = "100%";
    btnBack.style.padding = "12px";
    btnBack.textContent = "◀ В ГЛАВНОЕ МЕНЮ";
    btnBack.onclick = () => this.onBack();
    footer.appendChild(btnBack);
    this.element.appendChild(footer);
  }

  updateSave(save: PlayerProgressSave): void {
    this.currentSave = save;
    this.creditsEl.textContent = `💵 ${save.credits} CR`;
    this.renderItems();
  }

  private renderItems(): void {
    this.listContainerEl.innerHTML = "";

    // Section 1: Weapons
    const sec1Title = document.createElement("h3");
    sec1Title.style.fontFamily = "var(--font-mono)";
    sec1Title.style.color = "var(--tactical-info)";
    sec1Title.style.fontSize = "14px";
    sec1Title.textContent = "🔫 СТРЕЛКОВОЕ ВООРУЖЕНИЕ";
    this.listContainerEl.appendChild(sec1Title);

    const weaponsGrid = document.createElement("div");
    weaponsGrid.style.display = "grid";
    weaponsGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(240px, 1fr))";
    weaponsGrid.style.gap = "12px";

    const weaponKeys: WeaponId[] = ["pistol_p9", "smg_mp5", "shotgun_m870", "revolver_rhino"];
    weaponKeys.forEach((id) => {
      const cfg = WEAPON_CONFIGS[id];
      const isUnlocked = this.currentSave.unlockedWeapons.includes(id);
      const isEquipped = this.currentSave.selectedWeapon === id;

      const card = document.createElement("div");
      card.className = `tactical-card ${isEquipped ? "active" : ""}`;
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.justifyContent = "space-between";
      card.style.gap = "8px";

      const nameRow = document.createElement("div");
      nameRow.style.fontWeight = "bold";
      nameRow.style.color = isEquipped ? "var(--tactical-info)" : "var(--text-main)";
      nameRow.textContent = cfg.name;

      const desc = document.createElement("div");
      desc.style.fontSize = "11px";
      desc.style.color = "var(--text-muted)";
      desc.textContent = cfg.description;

      const stats = document.createElement("div");
      stats.style.fontSize = "10px";
      stats.style.color = "var(--text-muted)";
      stats.textContent = `Калибр: ${cfg.caliber} | Урон: ${cfg.damage} | Магазин: ${cfg.magCapacity}`;

      const actionBtn = document.createElement("button");
      actionBtn.className = "tactical-btn";
      actionBtn.style.width = "100%";
      actionBtn.style.padding = "8px";

      if (isEquipped) {
        actionBtn.textContent = "✓ ЭКИПИРОВАНО";
        actionBtn.disabled = true;
      } else if (isUnlocked) {
        actionBtn.textContent = "ВЫБРАТЬ";
        actionBtn.onclick = () => {
          this.currentSave.selectedWeapon = id;
          this.onSaveUpdated({ selectedWeapon: id });
          this.renderItems();
        };
      } else {
        actionBtn.className = "tactical-btn primary";
        actionBtn.textContent = `КУПИТЬ (${cfg.cost} CR)`;
        if (this.currentSave.credits < cfg.cost) {
          actionBtn.disabled = true;
          actionBtn.style.opacity = "0.5";
        } else {
          actionBtn.onclick = () => {
            this.currentSave.credits -= cfg.cost;
            this.currentSave.unlockedWeapons.push(id);
            this.currentSave.selectedWeapon = id;
            this.onSaveUpdated({
              credits: this.currentSave.credits,
              unlockedWeapons: this.currentSave.unlockedWeapons,
              selectedWeapon: id,
            });
            this.renderItems();
          };
        }
      }

      card.appendChild(nameRow);
      card.appendChild(desc);
      card.appendChild(stats);
      card.appendChild(actionBtn);
      weaponsGrid.appendChild(card);
    });

    this.listContainerEl.appendChild(weaponsGrid);

    // Section 2: Shields
    const sec2Title = document.createElement("h3");
    sec2Title.style.fontFamily = "var(--font-mono)";
    sec2Title.style.color = "var(--tactical-info)";
    sec2Title.style.fontSize = "14px";
    sec2Title.style.marginTop = "14px";
    sec2Title.textContent = "🛡️ БАЛЛИСТИЧЕСКИЕ ЩИТЫ";
    this.listContainerEl.appendChild(sec2Title);

    const shieldGrid = document.createElement("div");
    shieldGrid.style.display = "grid";
    shieldGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(240px, 1fr))";
    shieldGrid.style.gap = "12px";

    const shieldLevels: ShieldLevel[] = [1, 2, 3];
    shieldLevels.forEach((lvl) => {
      const cfg = SHIELD_CONFIGS[lvl];
      const isEquipped = this.currentSave.shieldLevel === lvl;

      const card = document.createElement("div");
      card.className = `tactical-card ${isEquipped ? "active" : ""}`;
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.justifyContent = "space-between";
      card.style.gap = "8px";

      const nameRow = document.createElement("div");
      nameRow.style.fontWeight = "bold";
      nameRow.style.color = isEquipped ? "var(--tactical-info)" : "var(--text-main)";
      nameRow.textContent = cfg.name;

      const desc = document.createElement("div");
      desc.style.fontSize = "11px";
      desc.style.color = "var(--text-muted)";
      desc.textContent = cfg.description;

      const stats = document.createElement("div");
      stats.style.fontSize = "10px";
      stats.style.color = "var(--text-muted)";
      stats.textContent = `Прочность: ${cfg.maxHp} HP | Стекло: ${cfg.maxGlassHp} пуль | Вспышка: ${cfg.hasStrobe ? "ДА" : "НЕТ"}`;

      const actionBtn = document.createElement("button");
      actionBtn.className = "tactical-btn";
      actionBtn.style.width = "100%";
      actionBtn.style.padding = "8px";

      if (isEquipped) {
        actionBtn.textContent = "✓ АКТИВЕН";
        actionBtn.disabled = true;
      } else if (this.currentSave.shieldLevel >= lvl) {
        actionBtn.textContent = "ВЫБРАТЬ";
        actionBtn.onclick = () => {
          this.currentSave.shieldLevel = lvl;
          this.onSaveUpdated({ shieldLevel: lvl });
          this.renderItems();
        };
      } else {
        actionBtn.className = "tactical-btn primary";
        actionBtn.textContent = `УЛУЧШИТЬ (${cfg.cost} CR)`;
        if (this.currentSave.credits < cfg.cost) {
          actionBtn.disabled = true;
          actionBtn.style.opacity = "0.5";
        } else {
          actionBtn.onclick = () => {
            this.currentSave.credits -= cfg.cost;
            this.currentSave.shieldLevel = lvl;
            this.onSaveUpdated({
              credits: this.currentSave.credits,
              shieldLevel: lvl,
            });
            this.renderItems();
          };
        }
      }

      card.appendChild(nameRow);
      card.appendChild(desc);
      card.appendChild(stats);
      card.appendChild(actionBtn);
      shieldGrid.appendChild(card);
    });

    this.listContainerEl.appendChild(shieldGrid);
  }

  show(): void {
    this.element.style.display = "flex";
  }

  hide(): void {
    this.element.style.display = "none";
  }
}
