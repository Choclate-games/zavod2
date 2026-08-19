import { eventBus } from '../core/EventBus';

export interface InputSnapshot {
  steerX: number;
  turboActive: boolean;
  pauseTriggered: boolean;
}

export class InputManager {
  private static instance: InputManager;

  // Keyboard state
  private keyLeft: boolean = false;
  private keyRight: boolean = false;
  private keyTurbo: boolean = false;
  private keyPause: boolean = false;

  // Touch state (fed by TouchControls)
  public touchSteerX: number = 0;
  public touchTurboActive: boolean = false;

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  constructor() {
    this.setupKeyboard();
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keyLeft = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keyRight = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown' || e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.keyTurbo = true;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        eventBus.emit('ui:toggle_pause');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keyLeft = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keyRight = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown' || e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.keyTurbo = false;
      }
    });

    window.addEventListener('blur', () => this.reset());
  }

  public getSnapshot(): InputSnapshot {
    let steerX = 0;
    if (this.keyLeft) steerX -= 1;
    if (this.keyRight) steerX += 1;

    // Merge touch steer if active
    if (Math.abs(this.touchSteerX) > 0.05) {
      steerX = this.touchSteerX;
    }

    const turboActive = this.keyTurbo || this.touchTurboActive;

    return {
      steerX: Math.max(-1, Math.min(1, steerX)),
      turboActive,
      pauseTriggered: this.keyPause,
    };
  }

  public reset(): void {
    this.keyLeft = false;
    this.keyRight = false;
    this.keyTurbo = false;
    this.keyPause = false;
    this.touchSteerX = 0;
    this.touchTurboActive = false;
  }
}

export const inputManager = InputManager.getInstance();
