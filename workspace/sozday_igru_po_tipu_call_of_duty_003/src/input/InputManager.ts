import { TouchControls } from './TouchControls';
import { EventBus } from '../core/EventBus';

export class InputManager {
  public isFocusPressed = false;
  public aimDeltaX = 0;
  public aimDeltaY = 0;
  public isPointerLocked = false;
  public touchControls: TouchControls;
  public onFireCallback?: () => void;
  public onZoomCallback?: (level: 4 | 8 | 16) => void;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.touchControls = new TouchControls();

    this.touchControls.onAimDeltaCallback = (dx, dy) => {
      this.aimDeltaX += dx;
      this.aimDeltaY += dy;
    };

    this.touchControls.onFireCallback = () => {
      this.onFireCallback?.();
    };

    this.touchControls.onZoomCallback = (lvl) => {
      this.onZoomCallback?.(lvl);
    };

    this.touchControls.onPauseCallback = () => {
      EventBus.emit('GAME_STATE_CHANGED', 'PAUSED');
    };

    this.setupDesktopListeners();
  }

  private setupDesktopListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'Space') {
        this.isFocusPressed = true;
      } else if (e.code === 'KeyQ') {
        this.onZoomCallback?.(4);
      } else if (e.code === 'KeyE') {
        this.onZoomCallback?.(16);
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        EventBus.emit('GAME_STATE_CHANGED', 'PAUSED');
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'Space') {
        this.isFocusPressed = false;
      }
    });

    this.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button === 0) { // Left click
        this.onFireCallback?.();
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (document.pointerLockElement === this.canvas) {
        this.aimDeltaX += e.movementX;
        this.aimDeltaY += e.movementY;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });
  }

  public requestPointerLock(): void {
    try {
      this.canvas.requestPointerLock();
    } catch {
      // Ignored
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  public consumeAimDelta(): { dx: number; dy: number } {
    const dx = this.aimDeltaX;
    const dy = this.aimDeltaY;
    this.aimDeltaX = 0;
    this.aimDeltaY = 0;
    return { dx, dy };
  }

  public getIsFocusActive(): boolean {
    return this.isFocusPressed || this.touchControls.isFocusPressed;
  }
}
