import type { WireColor } from "../../core/Types";

export class DefusalModal {
  public element: HTMLDivElement;
  private onCutWire: (color: WireColor) => void;
  private timerEl!: HTMLSpanElement;
  private statusEl!: HTMLDivElement;

  constructor(onCutWire: (color: WireColor) => void) {
    this.onCutWire = onCutWire;

    this.element = document.createElement("div");
    this.element.id = "modal-defusal";
    this.element.style.position = "absolute";
    this.element.style.inset = "0";
    this.element.style.display = "flex";
    this.element.style.justifyContent = "center";
    this.element.style.alignItems = "center";
    this.element.style.backgroundColor = "rgba(13, 17, 23, 0.88)";
    this.element.style.zIndex = "var(--z-modal)";
    this.element.style.pointerEvents = "auto";
    this.element.style.padding = "20px";
    this.element.style.display = "none";

    this.buildDOM();
  }

  private buildDOM(): void {
    const card = document.createElement("div");
    card.className = "tactical-card";
    card.style.maxWidth = "420px";
    card.style.width = "100%";
    card.style.textAlign = "center";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "var(--space-md)";

    const title = document.createElement("h2");
    title.style.fontFamily = "var(--font-mono)";
    title.style.color = "var(--critical-danger)";
    title.style.margin = "0";
    title.textContent = "⚠️ ОБЕЗВРЕЖИВАНИЕ СВУ";

    this.timerEl = document.createElement("div");
    this.timerEl.className = "tabular-nums";
    this.timerEl.style.fontFamily = "var(--font-mono)";
    this.timerEl.style.fontSize = "32px";
    this.timerEl.style.fontWeight = "bold";
    this.timerEl.style.color = "var(--critical-danger)";
    this.timerEl.textContent = "25.00s";

    const prompt = document.createElement("div");
    prompt.style.fontFamily = "var(--font-mono)";
    prompt.style.fontSize = "12px";
    prompt.style.color = "var(--text-muted)";
    prompt.textContent = "Перережьте правильный провод детонатора:";

    this.statusEl = document.createElement("div");
    this.statusEl.style.fontFamily = "var(--font-mono)";
    this.statusEl.style.fontSize = "12px";
    this.statusEl.style.minHeight = "18px";
    this.statusEl.style.color = "var(--tactical-info)";

    // 3 Cut Buttons
    const wiresGroup = document.createElement("div");
    wiresGroup.style.display = "flex";
    wiresGroup.style.flexDirection = "column";
    wiresGroup.style.gap = "10px";

    const btnRed = document.createElement("button");
    btnRed.className = "tactical-btn danger";
    btnRed.style.padding = "12px";
    btnRed.textContent = "✂️ СРЕЗАТЬ КРАСНЫЙ ПРОВОД";
    btnRed.onclick = () => this.onCutWire("red");

    const btnBlue = document.createElement("button");
    btnBlue.className = "tactical-btn";
    btnBlue.style.borderColor = "var(--tactical-info)";
    btnBlue.style.color = "var(--tactical-info)";
    btnBlue.style.padding = "12px";
    btnBlue.textContent = "✂️ СРЕЗАТЬ СИНИЙ ПРОВОД";
    btnBlue.onclick = () => this.onCutWire("blue");

    const btnYellow = document.createElement("button");
    btnYellow.className = "tactical-btn";
    btnYellow.style.borderColor = "var(--color-primary)";
    btnYellow.style.color = "var(--color-primary)";
    btnYellow.style.padding = "12px";
    btnYellow.textContent = "✂️ СРЕЗАТЬ ЖЕЛТЫЙ ПРОВОД";
    btnYellow.onclick = () => this.onCutWire("yellow");

    wiresGroup.appendChild(btnRed);
    wiresGroup.appendChild(btnBlue);
    wiresGroup.appendChild(btnYellow);

    card.appendChild(title);
    card.appendChild(this.timerEl);
    card.appendChild(prompt);
    card.appendChild(this.statusEl);
    card.appendChild(wiresGroup);

    this.element.appendChild(card);
  }

  updateTimer(remainingSeconds: number): void {
    const sec = Math.max(0, remainingSeconds).toFixed(2);
    this.timerEl.textContent = `${sec}s`;
  }

  showWarning(msg: string): void {
    this.statusEl.textContent = msg;
    this.statusEl.style.color = "var(--critical-danger)";
  }

  show(): void {
    this.statusEl.textContent = "";
    this.element.style.display = "flex";
  }

  hide(): void {
    this.element.style.display = "none";
  }
}
