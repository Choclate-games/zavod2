import type { PlayerProgressSave } from "../../core/Types";

export class MainMenuScreen {
  public element: HTMLDivElement;
  private onStartAssault: () => void;
  private onOpenArmory: () => void;
  private onToggleSound: () => void;
  private creditsEl!: HTMLSpanElement;

  constructor(
    onStartAssault: () => void,
    onOpenArmory: () => void,
    onToggleSound: () => void
  ) {
    this.onStartAssault = onStartAssault;
    this.onOpenArmory = onOpenArmory;
    this.onToggleSound = onToggleSound;

    this.element = document.createElement("div");
    this.element.id = "screen-main-menu";
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
    card.style.maxWidth = "460px";
    card.style.width = "100%";
    card.style.textAlign = "center";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.alignItems = "center";
    card.style.gap = "var(--space-md)";

    // Game Title
    const title = document.createElement("h1");
    title.style.fontFamily = "var(--font-mono)";
    title.style.fontSize = "24px";
    title.style.color = "var(--text-main)";
    title.style.letterSpacing = "2px";
    title.style.margin = "0";
    title.textContent = "ТАКТИКА ПРОРЫВА";

    const subtitle = document.createElement("div");
    subtitle.style.fontFamily = "var(--font-mono)";
    subtitle.style.fontSize = "13px";
    subtitle.style.color = "var(--tactical-info)";
    subtitle.style.letterSpacing = "1.5px";
    subtitle.textContent = "CQB ШТУРМ: СПЕЦНАЗ";

    // Player Stats Bar
    const statsBar = document.createElement("div");
    statsBar.style.display = "flex";
    statsBar.style.gap = "18px";
    statsBar.style.marginTop = "8px";
    statsBar.style.fontFamily = "var(--font-mono)";
    statsBar.style.fontSize = "13px";

    this.creditsEl = document.createElement("span");
    this.creditsEl.className = "tabular-nums";
    this.creditsEl.style.color = "var(--safe-success)";
    this.creditsEl.textContent = "💵 500 CR";

    const opBadge = document.createElement("span");
    opBadge.style.color = "var(--text-muted)";
    opBadge.textContent = "РАНГ: ОПЕРАТИВНИК";

    statsBar.appendChild(this.creditsEl);
    statsBar.appendChild(opBadge);

    // Buttons Container
    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.flexDirection = "column";
    btnGroup.style.gap = "12px";
    btnGroup.style.width = "100%";
    btnGroup.style.marginTop = "12px";

    const btnStart = document.createElement("button");
    btnStart.className = "tactical-btn primary";
    btnStart.style.padding = "14px";
    btnStart.style.fontSize = "16px";
    btnStart.textContent = "🚀 НАЧАТЬ ШТУРМ ПОСОЛЬСТВА";
    btnStart.onclick = () => this.onStartAssault();

    const btnArmory = document.createElement("button");
    btnArmory.className = "tactical-btn";
    btnArmory.style.padding = "12px";
    btnArmory.textContent = "🛡️ ОРУЖЕЙНАЯ И СНАРЯЖЕНИЕ";
    btnArmory.onclick = () => this.onOpenArmory();

    const btnSound = document.createElement("button");
    btnSound.className = "tactical-btn";
    btnSound.style.padding = "10px";
    btnSound.style.fontSize = "12px";
    btnSound.textContent = "🔊 ЗВУК И МУЗЫКА";
    btnSound.onclick = () => this.onToggleSound();

    btnGroup.appendChild(btnStart);
    btnGroup.appendChild(btnArmory);
    btnGroup.appendChild(btnSound);

    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(statsBar);
    card.appendChild(btnGroup);

    this.element.appendChild(card);
  }

  updateSave(save: PlayerProgressSave): void {
    this.creditsEl.textContent = `💵 ${save.credits} CR`;
  }

  show(): void {
    this.element.style.display = "flex";
  }

  hide(): void {
    this.element.style.display = "none";
  }
}
