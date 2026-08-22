export class GameOverModal {
  public element: HTMLDivElement;
  private onRevive: () => void;
  private onRetry: () => void;
  private onMainMenu: () => void;

  private reasonEl!: HTMLDivElement;
  private btnReviveEl!: HTMLButtonElement;

  constructor(
    onRevive: () => void,
    onRetry: () => void,
    onMainMenu: () => void
  ) {
    this.onRevive = onRevive;
    this.onRetry = onRetry;
    this.onMainMenu = onMainMenu;

    this.element = document.createElement("div");
    this.element.id = "modal-game-over";
    this.element.style.position = "absolute";
    this.element.style.inset = "0";
    this.element.style.display = "flex";
    this.element.style.justifyContent = "center";
    this.element.style.alignItems = "center";
    this.element.style.backgroundColor = "rgba(13, 17, 23, 0.92)";
    this.element.style.zIndex = "var(--z-modal)";
    this.element.style.pointerEvents = "auto";
    this.element.style.padding = "20px";
    this.element.style.display = "none";

    this.buildDOM();
  }

  private buildDOM(): void {
    const card = document.createElement("div");
    card.className = "tactical-card";
    card.style.maxWidth = "440px";
    card.style.width = "100%";
    card.style.textAlign = "center";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "var(--space-md)";

    const title = document.createElement("h2");
    title.style.fontFamily = "var(--font-mono)";
    title.style.color = "var(--critical-danger)";
    title.style.margin = "0";
    title.textContent = "☠️ ОПЕРАЦИЯ ПРОВАЛЕНА";

    this.reasonEl = document.createElement("div");
    this.reasonEl.style.fontFamily = "var(--font-mono)";
    this.reasonEl.style.fontSize = "13px";
    this.reasonEl.style.color = "var(--text-muted)";
    this.reasonEl.textContent = "Оперативник нейтрализован в бою.";

    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.flexDirection = "column";
    btnGroup.style.gap = "10px";
    btnGroup.style.width = "100%";
    btnGroup.style.marginTop = "8px";

    this.btnReviveEl = document.createElement("button");
    this.btnReviveEl.className = "tactical-btn success";
    this.btnReviveEl.style.padding = "12px";
    this.btnReviveEl.textContent = "💉 ТАКТИЧЕСКИЙ МЕДПАКЕТ (РЕКЛАМА)";
    this.btnReviveEl.onclick = () => this.onRevive();

    const btnRetry = document.createElement("button");
    btnRetry.className = "tactical-btn primary";
    btnRetry.style.padding = "12px";
    btnRetry.textContent = "🔄 ПОВТОРИТЬ ШТУРМ";
    btnRetry.onclick = () => this.onRetry();

    const btnMenu = document.createElement("button");
    btnMenu.className = "tactical-btn";
    btnMenu.style.padding = "10px";
    btnMenu.textContent = "◀ В ГЛАВНОЕ МЕНЮ";
    btnMenu.onclick = () => this.onMainMenu();

    btnGroup.appendChild(this.btnReviveEl);
    btnGroup.appendChild(btnRetry);
    btnGroup.appendChild(btnMenu);

    card.appendChild(title);
    card.appendChild(this.reasonEl);
    card.appendChild(btnGroup);

    this.element.appendChild(card);
  }

  setup(reason: string, canRevive: boolean): void {
    this.reasonEl.textContent = reason;
    this.btnReviveEl.style.display = canRevive ? "block" : "none";
  }

  show(): void {
    this.element.style.display = "flex";
  }

  hide(): void {
    this.element.style.display = "none";
  }
}
