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

  // Touch virtual inputs
  private touchThrottle = 0;
  private touchSteering = 0;
  private touchHandbrake = false;
  private touchNitro = false;
  private touchBrake = false;

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

  public setTouchSteering(val: number): void {
    this.touchSteering = Math.max(-1, Math.min(1, val));
  }

  public setTouchThrottle(val: number): void {
    this.touchThrottle = Math.max(-1, Math.min(1, val));
  }

  public setTouchHandbrake(val: boolean): void {
    this.touchHandbrake = val;
  }

  public setTouchNitro(val: boolean): void {
    this.touchNitro = val;
  }

  /** Резкий рывок руля вниз = торможение, без отдельной педали. */
  public setTouchBrake(val: boolean): void {
    this.touchBrake = val;
  }

  public reset(): void {
    this.keys = {};
    this.touchThrottle = 0;
    this.touchSteering = 0;
    this.touchHandbrake = false;
    this.touchNitro = false;
    this.touchBrake = false;
    this.controls = {
      throttle: 0,
      steering: 0,
      handbrake: false,
      nitro: false,
    };
  }

  public update(): VehicleControls {
    // Keyboard inputs
    let forward = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;

    let steer = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) steer += 1;

    const handbrakeKey = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyF']);
    const nitroKey = !!(this.keys['Space'] || this.keys['KeyE']);

    // Клавиатура и тач живут параллельно: активен тот источник, которым
    // сейчас действительно управляют, поэтому отладка мышью не блокирует WASD.
    let finalThrottle = Math.abs(this.touchThrottle) > 0.05 ? this.touchThrottle : forward;
    if (this.touchBrake) finalThrottle = -1;
    const finalSteer = Math.abs(this.touchSteering) > 0.01 ? this.touchSteering : steer;

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
