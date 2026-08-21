import { VehicleControls } from '../entities/PlayerVehicle';
import { EventBus } from '../core/EventBus';

export class TouchControls {
  private container: HTMLElement | null = null;
  private steerZone: HTMLElement | null = null;
  private joystickBase: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;

  private btnThrottle: HTMLElement | null = null;
  private btnBrake: HTMLElement | null = null;
  private btnNitro: HTMLElement | null = null;
  private btnHandbrake: HTMLElement | null = null;

  // Touch State
  private steerPointerId: number | null = null;
  private steerOriginX = 0;
  private readonly maxJoystickRadius = 55;

  private throttlePointers = new Set<number>();
  private brakePointers = new Set<number>();
  private nitroPointers = new Set<number>();
  private handbrakePointers = new Set<number>();

  private steerValue = 0;

  // Keyboard State
  private keysDown = new Set<string>();

  private isVisible = false;

  constructor() {
    this.container = document.getElementById('touch-controls');
    this.steerZone = document.getElementById('touch-steer-zone');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickKnob = document.getElementById('joystick-knob');

    this.btnThrottle = document.getElementById('touch-throttle');
    this.btnBrake = document.getElementById('touch-brake');
    this.btnNitro = document.getElementById('touch-nitro');
    this.btnHandbrake = document.getElementById('touch-handbrake');

    this.setupTouchListeners();
    this.setupKeyboardListeners();
    this.setupWindowListeners();
  }

  private isTouchSupported(): boolean {
    const forced = new URLSearchParams(location.search).get('touch');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.container) {
      if (visible && this.isTouchSupported()) {
        this.container.classList.remove('hidden');
      } else {
        this.container.classList.add('hidden');
      }
    }
    if (!visible) {
      this.releaseAll();
    }
  }

  private setupTouchListeners(): void {
    if (!this.steerZone || !this.container) return;

    // 1. Floating Steering Joystick on Left Half
    this.steerZone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.steerPointerId !== null) return;
      this.steerPointerId = e.pointerId;
      this.steerZone?.setPointerCapture(e.pointerId);

      this.steerOriginX = e.clientX;

      if (this.joystickBase && this.joystickKnob) {
        this.joystickBase.style.display = 'block';
        this.joystickBase.style.left = `${e.clientX}px`;
        this.joystickBase.style.top = `${e.clientY}px`;
        this.joystickKnob.style.left = '50%';
        this.joystickKnob.style.top = '50%';
      }
    });

    const updateSteer = (clientX: number) => {
      const dx = clientX - this.steerOriginX;
      const raw = dx / this.maxJoystickRadius;
      const dead = 0.08; // 8% deadzone

      if (Math.abs(raw) < dead) {
        this.steerValue = 0;
      } else {
        const sign = Math.sign(raw);
        const mag = Math.min(1.0, (Math.abs(raw) - dead) / (1.0 - dead));
        this.steerValue = sign * mag;
      }

      if (this.joystickKnob) {
        const clampedX = Math.max(-this.maxJoystickRadius, Math.min(this.maxJoystickRadius, dx));
        this.joystickKnob.style.left = `calc(50% + ${clampedX}px)`;
      }
    };

    this.steerZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId === this.steerPointerId) {
        updateSteer(e.clientX);
      }
    });

    const endSteer = (e: PointerEvent) => {
      if (e.pointerId === this.steerPointerId) {
        this.steerPointerId = null;
        this.steerValue = 0;
        if (this.joystickBase) {
          this.joystickBase.style.display = 'none';
        }
      }
    };

    this.steerZone.addEventListener('pointerup', endSteer);
    this.steerZone.addEventListener('pointercancel', endSteer);
    this.steerZone.addEventListener('lostpointercapture', endSteer);

    // 2. Action Pedals & Buttons on Right Half
    this.bindButton(this.btnThrottle, this.throttlePointers);
    this.bindButton(this.btnBrake, this.brakePointers);
    this.bindButton(this.btnNitro, this.nitroPointers);
    this.bindButton(this.btnHandbrake, this.handbrakePointers);

    // Prevent default browser gestures
    const prevent = (e: Event) => e.preventDefault();
    this.container.addEventListener('contextmenu', prevent);
    this.container.addEventListener('dragstart', prevent);
    this.container.addEventListener('touchmove', prevent, { passive: false });
  }

  private bindButton(elem: HTMLElement | null, pointerSet: Set<number>): void {
    if (!elem) return;

    elem.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      pointerSet.add(e.pointerId);
      elem.setPointerCapture(e.pointerId);
      elem.classList.add('active');
    });

    const release = (e: PointerEvent) => {
      pointerSet.delete(e.pointerId);
      if (pointerSet.size === 0) {
        elem.classList.remove('active');
      }
    };

    elem.addEventListener('pointerup', release);
    elem.addEventListener('pointercancel', release);
    elem.addEventListener('lostpointercapture', release);
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);
      if (e.code === 'KeyP' || e.code === 'Escape') {
        EventBus.get().emit('ui:toggle_pause');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });
  }

  private setupWindowListeners(): void {
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  releaseAll(): void {
    this.steerPointerId = null;
    this.steerValue = 0;
    if (this.joystickBase) this.joystickBase.style.display = 'none';

    this.throttlePointers.clear();
    this.brakePointers.clear();
    this.nitroPointers.clear();
    this.handbrakePointers.clear();

    this.btnThrottle?.classList.remove('active');
    this.btnBrake?.classList.remove('active');
    this.btnNitro?.classList.remove('active');
    this.btnHandbrake?.classList.remove('active');

    this.keysDown.clear();
  }

  getControls(): VehicleControls {
    // Merge touch & keyboard inputs seamlessly
    let steer = this.steerValue;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) steer -= 1.0;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) steer += 1.0;
    steer = Math.max(-1.0, Math.min(1.0, steer));

    const throttle = (this.throttlePointers.size > 0 || this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) ? 1.0 : 0.0;
    const brake = (this.brakePointers.size > 0 || this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) ? 1.0 : 0.0;
    const nitro = this.nitroPointers.size > 0 || this.keysDown.has('Space') || this.keysDown.has('KeyE');
    const handbrake = this.handbrakePointers.size > 0 || this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight') || this.keysDown.has('KeyF');

    return { throttle, brake, steer, handbrake, nitro };
  }
}
