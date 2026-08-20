import { InputManager } from '../input/InputManager';

export class TouchControls {
  private container: HTMLElement | null = null;
  private zoneLeft: HTMLElement | null = null;
  private joystickBase: HTMLElement | null = null;
  private joystickStick: HTMLElement | null = null;

  private btnAttack: HTMLElement | null = null;
  private btnDash: HTMLElement | null = null;
  private btnTackle: HTMLElement | null = null;

  private inputManager: InputManager;
  private joystickPointerId: number | null = null;
  private originX: number = 0;
  private originY: number = 0;
  private readonly MAX_RADIUS = 50;
  private readonly DEAD_ZONE = 0.08;

  private attackPointers: Set<number> = new Set();
  private dashPointers: Set<number> = new Set();
  private tacklePointers: Set<number> = new Set();

  private isEnabled: boolean = false;

  constructor(inputManager: InputManager) {
    this.inputManager = inputManager;
    this.initDOM();
    this.checkDeviceType();
  }

  private initDOM(): void {
    this.container = document.getElementById('touch-controls');
    this.zoneLeft = document.getElementById('touch-zone-left');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickStick = document.getElementById('joystick-stick');

    this.btnAttack = document.getElementById('btn-touch-attack');
    this.btnDash = document.getElementById('btn-touch-dash');
    this.btnTackle = document.getElementById('btn-touch-tackle');

    this.setupJoystick();
    this.setupButton(this.btnAttack, this.attackPointers, (active) => this.inputManager.setVirtualAttack(active));
    this.setupButton(this.btnDash, this.dashPointers, (active) => this.inputManager.setVirtualDash(active));
    this.setupButton(this.btnTackle, this.tacklePointers, (active) => this.inputManager.setVirtualTackle(active));
  }

  private checkDeviceType(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const touchParam = urlParams.get('touch');

    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (touchParam === '1' || (isTouchDevice && touchParam !== '0')) {
      this.isEnabled = true;
    }
  }

  public setVisible(visible: boolean): void {
    if (!this.container) return;
    if (visible && this.isEnabled) {
      this.container.classList.add('active');
    } else {
      this.container.classList.remove('active');
      this.reset();
    }
  }

  private setupJoystick(): void {
    if (!this.zoneLeft || !this.joystickBase || !this.joystickStick) return;

    this.zoneLeft.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      if (this.joystickPointerId !== null) return; // Only one pointer for joystick

      this.joystickPointerId = e.pointerId;
      try {
        this.zoneLeft!.setPointerCapture(e.pointerId);
      } catch {}

      this.originX = e.clientX;
      this.originY = e.clientY;

      this.joystickBase!.style.left = `${this.originX}px`;
      this.joystickBase!.style.top = `${this.originY}px`;
      this.joystickBase!.style.display = 'block';
      this.joystickStick!.style.transform = `translate(-50%, -50%) translate(0px, 0px)`;
    });

    this.zoneLeft.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;

      const dx = e.clientX - this.originX;
      const dy = e.clientY - this.originY;
      const distance = Math.hypot(dx, dy);

      const clampedDist = Math.min(distance, this.MAX_RADIUS);
      const angle = Math.atan2(dy, dx);

      const stickX = Math.cos(angle) * clampedDist;
      const stickY = Math.sin(angle) * clampedDist;
      this.joystickStick!.style.transform = `translate(-50%, -50%) translate(${stickX}px, ${stickY}px)`;

      // Normalized axes with 8% dead zone
      const rawNormalized = distance / this.MAX_RADIUS;
      if (rawNormalized < this.DEAD_ZONE) {
        this.inputManager.setVirtualMove(0, 0);
      } else {
        const scaledMagnitude = Math.min(1.0, (rawNormalized - this.DEAD_ZONE) / (1 - this.DEAD_ZONE));
        const moveX = Math.cos(angle) * scaledMagnitude;
        const moveY = Math.sin(angle) * scaledMagnitude;
        this.inputManager.setVirtualMove(moveX, moveY);
      }
    });

    const endJoystick = (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      if (this.joystickBase) {
        this.joystickBase.style.display = 'none';
      }
      this.inputManager.setVirtualMove(0, 0);
    };

    this.zoneLeft.addEventListener('pointerup', endJoystick);
    this.zoneLeft.addEventListener('pointercancel', endJoystick);
    this.zoneLeft.addEventListener('lostpointercapture', endJoystick);
  }

  private setupButton(btn: HTMLElement | null, pointerSet: Set<number>, onStateChange: (active: boolean) => void): void {
    if (!btn) return;

    btn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {}
      pointerSet.add(e.pointerId);
      onStateChange(true);
    });

    const onRelease = (e: PointerEvent) => {
      pointerSet.delete(e.pointerId);
      if (pointerSet.size === 0) {
        onStateChange(false);
      }
    };

    btn.addEventListener('pointerup', onRelease);
    btn.addEventListener('pointercancel', onRelease);
    btn.addEventListener('lostpointercapture', onRelease);
  }

  public reset(): void {
    this.joystickPointerId = null;
    if (this.joystickBase) {
      this.joystickBase.style.display = 'none';
    }
    this.attackPointers.clear();
    this.dashPointers.clear();
    this.tacklePointers.clear();
    this.inputManager.setVirtualMove(0, 0);
    this.inputManager.setVirtualAttack(false);
    this.inputManager.setVirtualDash(false);
    this.inputManager.setVirtualTackle(false);
  }
}
