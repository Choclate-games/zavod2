import * as THREE from "three";

export interface TouchInputState {
  moveVector: THREE.Vector2;
  isSprinting: boolean;
  isPulseTriggered: boolean;
  isDecoyTriggered: boolean;
  isJumpTriggered: boolean;
}

export class TouchControls {
  private container: HTMLElement;
  private joystickZone: HTMLElement;
  private joystickBase: HTMLElement;
  private joystickThumb: HTMLElement;
  private btnSonar: HTMLElement;
  private btnDecoy: HTMLElement;
  private btnSprint: HTMLElement;
  private btnJump: HTMLElement;

  private joystickPointerId: number | null = null;
  private joystickOriginX: number = 0;
  private joystickOriginY: number = 0;
  private readonly maxRadius: number = 60;
  private readonly deadZone: number = 0.08;

  public state: TouchInputState = {
    moveVector: new THREE.Vector2(0, 0),
    isSprinting: false,
    isPulseTriggered: false,
    isDecoyTriggered: false,
    isJumpTriggered: false
  };

  private activePointers: Set<number> = new Set();
  private isVisible: boolean = false;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "touch-controls";
    this.setupStyles();

    // 1. Left Half: Joystick Touch Zone
    this.joystickZone = document.createElement("div");
    this.joystickZone.className = "touch-zone-left";
    this.container.appendChild(this.joystickZone);

    this.joystickBase = document.createElement("div");
    this.joystickBase.className = "joystick-base";
    this.joystickThumb = document.createElement("div");
    this.joystickThumb.className = "joystick-thumb";
    this.joystickBase.appendChild(this.joystickThumb);
    this.joystickZone.appendChild(this.joystickBase);

    // 2. Right Half: Action Buttons
    const actionsZone = document.createElement("div");
    actionsZone.className = "touch-zone-right";
    this.container.appendChild(actionsZone);

    // Main Sonar Button (100px)
    this.btnSonar = document.createElement("button");
    this.btnSonar.className = "touch-btn btn-sonar";
    this.btnSonar.innerHTML = `<span class="btn-icon">📡</span><span class="btn-label">СОНАР</span>`;
    actionsZone.appendChild(this.btnSonar);

    // Side Action Buttons Cluster
    const sideCluster = document.createElement("div");
    sideCluster.className = "touch-btn-cluster";
    actionsZone.appendChild(sideCluster);

    // Decoy Button (68px)
    this.btnDecoy = document.createElement("button");
    this.btnDecoy.className = "touch-btn btn-action btn-decoy";
    this.btnDecoy.innerHTML = `<span class="btn-icon">🔊</span><span class="btn-label">МАЯК</span>`;
    sideCluster.appendChild(this.btnDecoy);

    // Jump Button (68px)
    this.btnJump = document.createElement("button");
    this.btnJump.className = "touch-btn btn-action btn-jump";
    this.btnJump.innerHTML = `<span class="btn-icon">⬆️</span><span class="btn-label">ПРЫЖОК</span>`;
    sideCluster.appendChild(this.btnJump);

    // Sprint Button (68px)
    this.btnSprint = document.createElement("button");
    this.btnSprint.className = "touch-btn btn-action btn-sprint";
    this.btnSprint.innerHTML = `<span class="btn-icon">⚡</span><span class="btn-label">БЕГ</span>`;
    sideCluster.appendChild(this.btnSprint);

    document.getElementById("ui-layer")?.appendChild(this.container);

