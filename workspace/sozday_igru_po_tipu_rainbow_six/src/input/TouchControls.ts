import type { InputSnapshot } from "../core/Types";

export class TouchControls {
  private container: HTMLDivElement;
  private isVisible = false;

  // Joystick state
  private stickPointerId: number | null = null;
  private stickStartX = 0;
  private stickStartY = 0;
  private stickDeltaX = 0;
  private stickDeltaY = 0;
  private stickBaseEl!: HTMLDivElement;
  private stickKnobEl!: HTMLDivElement;

  // Aim pad state
  private aimPointerId: number | null = null;
  private lastAimX = 0;
  private lastAimY = 0;
  private aimDeltaX = 0;
  private aimDeltaY = 0;

  // Action states
  private isShieldHold = false;
  private isLeanLeft = false;
  private isLeanRight = false;
  private primaryFireJustPressed = false;
  private reloadJustPressed = false;
  private detonateJustPressed = false;
  private reconJustPressed = false;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "touch-controls-layer";
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.left = "0";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.pointerEvents = "none";
    this.container.style.zIndex = "25";
    this.container.style.display = "none";
    this.container.style.touchAction = "none";

    document.getElementById("ui-root")?.appendChild(this.container);

    this.buildTouchDOM();
    this.bindTouchEvents();
  }

  private buildTouchDOM(): void {
    // Joystick Base & Knob
    this.stickBaseEl = document.createElement("div");
    this.stickBaseEl.style.position = "absolute";
    this.stickBaseEl.style.width = "110px";
    this.stickBaseEl.style.height = "110px";
    this.stickBaseEl.style.borderRadius = "50%";
    this.stickBaseEl.style.border = "2px solid rgba(77, 238, 234, 0.4)";
    this.stickBaseEl.style.backgroundColor = "rgba(13, 17, 23, 0.5)";
    this.stickBaseEl.style.display = "none";
    this.stickBaseEl.style.transform = "translate(-50%, -50%)";
    this.stickBaseEl.style.pointerEvents = "none";

    this.stickKnobEl = document.createElement("div");
    this.stickKnobEl.style.position = "absolute";
    this.stickKnobEl.style.width = "46px";
    this.stickKnobEl.style.height = "46px";
    this.stickKnobEl.style.borderRadius = "50%";
    this.stickKnobEl.style.backgroundColor = "#4deeea";
    this.stickKnobEl.style.top = "50%";
    this.stickKnobEl.style.left = "50%";
    this.stickKnobEl.style.transform = "translate(-50%, -50%)";
    this.stickBaseEl.appendChild(this.stickKnobEl);
    this.container.appendChild(this.stickBaseEl);

    // Left Lean & Shield Buttons Group
    const leftGroup = document.createElement("div");
    leftGroup.style.position = "absolute";
    leftGroup.style.bottom = "calc(20px + env(safe-area-inset-bottom, 0px))";
    leftGroup.style.left = "calc(20px + env(safe-area-inset-left, 0px))";
    leftGroup.style.display = "flex";
    leftGroup.style.flexDirection = "column";
    leftGroup.style.gap = "14px";
    leftGroup.style.pointerEvents = "auto";

    const btnShield = this.createButton("🛡️ ЩИТ", "72px", "48px");
    btnShield.addEventListener("pointerdown", () => { this.isShieldHold = true; });
    btnShield.addEventListener("pointerup", () => { this.isShieldHold = false; });
    btnShield.addEventListener("pointercancel", () => { this.isShieldHold = false; });

    const leanRow = document.createElement("div");
    leanRow.style.display = "flex";
    leanRow.style.gap = "10px";

    const btnLeanL = this.createButton("◀ LEAN", "64px", "48px");
    btnLeanL.addEventListener("pointerdown", () => { this.isLeanLeft = true; });
    btnLeanL.addEventListener("pointerup", () => { this.isLeanLeft = false; });
    btnLeanL.addEventListener("pointercancel", () => { this.isLeanLeft = false; });

    const btnLeanR = this.createButton("LEAN ▶", "64px", "48px");
    btnLeanR.addEventListener("pointerdown", () => { this.isLeanRight = true; });
    btnLeanR.addEventListener("pointerup", () => { this.isLeanRight = false; });
    btnLeanR.addEventListener("pointercancel", () => { this.isLeanRight = false; });

    leanRow.appendChild(btnLeanL);
    leanRow.appendChild(btnLeanR);

    leftGroup.appendChild(btnShield);
    leftGroup.appendChild(leanRow);
    this.container.appendChild(leftGroup);

    // Bottom Center Prominent C4 Breach / Detonate Button
    const btnDetonate = this.createButton("💥 C4 ПОДРЫВ", "140px", "64px", () => {
      this.detonateJustPressed = true;
    });
    btnDetonate.style.position = "absolute";
    btnDetonate.style.bottom = "calc(16px + env(safe-area-inset-bottom, 0px))";
    btnDetonate.style.left = "50%";
    btnDetonate.style.transform = "translateX(-50%)";
    btnDetonate.style.backgroundColor = "rgba(255, 106, 0, 0.85)";
    btnDetonate.style.borderColor = "#ff6a00";
    btnDetonate.style.fontSize = "14px";
    btnDetonate.style.fontWeight = "bold";
    btnDetonate.style.pointerEvents = "auto";
    this.container.appendChild(btnDetonate);

    // Right Side Action Buttons Group (Reload & Fire)
    const rightGroup = document.createElement("div");
    rightGroup.style.position = "absolute";
    rightGroup.style.bottom = "calc(20px + env(safe-area-inset-bottom, 0px))";
    rightGroup.style.right = "calc(20px + env(safe-area-inset-right, 0px))";
    rightGroup.style.display = "flex";
    rightGroup.style.flexDirection = "column";
    rightGroup.style.alignItems = "flex-end";
    rightGroup.style.gap = "14px";
    rightGroup.style.pointerEvents = "auto";

    const btnReload = this.createButton("🔄 РЕЛОАД", "80px", "48px", () => {
      this.reloadJustPressed = true;
    });

    const btnFire = this.createButton("🎯 ОГОНЬ", "96px", "72px", () => {
      this.primaryFireJustPressed = true;
    });
    btnFire.style.backgroundColor = "rgba(255, 30, 39, 0.8)";
    btnFire.style.borderColor = "#ff1e27";
    btnFire.style.fontWeight = "bold";

    rightGroup.appendChild(btnReload);
    rightGroup.appendChild(btnFire);
    this.container.appendChild(rightGroup);

    // Top Right Recon Wand Button
    const btnRecon = this.createButton("📷 ЗОНД", "74px", "44px", () => {
      this.reconJustPressed = true;
    });
    btnRecon.style.position = "absolute";
    btnRecon.style.top = "calc(16px + env(safe-area-inset-top, 0px))";
    btnRecon.style.right = "calc(16px + env(safe-area-inset-right, 0px))";
    btnRecon.style.pointerEvents = "auto";
    btnRecon.style.borderColor = "#00ff66";
    btnRecon.style.color = "#00ff66";
    this.container.appendChild(btnRecon);
  }

  private createButton(
    label: string,
    width: string,
    height: string,
    onClick?: () => void
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.minWidth = width;
    btn.style.height = height;
    btn.style.backgroundColor = "rgba(26, 30, 36, 0.75)";
    btn.style.border = "1px solid #4deeea";
    btn.style.borderRadius = "6px";
    btn.style.color = "#ffffff";
    btn.style.fontFamily = "'Roboto Mono', monospace";
    btn.style.fontSize = "12px";
    btn.style.padding = "4px 8px";
    btn.style.touchAction = "none";
    btn.style.userSelect = "none";

    if (onClick) {
      btn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        onClick();
      });
    }

    return btn;
  }

  private bindTouchEvents(): void {
    window.addEventListener("pointerdown", (e) => {
      if (!this.isVisible) return;
      if ((e.target as HTMLElement).tagName === "BUTTON") return;

      const halfW = window.innerWidth / 2;

      if (e.clientX < halfW && this.stickPointerId === null) {
        this.stickPointerId = e.pointerId;
        this.stickStartX = e.clientX;
        this.stickStartY = e.clientY;
        this.stickDeltaX = 0;
        this.stickDeltaY = 0;

        this.stickBaseEl.style.left = `${e.clientX}px`;
        this.stickBaseEl.style.top = `${e.clientY}px`;
        this.stickBaseEl.style.display = "block";
      } else if (e.clientX >= halfW && this.aimPointerId === null) {
        this.aimPointerId = e.pointerId;
        this.lastAimX = e.clientX;
        this.lastAimY = e.clientY;
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (!this.isVisible) return;

      if (e.pointerId === this.stickPointerId) {
        const dx = e.clientX - this.stickStartX;
        const dy = e.clientY - this.stickStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxRadius = 45;

        const clampedDist = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);

        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;

        this.stickKnobEl.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

        if (dist > maxRadius * 0.08) {
          this.stickDeltaX = knobX / maxRadius;
          this.stickDeltaY = knobY / maxRadius;
        } else {
          this.stickDeltaX = 0;
          this.stickDeltaY = 0;
        }
      } else if (e.pointerId === this.aimPointerId) {
        this.aimDeltaX += (e.clientX - this.lastAimX) * 1.5;
        this.aimDeltaY += (e.clientY - this.lastAimY) * 1.5;
        this.lastAimX = e.clientX;
        this.lastAimY = e.clientY;
      }
    });

    const endPointer = (e: PointerEvent) => {
      if (e.pointerId === this.stickPointerId) {
        this.stickPointerId = null;
        this.stickDeltaX = 0;
        this.stickDeltaY = 0;
        this.stickBaseEl.style.display = "none";
      } else if (e.pointerId === this.aimPointerId) {
        this.aimPointerId = null;
      }
    };

    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);
  }

  sample(out: InputSnapshot): void {
    if (!this.isVisible) return;

    out.moveX += this.stickDeltaX;
    out.moveZ -= this.stickDeltaY;

    out.aimDeltaX += this.aimDeltaX;
    out.aimDeltaY += this.aimDeltaY;

    out.shieldHold = out.shieldHold || this.isShieldHold;
    out.leanLeft = out.leanLeft || this.isLeanLeft;
    out.leanRight = out.leanRight || this.isLeanRight;

    out.primaryFireJustPressed = out.primaryFireJustPressed || this.primaryFireJustPressed;
    out.reloadJustPressed = out.reloadJustPressed || this.reloadJustPressed;
    out.detonateJustPressed = out.detonateJustPressed || this.detonateJustPressed;
    out.reconToggleJustPressed = out.reconToggleJustPressed || this.reconJustPressed;

    this.aimDeltaX = 0;
    this.aimDeltaY = 0;
    this.primaryFireJustPressed = false;
    this.reloadJustPressed = false;
    this.detonateJustPressed = false;
    this.reconJustPressed = false;
  }

  show(): void {
    this.isVisible = true;
    this.container.style.display = "block";
  }

  hide(): void {
    this.isVisible = false;
    this.container.style.display = "none";
    this.reset();
  }

  reset(): void {
    this.stickPointerId = null;
    this.stickDeltaX = 0;
    this.stickDeltaY = 0;
    if (this.stickBaseEl) this.stickBaseEl.style.display = "none";

    this.aimPointerId = null;
    this.aimDeltaX = 0;
    this.aimDeltaY = 0;

    this.isShieldHold = false;
    this.isLeanLeft = false;
    this.isLeanRight = false;
    this.primaryFireJustPressed = false;
    this.reloadJustPressed = false;
    this.detonateJustPressed = false;
    this.reconJustPressed = false;
  }
}
