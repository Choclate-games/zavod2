import { VehicleControls } from '../types/vehicle';
import { eventBus } from './EventBus';

export class InputManager {
  private static instance: InputManager;
  private controls: VehicleControls = {
    throttle: 0,
    steering: 0,
    handbrake: false,
    nitro: false,
  };

  private keys: Record<string, boolean> = {};
  public isTouchDevice = false;

  // Touch Directional Drag State
  private touchTargetAngle: number | null = null;
  private touchMagnitude = 0;
  private touchHandbrake = false;
  private touchNitro = false;

  private constructor() {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.setupKeyboard();
    this.setupVisibilityHandler();
  }

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        eventBus.emit('TOGGLE_PAUSE');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.reset();
    });
  }

  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.reset();
        eventBus.emit('WINDOW_HIDDEN');
      }
    });
  }

  public setTouchDirection(targetAngle: number | null, magnitude: number): void {
    this.touchTargetAngle = targetAngle;
    this.touchMagnitude = Math.max(0, Math.min(1, magnitude));
  }

  public setTouchHandbrake(val: boolean): void {
    this.touchHandbrake = val;
  }

  public setTouchNitro(val: boolean): void {
    this.touchNitro = val;
  }

  public reset(): void {
    this.keys = {};
    this.touchTargetAngle = null;
    this.touchMagnitude = 0;
    this.touchHandbrake = false;
    this.touchNitro = false;
    this.controls = {
      throttle: 0,
      steering: 0,
      handbrake: false,
      nitro: false,
    };
  }

  public update(currentVehicleHeading = 0): VehicleControls {
    // Keyboard inputs
    let forward = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;

    let steer = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) steer += 1;

    const handbrakeKey = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyF']);
    const nitroKey = !!(this.keys['Space'] || this.keys['KeyE']);

    let finalThrottle = forward;
    let finalSteer = steer;

    // Direct Directional Touch Input: Player drags finger towards desired direction
    if (this.touchTargetAngle !== null && this.touchMagnitude > 0.05) {
      let diff = this.touchTargetAngle - currentVehicleHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      // Turning: Steer smoothly into target direction
      // When diff > 0 (target is clockwise), steer < 0 increases heading towards target
      finalSteer = -Math.max(-1, Math.min(1, diff * 1.8));

      // Throttle: Accelerate towards dragged direction
      finalThrottle = this.touchMagnitude;
    }

    this.controls.throttle = finalThrottle;
    this.controls.steering = finalSteer;
    this.controls.handbrake = handbrakeKey || this.touchHandbrake;
    this.controls.nitro = nitroKey || this.touchNitro;

    return this.controls;
  }

  public getControls(): VehicleControls {
    return this.controls;
  }
}

export const inputManager = InputManager.getInstance();
