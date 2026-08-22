export class PauseModal {
  public element: HTMLDivElement;
  private onResume: () => void;
  private onRestart: () => void;
  private onToggleSound: () => void;
  private onMainMenu: () => void;

  constructor(
    onResume: () => void,
    onRestart: () => void,
    onToggleSound: () => void,
    onMainMenu: () => void
  ) {
    this.onResume = onResume;
    this.onRestart = onRestart;
    this.onToggleSound = onToggleSound;
    this.onMainMenu = onMainMenu;

    this.element = document.createElement("div");
    this.element.id = "modal-pause";
    this.element.style.position = "absolute";
    this.element.style.inset = "0";
    this.element.style.display = "flex";
    this.element.style.justifyContent = "center";
    this.element.style.alignItems = "center";
    this.element.style.backgroundColor = "rgba(13, 17, 23, 0.9)";
    this.element.style.zIndex = "var(--z-modal)";
    this.element.style.pointerEvents = "auto";
    this.element.style.padding = "20px";
    this.element.style.display = "none";

    this.buildDOM();
  }

  private buildDOM(): void {
    const card = document.createElement("div");
    card.className = "tactical-card";
    card.style.maxWidth = "380px";
    card.style.width = "100%";
    card.style.textAlign = "center";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "var(--space-md)";

    const title = document.createElement("h2");
    title.style.fontFamily = "var(--font-mono)";
    title.style.color = "var(--tactical-info)";
    title.style.margin = "0";
    title.textContent = "⏸️ ТАКТИЧЕСКАЯ ПАУЗА";

    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.flexDirection = "column";
    btnGroup.style.gap = "10px";
    btnGroup.style.width = "100%";
    btnGroup.style.marginTop = "8px";

    const btnResume = document.createElement("button");
    btnResume.className = "tactical-btn primary";
    btnResume.style.padding = "12px";
    btnResume.textContent = "▶ ПРОДОЛЖИТЬ БОЙ";
    btnResume.onclick = () => this.onResume();

    const btnRestart = document.createElement("button");
    btnRestart.className = "tactical-btn";
    btnRestart.style.padding = "10px";
    btnRestart.textContent = "🔄 РЕСТАРТ СЕКТОРА";
    btnRestart.onclick = () => this.onRestart();

    const btnSound = document.createElement("button");
    btnSound.className = "tactical-btn";
    btnSound.style.padding = "10px";
    btnSound.textContent = "🔊 ЗВУК ВКЛ / ВЫКЛ";
    btnSound.onclick = () => this.onToggleSound();

    const btnMenu = document.createElement("button");
    btnMenu.className = "tactical-btn";
    btnMenu.style.padding = "10px";
    btnMenu.textContent = "◀ ВЫЙТИ В МЕНЮ";
    btnMenu.onclick = () => this.onMainMenu();

    btnGroup.appendChild(btnResume);
    btnGroup.appendChild(btnRestart);
    btnGroup.appendChild(btnSound);
    btnGroup.appendChild(btnMenu);

    card.appendChild(title);
    card.appendChild(btnGroup);

    this.element.appendChild(card);
  }

  show(): void {
    this.element.style.display = "flex";
  }

  hide(): void {
    this.element.style.display = "none";
  }
}
