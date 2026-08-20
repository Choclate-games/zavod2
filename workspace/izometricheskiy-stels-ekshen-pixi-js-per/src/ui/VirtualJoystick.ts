/**
 * Mobile Touch & Desktop Input Manager (Pointer Events + Keyboard Multi-Channel)
 */

export interface InputSnapshot {
  moveX: number;
  moveY: number;
  isAttackPressed: boolean;
  isTorchPressed: boolean;
  isSaltPressed: boolean;
  isDashPressed: boolean;
}

export class TouchControls {
  public moveX = 0;
  public moveY = 0;
  public isAttackPressed = false;
  public isTorchPressed = false;
  public isSaltPressed = false;
  public isDashPressed = false;

  private isVisible = false;
  private containerEl: HTMLElement | null = null;
  private joystickZoneEl: HTMLElement | null = null;
  private baseEl: HTMLElement | null = null;
  private knobEl: HTMLElement | null = null;

  private joystickPointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private readonly MAX_RADIUS = 55;
  private readonly DEAD_ZONE = 0.08;

  // Key map
  private keysDown = new Set<string>();

  constructor() {
    this.containerEl = document.getElementById('touch-controls');
    this.joystickZoneEl = document.getElementById('touch-zone-left');
    this.baseEl = document.getElementById('joystick-base');
    this.knobEl = document.getElementById('joystick-knob');

    this.setupTouchListeners();
    this.setupKeyboardListeners();
    this.checkTouchMode();
  }

  private checkTouchMode(): void {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get('touch');
    const isTouchDevice =
      forced === '1' ||
      (forced !== '0' &&
        ('ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          window.matchMedia('(pointer: coarse)').matches ||
          window.innerWidth < 900));

    if (isTouchDevice && this.containerEl) {
      this.containerEl.style.display = 'block';
    }
  }

  private setupTouchListeners(): void {
    if (!this.joystickZoneEl || !this.baseEl || !this.knobEl) return;

    this.joystickZoneEl.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.joystickPointerId !== null) return;
      this.joystickPointerId = e.pointerId;
      this.joystickZoneEl?.setPointerCapture(e.pointerId);

      this.originX = e.clientX;
      this.originY = e.clientY;

      this.baseEl!.style.left = `${this.originX}px`;
      this.baseEl!.style.top = `${this.originY}px`;
      this.baseEl!.style.display = 'block';

      this.knobEl!.style.transform = 'translate(-50%, -50%)';
      this.moveX = 0;
      this.moveY = 0;
    });

    const onPointerMove = (e: PointerEvent) => {
      if (this.joystickPointerId !== e.pointerId || !this.baseEl || !this.knobEl) return;

      const dx = e.clientX - this.originX;
      const dy = e.clientY - this.originY;
      const dist = Math.hypot(dx, dy);

      const clampedDist = Math.min(this.MAX_RADIUS, dist);
      const angle = Math.atan2(dy, dx);

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;
      this.knobEl.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

      const raw = dist / this.MAX_RADIUS;
      if (raw < this.DEAD_ZONE) {
        this.moveX = 0;
        this.moveY = 0;
      } else {
        const factor = Math.min(1, (raw - this.DEAD_ZONE) / (1 - this.DEAD_ZONE));
        this.moveX = Math.cos(angle) * factor;
        this.moveY = Math.sin(angle) * factor;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.joystickPointerId !== e.pointerId) return;
      this.joystickPointerId = null;
      if (this.baseEl) this.baseEl.style.display = 'none';
      this.moveX = 0;
      this.moveY = 0;
    };

    this.joystickZoneEl.addEventListener('pointermove', onPointerMove);
    this.joystickZoneEl.addEventListener('pointerup', onPointerUp);
    this.joystickZoneEl.addEventListener('pointercancel', onPointerUp);
    this.joystickZoneEl.addEventListener('lostpointercapture', onPointerUp);

    // Button touch handlers with pointer capture
    this.bindTouchButton('touch-btn-attack', (pressed) => { this.isAttackPressed = pressed; });
    this.bindTouchButton('touch-btn-torch', (pressed) => { this.isTorchPressed = pressed; });
    this.bindTouchButton('touch-btn-salt', (pressed) => { this.isSaltPressed = pressed; });
    this.bindTouchButton('touch-btn-dash', (pressed) => { this.isDashPressed = pressed; });

    // Safety resets
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  private bindTouchButton(btnId: string, setPressed: (pressed: boolean) => void): void {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const pointers = new Set<number>();

    btn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      pointers.add(e.pointerId);
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('pressed');
      setPressed(true);
    });

    const release = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        btn.classList.remove('pressed');
        setPressed(false);
      }
    };

    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      this.keysDown.add(e.code);
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
    });
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.containerEl) {
      const params = new URLSearchParams(window.location.search);
      const isTouch =
        params.get('touch') === '1' ||
        ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900);
      this.containerEl.style.display = visible && isTouch ? 'block' : 'none';
    }
    if (!visible) {
      this.releaseAll();
    }
  }

  releaseAll(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.isAttackPressed = false;
    this.isTorchPressed = false;
    this.isSaltPressed = false;
    this.isDashPressed = false;
    this.keysDown.clear();

    if (this.baseEl) this.baseEl.style.display = 'none';
    this.joystickPointerId = null;
  }

  getSnapshot(): InputSnapshot {
    let kx = 0;
    let ky = 0;

    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) ky -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) ky += 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) kx -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) kx += 1;

    const kmag = Math.hypot(kx, ky);
    if (kmag > 0) {
      kx /= kmag;
      ky /= kmag;
    }

    // Merge keyboard and touch
    const finalX = Math.abs(this.moveX) > 0.05 ? this.moveX : kx;
    const finalY = Math.abs(this.moveY) > 0.05 ? this.moveY : ky;

    const isAttack =
      this.isAttackPressed ||
      this.keysDown.has('KeyJ') ||
      this.keysDown.has('Space');

    const isTorch =
      this.isTorchPressed ||
      this.keysDown.has('KeyF') ||
      this.keysDown.has('Digit1');

    const isSalt =
      this.isSaltPressed ||
      this.keysDown.has('KeyE') ||
      this.keysDown.has('Digit2');

    const isDash =
      this.isDashPressed ||
      this.keysDown.has('ShiftLeft') ||
      this.keysDown.has('ShiftRight') ||
      this.keysDown.has('Digit3') ||
      this.keysDown.has('KeyK');

    return {
      moveX: finalX,
      moveY: finalY,
      isAttackPressed: isAttack,
      isTorchPressed: isTorch,
      isSaltPressed: isSalt,
      isDashPressed: isDash,
    };
  }
}