    this.bindEvents();
    this.checkInitialVisibility();
  }

  private setupStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      #touch-controls {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        display: none;
        z-index: 15;
      }

      .touch-zone-left {
        position: absolute;
        top: 0;
        left: 0;
        width: 50%;
        height: 100%;
        pointer-events: auto;
        touch-action: none;
      }

      .joystick-base {
        position: absolute;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: rgba(0, 240, 255, 0.12);
        border: 2px solid rgba(0, 240, 255, 0.4);
        box-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
        transform: translate(-50%, -50%);
        display: none;
        pointer-events: none;
      }

      .joystick-thumb {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: radial-gradient(circle, #00f0ff 0%, #0088aa 100%);
        box-shadow: 0 0 15px #00f0ff;
        transform: translate(-50%, -50%);
      }

      .touch-zone-right {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 50%;
        height: 100%;
        display: flex;
        flex-direction: row-reverse;
        align-items: flex-end;
        gap: 16px;
        padding-right: calc(24px + env(safe-area-inset-right));
        padding-bottom: calc(24px + env(safe-area-inset-bottom));
        pointer-events: none;
      }

      .touch-btn {
        pointer-events: auto;
        touch-action: none;
        border: none;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: inherit;
        font-weight: bold;
        color: #fff;
        background: rgba(15, 23, 42, 0.85);
        cursor: pointer;
        transition: transform 0.1s, box-shadow 0.1s;
        -webkit-tap-highlight-color: transparent;
      }

      .touch-btn:active {
        transform: scale(0.92);
      }

      .btn-sonar {
        width: 100px;
        height: 100px;
        border: 3px solid #00f0ff;
        background: radial-gradient(circle, rgba(0,240,255,0.3) 0%, rgba(15,23,42,0.9) 100%);
        box-shadow: 0 0 25px rgba(0,240,255,0.4);
      }

      .btn-sonar .btn-icon { font-size: 32px; }
      .btn-sonar .btn-label { font-size: 11px; letter-spacing: 1px; color: #00f0ff; }

      .touch-btn-cluster {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;
      }

      .btn-action {
        width: 68px;
        height: 68px;
        border: 2px solid rgba(255,255,255,0.25);
      }

      .btn-action .btn-icon { font-size: 22px; }
      .btn-action .btn-label { font-size: 9px; letter-spacing: 0.5px; opacity: 0.9; }

      .btn-decoy {
        border-color: #bf55ec;
        background: radial-gradient(circle, rgba(191,85,236,0.3) 0%, rgba(15,23,42,0.9) 100%);
        box-shadow: 0 0 15px rgba(191,85,236,0.3);
      }
      .btn-decoy .btn-label { color: #bf55ec; }

      .btn-jump {
        border-color: #ffd700;
        background: radial-gradient(circle, rgba(255,215,0,0.25) 0%, rgba(15,23,42,0.9) 100%);
      }
      .btn-jump .btn-label { color: #ffd700; }

      .btn-sprint {
        border-color: #38bdf8;
      }
      .btn-sprint.active {
        background: rgba(56, 189, 248, 0.4);
        box-shadow: 0 0 15px #38bdf8;
      }
    `;
    document.head.appendChild(style);
  }

  private bindEvents(): void {
    // 1. Floating Joystick Pointer Events
    this.joystickZone.addEventListener("pointerdown", (e: PointerEvent) => {
      e.preventDefault();
      if (this.joystickPointerId !== null) return;

      this.joystickPointerId = e.pointerId;
      this.joystickZone.setPointerCapture(e.pointerId);

      this.joystickOriginX = e.clientX;
      this.joystickOriginY = e.clientY;

      this.joystickBase.style.left = `${e.clientX}px`;
      this.joystickBase.style.top = `${e.clientY}px`;
      this.joystickBase.style.display = "block";

      this.updateJoystickPosition(e.clientX, e.clientY);
    });

    this.joystickZone.addEventListener("pointermove", (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      e.preventDefault();
      this.updateJoystickPosition(e.clientX, e.clientY);
    });

    const endJoystick = (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this.joystickBase.style.display = "none";
      this.joystickThumb.style.transform = `translate(-50%, -50%)`;
      this.state.moveVector.set(0, 0);
    };

    this.joystickZone.addEventListener("pointerup", endJoystick);
    this.joystickZone.addEventListener("pointercancel", endJoystick);
    this.joystickZone.addEventListener("lostpointercapture", endJoystick);

    // 2. Action Buttons Events with pointerId handling
    const bindButton = (btn: HTMLElement, onDown: () => void, onUp?: () => void) => {
      const activeIds = new Set<number>();

      btn.addEventListener("pointerdown", (e: PointerEvent) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        activeIds.add(e.pointerId);
        onDown();
      });

      const release = (e: PointerEvent) => {
        activeIds.delete(e.pointerId);
        if (activeIds.size === 0 && onUp) {
          onUp();
        }
      };

      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointercancel", release);
      btn.addEventListener("lostpointercapture", release);
    };

    bindButton(this.btnSonar, () => {
      this.state.isPulseTriggered = true;
    });

    bindButton(this.btnDecoy, () => {
      this.state.isDecoyTriggered = true;
    });

    bindButton(this.btnJump, () => {
      this.state.isJumpTriggered = true;
    });

    bindButton(
      this.btnSprint,
      () => {
        this.state.isSprinting = true;
        this.btnSprint.classList.add("active");
      },
      () => {
        this.state.isSprinting = false;
        this.btnSprint.classList.remove("active");
      }
    );

    // Cancel default touch behaviors
    this.container.addEventListener("contextmenu", (e) => e.preventDefault());
    this.container.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    this.container.addEventListener("dragstart", (e) => e.preventDefault());

    // Window blur / visibility change
    window.addEventListener("blur", () => this.releaseAll());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.releaseAll();
    });
  }

  private updateJoystickPosition(clientX: number, clientY: number): void {
    const dx = clientX - this.joystickOriginX;
    const dy = clientY - this.joystickOriginY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, this.maxRadius);

    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;

    this.joystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;

    const rawMag = clampedDist / this.maxRadius;
    if (rawMag < this.deadZone) {
      this.state.moveVector.set(0, 0);
    } else {
      const mag = (rawMag - this.deadZone) / (1 - this.deadZone);
      // X = horizontal, Y = vertical (in Three.js world Z)
      this.state.moveVector.set(Math.cos(angle) * mag, Math.sin(angle) * mag);
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.container.style.display = visible ? "block" : "none";
    if (!visible) {
      this.releaseAll();
    }
  }

  public releaseAll(): void {
    this.joystickPointerId = null;
    this.joystickBase.style.display = "none";
    this.joystickThumb.style.transform = `translate(-50%, -50%)`;
    this.state.moveVector.set(0, 0);
    this.state.isSprinting = false;
    this.state.isPulseTriggered = false;
    this.state.isDecoyTriggered = false;
    this.state.isJumpTriggered = false;
    this.btnSprint.classList.remove("active");
  }

  public consumePulse(): boolean {
    const p = this.state.isPulseTriggered;
    this.state.isPulseTriggered = false;
    return p;
  }

  public consumeDecoy(): boolean {
    const d = this.state.isDecoyTriggered;
    this.state.isDecoyTriggered = false;
    return d;
  }

  public consumeJump(): boolean {
    const j = this.state.isJumpTriggered;
    this.state.isJumpTriggered = false;
    return j;
  }

  private checkInitialVisibility(): void {
    const forced = new URLSearchParams(location.search).get("touch");
    if (forced === "1") {
      this.setVisible(true);
      return;
    }
    if (forced === "0") {
      this.setVisible(false);
      return;
    }

    const isTouch =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.innerWidth < 900;

    // By default touch controls start hidden until expedition begins
    if (isTouch) {
      // Prepared for expedition
    }
  }
}
