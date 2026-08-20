import { InputManager } from '../input/InputManager';

export class TouchControls {
  private touchLayer: HTMLElement | null = null;
  private leftZone: HTMLElement | null = null;
  private joystickBase: HTMLElement | null = null;
  private joystickStick: HTMLElement | null = null;

  private btnKick: HTMLElement | null = null;
  private btnShoot: HTMLElement | null = null;
  private btnDash: HTMLElement | null = null;
  private btnAbility: HTMLElement | null = null;

  private joystickPointerId: number | null = null;
  private originX: number = 0;
  private originY: number = 0;
  private readonly maxRadius: number = 55;
  private readonly deadZone: number = 0.08; // 8%

  // Multi-touch tracking per button
  private kickPointers: Set<number> = new Set();
  private shootPointers: Set<number> = new Set();
  private dashPointers: Set<number> = new Set();
  private abilityPointers: Set<number> = new Set();

  private isForcedTouch: boolean = false;
  private inputManager: InputManager;

  constructor() {
    this.inputManager = InputManager.getInstance();
    this.checkUrlFlags();
    this.initElements();
    this.setupListeners();
  }

  private checkUrlFlags(): void {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('touch') === '1') {
      this.isForcedTouch = true;
    } else if (urlParams.get('touch') === '0') {
      this.isForcedTouch = false;
    } else {
      // Auto detect touch capability
      this.isForcedTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
  }

  private initElements(): void {
    this.touchLayer = document.getElementById('touch-layer');
    this.leftZone = document.getElementById('touch-left-zone');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickStick = document.getElementById('joystick-stick');

    this.btnKick = document.getElementById('touch-btn-kick');
    this.btnShoot = document.getElementById('touch-btn-shoot');
    this.btnDash = document.getElementById('touch-btn-dash');
    this.btnAbility = document.getElementById('touch-btn-ability');
  }

  private setupListeners(): void {
    if (!this.leftZone || !this.joystickBase || !this.joystickStick) return;

    // Floating Joystick on Left Zone
    this.leftZone.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      if (this.joystickPointerId !== null) return;

      this.joystickPointerId = e.pointerId;
      this.leftZone!.setPointerCapture(e.pointerId);

      this.originX = e.clientX;
      this.originY = e.clientY;

      this.joystickBase!.style.display = 'block';
      this.joystickBase!.style.left = `${this.originX}px`;
      this.joystickBase!.style.top = `${this.originY}px`;
      this.joystickStick!.style.left = '50%';
      this.joystickStick!.style.top = '50%';
    });

    this.leftZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      e.preventDefault();

      const dx = e.clientX - this.originX;
      const dy = e.clientY - this.originY;
      const dist = Math.hypot(dx, dy);

      if (dist === 0) {
        this.inputManager.setVirtualJoystick(0, 0);
        return;
      }

      const clampedDist = Math.min(dist, this.maxRadius);
      const normX = dx / dist;
      const normY = dy / dist;

      this.joystickStick!.style.left = `${50 + (normX * clampedDist / this.maxRadius) * 50}%`;
      this.joystickStick!.style.top = `${50 + (normY * clampedDist / this.maxRadius) * 50}%`;

      const normalizedMagnitude = clampedDist / this.maxRadius;
      if (normalizedMagnitude < this.deadZone) {
        this.inputManager.setVirtualJoystick(0, 0);
      } else {
        const factor = (normalizedMagnitude - this.deadZone) / (1 - this.deadZone);
        this.inputManager.setVirtualJoystick(normX * factor, normY * factor);
      }
    });

    const endJoystick = (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this.joystickBase!.style.display = 'none';
      this.inputManager.setVirtualJoystick(0, 0);
    };

    this.leftZone.addEventListener('pointerup', endJoystick);
    this.leftZone.addEventListener('pointercancel', endJoystick);
    this.leftZone.addEventListener('lostpointercapture', endJoystick);

    // Action Buttons with Set<pointerId>
    this.bindButton(this.btnKick, this.kickPointers, (pressed) => this.inputManager.setVirtualKick(pressed));
    this.bindButton(this.btnShoot, this.shootPointers, (pressed) => this.inputManager.setVirtualShoot(pressed));
    this.bindButton(this.btnDash, this.dashPointers, (pressed) => this.inputManager.setVirtualDash(pressed));
    this.bindButton(this.btnAbility, this.abilityPointers, (pressed) => this.inputManager.setVirtualAbility(pressed));

    // Global reset guards
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.reset();
      }
    });
  }

  private bindButton(btn: HTMLElement | null, pointerSet: Set<number>, onStateChange: (pressed: boolean) => void): void {
    if (!btn) return;

    btn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      pointerSet.add(e.pointerId);
      onStateChange(true);
    });

    const release = (e: PointerEvent) => {
      pointerSet.delete(e.pointerId);
      if (pointerSet.size === 0) {
        onStateChange(false);
      }
    };

    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
  }

  public setVisible(visible: boolean): void {
    if (!this.touchLayer) return;

    if (visible && this.isForcedTouch) {
      this.touchLayer.classList.add('active');
    } else {
      this.touchLayer.classList.remove('active');
      this.reset();
    }
  }

  public toggleTouchMode(): boolean {
    this.isForcedTouch = !this.isForcedTouch;
    return this.isForcedTouch;
  }

  public isTouchActive(): boolean {
    return this.isForcedTouch;
  }

  public reset(): void {
    this.joystickPointerId = null;
    if (this.joystickBase) this.joystickBase.style.display = 'none';
    this.kickPointers.clear();
    this.shootPointers.clear();
    this.dashPointers.clear();
    this.abilityPointers.clear();

    this.inputManager.setVirtualJoystick(0, 0);
    this.inputManager.setVirtualKick(false);
    this.inputManager.setVirtualShoot(false);
    this.inputManager.setVirtualDash(false);
    this.inputManager.setVirtualAbility(false);
  }
}
