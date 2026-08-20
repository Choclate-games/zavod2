export interface InputState {
  moveX: number; // -1 to 1
  moveY: number; // -1 to 1
  lookAngle: number; // radians
  isAttacking: boolean;
  isHeavyAttacking: boolean;
  isDashing: boolean;
  isTackling: boolean;
  pointerWorldX: number;
  pointerWorldZ: number;
}

export class InputManager {
  private state: InputState = {
    moveX: 0,
    moveY: 0,
    lookAngle: 0,
    isAttacking: false,
    isHeavyAttacking: false,
    isDashing: false,
    isTackling: false,
    pointerWorldX: 0,
    pointerWorldZ: 0,
  };

  private keys: Set<string> = new Set();
  private isPointerDown: boolean = false;
  private virtualMoveX: number = 0;
  private virtualMoveY: number = 0;
  private virtualAttack: boolean = false;
  private virtualDash: boolean = false;
  private virtualTackle: boolean = false;

  constructor() {
    this.setupKeyboard();
    this.setupWindowGuards();
  }

  public getState(): InputState {
    // Combine keyboard and virtual joystick inputs
    let kx = 0;
    let ky = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;

    // Normalize keyboard vector if moving diagonally
    if (kx !== 0 && ky !== 0) {
      const invLen = 1 / Math.SQRT2;
      kx *= invLen;
      ky *= invLen;
    }

    // Merge keyboard + virtual joystick
    const combinedX = Math.max(-1, Math.min(1, kx + this.virtualMoveX));
    const combinedY = Math.max(-1, Math.min(1, ky + this.virtualMoveY));

    this.state.moveX = combinedX;
    this.state.moveY = combinedY;

    // Actions
    const keyAttack = this.keys.has('KeyJ') || this.isPointerDown;
    const keyHeavy = this.keys.has('KeyK');
    const keyDash = this.keys.has('Space') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    this.state.isAttacking = keyAttack || this.virtualAttack;
    this.state.isHeavyAttacking = keyHeavy;
    this.state.isDashing = keyDash || this.virtualDash;
    this.state.isTackling = this.virtualTackle || (this.keys.has('KeyF') || this.keys.has('KeyE'));

    return this.state;
  }

  public setVirtualMove(x: number, y: number): void {
    this.virtualMoveX = x;
    this.virtualMoveY = y;
  }

  public setVirtualAttack(active: boolean): void {
    this.virtualAttack = active;
  }

  public setVirtualDash(active: boolean): void {
    this.virtualDash = active;
  }

  public setVirtualTackle(active: boolean): void {
    this.virtualTackle = active;
  }

  public setPointerWorldPos(x: number, z: number): void {
    this.state.pointerWorldX = x;
    this.state.pointerWorldZ = z;
  }

  public setPointerDown(down: boolean): void {
    this.isPointerDown = down;
  }

  public reset(): void {
    this.keys.clear();
    this.isPointerDown = false;
    this.virtualMoveX = 0;
    this.virtualMoveY = 0;
    this.virtualAttack = false;
    this.virtualDash = false;
    this.virtualTackle = false;
    this.state.moveX = 0;
    this.state.moveY = 0;
    this.state.isAttacking = false;
    this.state.isHeavyAttacking = false;
    this.state.isDashing = false;
    this.state.isTackling = false;
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  private setupWindowGuards(): void {
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.reset();
      }
    });
  }
}
