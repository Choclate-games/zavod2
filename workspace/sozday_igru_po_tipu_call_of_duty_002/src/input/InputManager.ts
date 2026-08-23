import { eventBus } from '../core/EventBus';

export interface InputSnapshot {
  moveX: number; // -1 to +1
  moveZ: number; // -1 to +1
  lookDeltaX: number;
  lookDeltaY: number;
  isFiring: boolean;
  fireJustPressed: boolean;
  isAiming: boolean;
  isSprinting: boolean;
  slidePressed: boolean;
  jumpPressed: boolean;
  uavPressed: boolean;
  pausePressed: boolean;
}

export class InputManager {
  private static instance: InputManager;

  // Desktop keyboard keys
  private keys: { [key: string]: boolean } = {};
  private mouseDeltaX: number = 0;
  private mouseDeltaY: number = 0;
  private isLmbDown: boolean = false;
  private lmbJustPressed: boolean = false;
  private isRmbDown: boolean = false;
  private isPointerLocked: boolean = false;
  private sensitivity: number = 1.0;

  // Touch controls input states
  public touchMoveX: number = 0;
  public touchMoveZ: number = 0;
  public touchLookDeltaX: number = 0;
  public touchLookDeltaY: number = 0;
  public touchFiring: boolean = false;
  public touchFireJustPressed: boolean = false;
  public touchAiming: boolean = false;
  public touchSlidePressed: boolean = false;
  public touchJumpPressed: boolean = false;
  public touchUavPressed: boolean = false;

  private constructor() {
    this.setupDesktopListeners();
  }

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  public setSensitivity(val: number): void {
    this.sensitivity = Math.max(0.1, val);
  }

  public requestPointerLock(element: HTMLElement): void {
    try {
      element.requestPointerLock();
    } catch {}
  }

  public unlockPointer(): void {
    try {
      document.exitPointerLock();
    } catch {}
  }

  private setupDesktopListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        eventBus.emit('GAME_STATE_CHANGED', 'PAUSED');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isLmbDown = true;
        this.lmbJustPressed = true;
      } else if (e.button === 2) {
        this.isRmbDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isLmbDown = false;
      } else if (e.button === 2) {
        this.isRmbDown = false;
      }
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement !== null;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouseDeltaX += e.movementX * 0.0022 * this.sensitivity;
        this.mouseDeltaY += e.movementY * 0.0022 * this.sensitivity;
      }
    });

    window.addEventListener('blur', () => {
      this.reset();
    });
  }

  public reset(): void {
    this.keys = {};
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.isLmbDown = false;
    this.lmbJustPressed = false;
    this.isRmbDown = false;

    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.touchLookDeltaX = 0;
    this.touchLookDeltaY = 0;
    this.touchFiring = false;
    this.touchFireJustPressed = false;
    this.touchAiming = false;
    this.touchSlidePressed = false;
    this.touchJumpPressed = false;
    this.touchUavPressed = false;
  }

  public getSnapshot(): InputSnapshot {
    // Desktop movement
    let moveX = 0;
    let moveZ = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;

    // Merge Touch movement
    if (Math.abs(this.touchMoveX) > 0.05) moveX = this.touchMoveX;
    if (Math.abs(this.touchMoveZ) > 0.05) moveZ = this.touchMoveZ;

    // Normalize diagonal
    const len = Math.hypot(moveX, moveZ);
    if (len > 1.0) {
      moveX /= len;
      moveZ /= len;
    }

    const isSprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || Math.hypot(this.touchMoveX, this.touchMoveZ) > 0.7);
    const slidePressed = Boolean(this.keys['KeyC'] || this.keys['ControlLeft'] || this.touchSlidePressed);
    const jumpPressed = Boolean(this.keys['Space'] || this.touchJumpPressed);
    const uavPressed = Boolean(this.keys['KeyE'] || this.keys['Digit4'] || this.touchUavPressed);
    const isFiring = this.isLmbDown || this.touchFiring;
    const fireJustPressed = this.lmbJustPressed || this.touchFireJustPressed;
    const isAiming = this.isRmbDown || this.touchAiming;

    const lookDeltaX = this.mouseDeltaX + this.touchLookDeltaX;
    const lookDeltaY = this.mouseDeltaY + this.touchLookDeltaY;

    // Reset per-frame impulse deltas
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.touchLookDeltaX = 0;
    this.touchLookDeltaY = 0;
    this.lmbJustPressed = false;
    this.touchFireJustPressed = false;
    this.touchSlidePressed = false;
    this.touchJumpPressed = false;
    this.touchUavPressed = false;

    return {
      moveX,
      moveZ,
      lookDeltaX,
      lookDeltaY,
      isFiring,
      fireJustPressed,
      isAiming,
      isSprinting,
      slidePressed,
      jumpPressed,
      uavPressed,
      pausePressed: Boolean(this.keys['KeyP'] || this.keys['Escape'])
    };
  }
}

export const inputManager = InputManager.getInstance();