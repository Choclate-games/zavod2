export interface InputState {
  moveX: number;
  moveZ: number;
  isKickPressed: boolean;
  isKickJustPressed: boolean;
  isShootPressed: boolean;
  isShootJustPressed: boolean;
  isDashJustPressed: boolean;
  isAbilityJustPressed: boolean;
  aimAngle: number; // in radians
  aimTargetX: number;
  aimTargetZ: number;
}

export class InputManager {
  private static instance: InputManager;

  private keys: Set<string> = new Set();
  private prevKeys: Set<string> = new Set();

  private virtualMoveX: number = 0;
  private virtualMoveZ: number = 0;

  private virtualKick: boolean = false;
  private virtualKickPrev: boolean = false;

  private virtualShoot: boolean = false;
  private virtualShootPrev: boolean = false;

  private virtualDash: boolean = false;
  private virtualDashPrev: boolean = false;

  private virtualAbility: boolean = false;
  private virtualAbilityPrev: boolean = false;

  private mouseScreenX: number = window.innerWidth / 2;
  private mouseScreenY: number = window.innerHeight / 2;
  private aimAngle: number = 0;

  private isEnabled: boolean = true;

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.isEnabled) return;
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('pointermove', (e) => {
      this.mouseScreenX = e.clientX;
      this.mouseScreenY = e.clientY;
      const dx = this.mouseScreenX - window.innerWidth / 2;
      const dy = this.mouseScreenY - window.innerHeight / 2;
      this.aimAngle = Math.atan2(dy, dx);
    });

    window.addEventListener('pointerdown', (e) => {
      if (!this.isEnabled) return;
      if (e.target instanceof HTMLCanvasElement) {
        if (e.button === 0) {
          this.keys.add('PointerLeft');
        } else if (e.button === 2) {
          this.keys.add('PointerRight');
        }
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) {
        this.keys.delete('PointerLeft');
      } else if (e.button === 2) {
        this.keys.delete('PointerRight');
      }
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.reset();
      }
    });
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  public setVirtualJoystick(x: number, y: number): void {
    this.virtualMoveX = x;
    this.virtualMoveZ = y;
    if (Math.abs(x) > 0.01 || Math.abs(y) > 0.01) {
      this.aimAngle = Math.atan2(y, x);
    }
  }

  public setVirtualKick(pressed: boolean): void {
    this.virtualKick = pressed;
  }

  public setVirtualShoot(pressed: boolean): void {
    this.virtualShoot = pressed;
  }

  public setVirtualDash(pressed: boolean): void {
    this.virtualDash = pressed;
  }

  public setVirtualAbility(pressed: boolean): void {
    this.virtualAbility = pressed;
  }

  public getState(): InputState {
    let mx = this.virtualMoveX;
    let mz = this.virtualMoveZ;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;

    const len = Math.hypot(mx, mz);
    if (len > 1.0) {
      mx /= len;
      mz /= len;
    }

    const isKickRaw = this.keys.has('KeyE') || this.keys.has('KeyK') || this.keys.has('PointerRight') || this.virtualKick;
    const isKickPrevRaw = this.prevKeys.has('KeyE') || this.prevKeys.has('KeyK') || this.prevKeys.has('PointerRight') || this.virtualKickPrev;
    const isKickJustPressed = isKickRaw && !isKickPrevRaw;

    const isShootRaw = this.keys.has('KeyJ') || this.keys.has('PointerLeft') || this.virtualShoot;
    const isShootPrevRaw = this.prevKeys.has('KeyJ') || this.prevKeys.has('PointerLeft') || this.virtualShootPrev;
    const isShootJustPressed = isShootRaw && !isShootPrevRaw;

    const isDashRaw = this.keys.has('Space') || this.keys.has('ShiftLeft') || this.virtualDash;
    const isDashPrevRaw = this.prevKeys.has('Space') || this.prevKeys.has('ShiftLeft') || this.virtualDashPrev;
    const isDashJustPressed = isDashRaw && !isDashPrevRaw;

    const isAbilityRaw = this.keys.has('KeyQ') || this.keys.has('KeyF') || this.virtualAbility;
    const isAbilityPrevRaw = this.prevKeys.has('KeyQ') || this.prevKeys.has('KeyF') || this.virtualAbilityPrev;
    const isAbilityJustPressed = isAbilityRaw && !isAbilityPrevRaw;

    return {
      moveX: mx,
      moveZ: mz,
      isKickPressed: isKickRaw,
      isKickJustPressed,
      isShootPressed: isShootRaw,
      isShootJustPressed,
      isDashJustPressed,
      isAbilityJustPressed,
      aimAngle: this.aimAngle,
      aimTargetX: 0,
      aimTargetZ: 0
    };
  }

  public endFrame(): void {
    this.prevKeys = new Set(this.keys);
    this.virtualKickPrev = this.virtualKick;
    this.virtualShootPrev = this.virtualShoot;
    this.virtualDashPrev = this.virtualDash;
    this.virtualAbilityPrev = this.virtualAbility;
  }

  public reset(): void {
    this.keys.clear();
    this.prevKeys.clear();
    this.virtualMoveX = 0;
    this.virtualMoveZ = 0;
    this.virtualKick = false;
    this.virtualKickPrev = false;
    this.virtualShoot = false;
    this.virtualShootPrev = false;
    this.virtualDash = false;
    this.virtualDashPrev = false;
    this.virtualAbility = false;
    this.virtualAbilityPrev = false;
  }
}
