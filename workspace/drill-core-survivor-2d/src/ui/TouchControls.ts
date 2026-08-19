import { inputManager } from './InputManager';

export class TouchControls {
  private layerElement: HTMLElement;
  private joystickBase!: HTMLElement;
  private joystickKnob!: HTMLElement;
  private turboBtn!: HTMLElement;

  private activeJoystickPointerId: number | null = null;
  private turboPointers: Set<number> = new Set();

  private originX: number = 0;
  private originY: number = 0;
  private readonly MAX_RADIUS = 60;
  private readonly DEADZONE = 0.08;

  constructor() {
    this.layerElement = document.getElementById('touch-controls-layer')!;
    this.buildDom();
    this.setupEvents();
  }

  private buildDom(): void {
    this.layerElement.innerHTML = `
      <div class="touch-left-zone" id="touch-steer-zone"></div>
      <div class="touch-right-zone">
        <div class="touch-btn btn-turbo" id="touch-turbo-btn">
          <span>ТАРАН</span>
          <span style="font-size: 10px; opacity: 0.8;">TURBO</span>
        </div>
      </div>
      <div class="joystick-base" id="touch-joy-base">
        <div class="joystick-knob" id="touch-joy-knob"></div>
      </div>
    `;

    this.joystickBase = document.getElementById('touch-joy-base')!;
    this.joystickKnob = document.getElementById('touch-joy-knob')!;
    this.turboBtn = document.getElementById('touch-turbo-btn')!;
  }

  private setupEvents(): void {
    // 1. Gesture cancellation
    this.layerElement.addEventListener('contextmenu', (e) => e.preventDefault());
    this.layerElement.addEventListener('dragstart', (e) => e.preventDefault());
    this.layerElement.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // 2. Floating Joystick Zone
    const steerZone = document.getElementById('touch-steer-zone')!;

    steerZone.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      if (this.activeJoystickPointerId !== null) return;

      this.activeJoystickPointerId = e.pointerId;
      try {
        steerZone.setPointerCapture(e.pointerId);
      } catch {}

      this.originX = e.clientX;
      this.originY = e.clientY;

      this.joystickBase.style.display = 'block';
      this.joystickBase.style.left = `${this.originX}px`;
      this.joystickBase.style.top = `${this.originY}px`;
      this.joystickKnob.style.transform = 'translate3d(0, 0, 0)';
    });

    const onSteerMove = (e: PointerEvent) => {
      if (e.pointerId !== this.activeJoystickPointerId) return;

      const dx = e.clientX - this.originX;
      const dy = e.clientY - this.originY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const clampedDist = Math.min(this.MAX_RADIUS, dist);
      const angle = Math.atan2(dy, dx);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      this.joystickKnob.style.transform = `translate3d(${knobX}px, ${knobY}px, 0)`;

      // Horizontal virtual axis with deadzone
      const rawX = (knobX / this.MAX_RADIUS);
      const absX = Math.abs(rawX);
      if (absX < this.DEADZONE) {
        inputManager.touchSteerX = 0;
      } else {
        const normalized = (absX - this.DEADZONE) / (1 - this.DEADZONE);
        inputManager.touchSteerX = Math.sign(rawX) * Math.min(1, normalized);
      }
    };

    const onSteerEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.activeJoystickPointerId) return;
      this.activeJoystickPointerId = null;
      this.joystickBase.style.display = 'none';
      inputManager.touchSteerX = 0;
    };

    steerZone.addEventListener('pointermove', onSteerMove);
    steerZone.addEventListener('pointerup', onSteerEnd);
    steerZone.addEventListener('pointercancel', onSteerEnd);
    steerZone.addEventListener('lostpointercapture', onSteerEnd);

    // 3. Turbo Button (Set<pointerId> multi-touch)
    this.turboBtn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      try {
        this.turboBtn.setPointerCapture(e.pointerId);
      } catch {}
      this.turboPointers.add(e.pointerId);
      this.updateTurboState();
    });

    const onTurboEnd = (e: PointerEvent) => {
      this.turboPointers.delete(e.pointerId);
      this.updateTurboState();
    };

    this.turboBtn.addEventListener('pointerup', onTurboEnd);
    this.turboBtn.addEventListener('pointercancel', onTurboEnd);
    this.turboBtn.addEventListener('lostpointercapture', onTurboEnd);

    // 4. Global blur/visibility release
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  private updateTurboState(): void {
    const active = this.turboPointers.size > 0;
    inputManager.touchTurboActive = active;
    if (active) {
      this.turboBtn.classList.add('active');
    } else {
      this.turboBtn.classList.remove('active');
    }
  }

  public setVisible(visible: boolean): void {
    if (visible && this.shouldEnableTouch()) {
      this.layerElement.style.display = 'block';
    } else {
      this.layerElement.style.display = 'none';
      this.releaseAll();
    }
  }

  public shouldEnableTouch(): boolean {
    const forced = new URLSearchParams(location.search).get('touch');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth < 900
    );
  }

  public releaseAll(): void {
    this.activeJoystickPointerId = null;
    this.turboPointers.clear();
    this.joystickBase.style.display = 'none';
    this.turboBtn.classList.remove('active');
    inputManager.touchSteerX = 0;
    inputManager.touchTurboActive = false;
  }
}
