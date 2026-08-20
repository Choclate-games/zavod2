import { VirtualJoystick } from '../ui/VirtualJoystick';

export interface InputSnapshot {
  moveX: number;
  moveY: number;
  isMoving: boolean;
  attackJustPressed: boolean;
  attackHeld: boolean;
  dashJustPressed: boolean;
  sonarJustPressed: boolean;
  pauseJustPressed: boolean;
}

export class InputManager {
  private static instance: InputManager;
  private joystick: VirtualJoystick | null = null;

  private keys = new Map<string, boolean>();
  private prevKeys = new Map<string, boolean>();

  private touchAttackPointers = new Set<number>();
  private touchDashPointers = new Set<number>();
  private touchSonarPointers = new Set<number>();

  private attackJustTriggered = false;
  private dashJustTriggered = false;
  private sonarJustTriggered = false;
  private pauseJustTriggered = false;

  public isTouchDevice = false;

  private constructor() {
    this.detectTouchDevice();
    this.setupKeyboardListeners();
    this.setupTouchButtons();

    window.addEventListener('blur', () => this.resetAll());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.resetAll();
    });
  }

  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  setJoystick(joystick: VirtualJoystick): void {
    this.joystick = joystick;
  }

  private detectTouchDevice(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('touch') === '1') {
      this.isTouchDevice = true;
      return;
    }
    if (params.get('touch') === '0') {
      this.isTouchDevice = false;
      return;
    }
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.set(e.code, true);

      if (e.code === 'KeyJ' || e.code === 'Space') {
        this.attackJustTriggered = true;
      }
      if (e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.dashJustTriggered = true;
      }
      if (e.code === 'KeyE' || e.code === 'KeyQ') {
        this.sonarJustTriggered = true;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.pauseJustTriggered = true;
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keys.set(e.code, false);
    });

    // Mouse bindings
    window.addEventListener('mousedown', (e: MouseEvent) => {
      // If clicking inside canvas
      if ((e.target as HTMLElement)?.id === 'game-canvas') {
        if (e.button === 0) {
          this.keys.set('MouseLeft', true);
          this.attackJustTriggered = true;
        } else if (e.button === 2) {
          this.keys.set('MouseRight', true);
          this.dashJustTriggered = true;
        }
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) this.keys.set('MouseLeft', false);
      if (e.button === 2) this.keys.set('MouseRight', false);
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  private setupTouchButtons(): void {
    const bindButton = (id: string, pointerSet: Set<number>, onTrigger: () => void) => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
        pointerSet.add(e.pointerId);
        onTrigger();
      });

      const release = (e: PointerEvent) => {
        pointerSet.delete(e.pointerId);
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {}
      };

      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
    };

    bindButton('btn-touch-attack', this.touchAttackPointers, () => {
      this.attackJustTriggered = true;
    });

    bindButton('btn-touch-dash', this.touchDashPointers, () => {
      this.dashJustTriggered = true;
    });

    bindButton('btn-touch-sonar', this.touchSonarPointers, () => {
      this.sonarJustTriggered = true;
    });
  }

  getSnapshot(): InputSnapshot {
    let moveX = 0;
    let moveY = 0;

    // 1. Keyboard
    if (this.keys.get('KeyW') || this.keys.get('ArrowUp')) moveY -= 1;
    if (this.keys.get('KeyS') || this.keys.get('ArrowDown')) moveY += 1;
    if (this.keys.get('KeyA') || this.keys.get('ArrowLeft')) moveX -= 1;
    if (this.keys.get('KeyD') || this.keys.get('ArrowRight')) moveX += 1;

    // Normalize keyboard diagonal
    const keyLen = Math.hypot(moveX, moveY);
    if (keyLen > 0) {
      moveX /= keyLen;
      moveY /= keyLen;
    }

    // 2. Joystick blend
    if (this.joystick && this.joystick.isActive) {
      moveX = this.joystick.axisX;
      moveY = this.joystick.axisY;
    }

    const isMoving = Math.hypot(moveX, moveY) > 0.05;

    const attackHeld =
      Boolean(this.keys.get('KeyJ')) ||
      Boolean(this.keys.get('Space')) ||
      Boolean(this.keys.get('MouseLeft')) ||
      this.touchAttackPointers.size > 0;

    const snapshot: InputSnapshot = {
      moveX,
      moveY,
      isMoving,
      attackJustPressed: this.attackJustTriggered,
      attackHeld,
      dashJustPressed: this.dashJustTriggered,
      sonarJustPressed: this.sonarJustTriggered,
      pauseJustPressed: this.pauseJustTriggered,
    };

    // Reset single-frame triggers
    this.attackJustTriggered = false;
    this.dashJustTriggered = false;
    this.sonarJustTriggered = false;
    this.pauseJustTriggered = false;

    return snapshot;
  }

  resetAll(): void {
    this.keys.clear();
    this.prevKeys.clear();
    this.touchAttackPointers.clear();
    this.touchDashPointers.clear();
    this.touchSonarPointers.clear();
    this.attackJustTriggered = false;
    this.dashJustTriggered = false;
    this.sonarJustTriggered = false;
    this.pauseJustTriggered = false;
    if (this.joystick) {
      this.joystick.reset();
    }
  }
}

export const inputManager = InputManager.getInstance();
