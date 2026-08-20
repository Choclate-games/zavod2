export interface TouchInputState {
  moveX: number;
  moveY: number;
  lookDx: number;
  lookDy: number;
  kickPressed: boolean;
  firePressed: boolean;
  slidePressed: boolean;
  catchPressed: boolean;
}

export class TouchControls {
  private container!: HTMLElement;
  private joystickZone!: HTMLElement;
  private joystickBase!: HTMLElement;
  private joystickThumb!: HTMLElement;

  private lookZone!: HTMLElement;
  private btnKick!: HTMLElement;
  private btnFire!: HTMLElement;
  private btnSlide!: HTMLElement;
  private btnCatch!: HTMLElement;

  // Joystick state
  private joystickPointerId: number | null = null;
  private joystickOriginX = 0;
  private joystickOriginY = 0;
  private readonly MAX_STICK_RADIUS = 55;
  private readonly DEADZONE = 0.08;

  // Look drag state
  private lookPointerId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private lookAccumDx = 0;
  private lookAccumDy = 0;

  // Button tracking sets
  private kickPointers = new Set<number>();
  private firePointers = new Set<number>();
  private slidePointers = new Set<number>();
  private catchPointers = new Set<number>();

  public isEnabled = false;
  private isForced = false;

  constructor() {
    this.checkPlatformSupport();
    this.buildDom();
    this.bindEvents();
    this.setVisible(false);
  }

  private checkPlatformSupport(): void {
    const params = new URLSearchParams(window.location.search);
    const forcedParam = params.get('touch');
    if (forcedParam === '1') {
      this.isEnabled = true;
      this.isForced = true;
      return;
    }
    if (forcedParam === '0') {
      this.isEnabled = false;
      return;
    }

    this.isEnabled =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth < 900;
  }

  private buildDom(): void {
    this.container = document.createElement('div');
    this.container.id = 'touch-controls';
    this.container.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      z-index: 50;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      display: none;
    `;

    // 1. Left Joystick Capture Zone
    this.joystickZone = document.createElement('div');
    this.joystickZone.id = 'touch-joystick-zone';
    this.joystickZone.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 50%; height: 100%;
      pointer-events: auto;
      touch-action: none;
    `;

    this.joystickBase = document.createElement('div');
    this.joystickBase.style.cssText = `
      position: absolute;
      width: 120px; height: 120px;
      margin-left: -60px; margin-top: -60px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      border: 2px solid rgba(255, 255, 255, 0.35);
      pointer-events: none;
      display: none;
    `;

    this.joystickThumb = document.createElement('div');
    this.joystickThumb.style.cssText = `
      position: absolute;
      width: 52px; height: 52px;
      margin-left: -26px; margin-top: -26px;
      left: 50%; top: 50%;
      border-radius: 50%;
      background: rgba(242, 204, 143, 0.75);
      box-shadow: 0 0 10px rgba(242, 204, 143, 0.5);
      pointer-events: none;
    `;
    this.joystickBase.appendChild(this.joystickThumb);
    this.joystickZone.appendChild(this.joystickBase);
    this.container.appendChild(this.joystickZone);

    // 2. Right Look & Action Area
    this.lookZone = document.createElement('div');
    this.lookZone.id = 'touch-look-zone';
    this.lookZone.style.cssText = `
      position: absolute;
      top: 0; right: 0; width: 50%; height: 100%;
      pointer-events: auto;
      touch-action: none;
    `;
    this.container.appendChild(this.lookZone);

    // 3. Action Buttons (Right Zone)
    const btnContainer = document.createElement('div');
    btnContainer.id = 'touch-action-buttons';
    btnContainer.style.cssText = `
      position: absolute;
      right: calc(18px + env(safe-area-inset-right));
      bottom: calc(18px + env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 14px;
      pointer-events: auto;
    `;

    // Row for secondary buttons
    const rowSec = document.createElement('div');
    rowSec.style.cssText = 'display: flex; gap: 14px; align-items: center;';

    // Catch Button
    this.btnCatch = this.createButton('🧲', 'ПЕРЕХВАТ', 64, '#4c9f70');
    // Slide Button
    this.btnSlide = this.createButton('💨', 'СЛАЙД', 64, '#3d405b');
    // Fire Button
    this.btnFire = this.createButton('🎯', 'ОГОНЬ', 72, '#e07a5f');

    rowSec.appendChild(this.btnCatch);
    rowSec.appendChild(this.btnSlide);
    rowSec.appendChild(this.btnFire);

    // Main KICK Button (Large >= 96px)
    this.btnKick = this.createButton('👢', 'ПИНОК [F]', 98, '#d62828');
    this.btnKick.style.fontSize = '34px';
    this.btnKick.style.fontWeight = 'bold';
    this.btnKick.style.border = '3px solid #f2cc8f';
    this.btnKick.style.boxShadow = '0 0 16px rgba(214, 40, 40, 0.6)';

    btnContainer.appendChild(rowSec);
    btnContainer.appendChild(this.btnKick);
    this.container.appendChild(btnContainer);

    document.body.appendChild(this.container);
  }

  private createButton(icon: string, label: string, size: number, bg: string): HTMLElement {
    const btn = document.createElement('div');
    btn.style.cssText = `
      width: ${size}px; height: ${size}px;
      border-radius: 50%;
      background: ${bg};
      border: 2px solid rgba(255, 255, 255, 0.4);
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: ${Math.floor(size * 0.38)}px;
      user-select: none;
      touch-action: none;
      pointer-events: auto;
      box-shadow: 0 4px 8px rgba(0,0,0,0.4);
      cursor: pointer;
    `;
    btn.innerHTML = `<span>${icon}</span><span style="font-size: 9px; opacity: 0.9; margin-top: 2px;">${label}</span>`;
    return btn;
  }

  private bindEvents(): void {
    // Prevent default context menus and drags
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
    this.container.addEventListener('dragstart', (e) => e.preventDefault());
    this.container.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // --- Floating Joystick Pointer Events ---
    this.joystickZone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.joystickPointerId !== null) return;
      e.preventDefault();
      this.joystickPointerId = e.pointerId;
      this.joystickZone.setPointerCapture(e.pointerId);

      this.joystickOriginX = e.clientX;
      this.joystickOriginY = e.clientY;

      this.joystickBase.style.left = `${e.clientX}px`;
      this.joystickBase.style.top = `${e.clientY}px`;
      this.joystickBase.style.display = 'block';
      this.joystickThumb.style.transform = 'translate(0px, 0px)';
    });

    this.joystickZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      e.preventDefault();

      const dx = e.clientX - this.joystickOriginX;
      const dy = e.clientY - this.joystickOriginY;
      const dist = Math.hypot(dx, dy);

      const clampedDist = Math.min(dist, this.MAX_STICK_RADIUS);
      const angle = Math.atan2(dy, dx);

      const thumbX = Math.cos(angle) * clampedDist;
      const thumbY = Math.sin(angle) * clampedDist;
      this.joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;
    });

    const endJoystick = (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this.joystickBase.style.display = 'none';
      this.joystickThumb.style.transform = 'translate(0px, 0px)';
    };

    this.joystickZone.addEventListener('pointerup', endJoystick);
    this.joystickZone.addEventListener('pointercancel', endJoystick);
    this.joystickZone.addEventListener('lostpointercapture', endJoystick);

    // --- Look Area Pointer Events ---
    this.lookZone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.lookPointerId !== null) return;
      // Don't capture if clicking directly on a button child
      if (e.target !== this.lookZone) return;

      e.preventDefault();
      this.lookPointerId = e.pointerId;
      this.lookZone.setPointerCapture(e.pointerId);
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;
    });

    this.lookZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.lookPointerId) return;
      e.preventDefault();

      const dx = e.clientX - this.lastLookX;
      const dy = e.clientY - this.lastLookY;
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;

      this.lookAccumDx += dx;
      this.lookAccumDy += dy;
    });

    const endLook = (e: PointerEvent) => {
      if (e.pointerId !== this.lookPointerId) return;
      this.lookPointerId = null;
    };

    this.lookZone.addEventListener('pointerup', endLook);
    this.lookZone.addEventListener('pointercancel', endLook);
    this.lookZone.addEventListener('lostpointercapture', endLook);

    // --- Action Button Pointer Bindings ---
    this.bindButtonPointer(this.btnKick, this.kickPointers);
    this.bindButtonPointer(this.btnFire, this.firePointers);
    this.bindButtonPointer(this.btnSlide, this.slidePointers);
    this.bindButtonPointer(this.btnCatch, this.catchPointers);

    // Reset all on blur and visibility change
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.releaseAll();
    });
  }

  private bindButtonPointer(btn: HTMLElement, pointerSet: Set<number>): void {
    btn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pointerSet.add(e.pointerId);
      btn.setPointerCapture(e.pointerId);
      btn.style.transform = 'scale(0.92)';
      btn.style.filter = 'brightness(1.3)';
    });

    const release = (e: PointerEvent) => {
      pointerSet.delete(e.pointerId);
      if (pointerSet.size === 0) {
        btn.style.transform = 'scale(1.0)';
        btn.style.filter = 'none';
      }
    };

    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
  }

  public setVisible(visible: boolean): void {
    if (!this.isEnabled && !this.isForced) {
      this.container.style.display = 'none';
      return;
    }
    this.container.style.display = visible ? 'block' : 'none';
    if (!visible) {
      this.releaseAll();
    }
  }

  public releaseAll(): void {
    this.joystickPointerId = null;
    this.lookPointerId = null;
    this.joystickBase.style.display = 'none';
    this.kickPointers.clear();
    this.firePointers.clear();
    this.slidePointers.clear();
    this.catchPointers.clear();
    this.lookAccumDx = 0;
    this.lookAccumDy = 0;

    [this.btnKick, this.btnFire, this.btnSlide, this.btnCatch].forEach((b) => {
      b.style.transform = 'scale(1.0)';
      b.style.filter = 'none';
    });
  }

  public highlightCatchButton(active: boolean): void {
    if (active) {
      this.btnCatch.style.border = '3px solid #ffdd44';
      this.btnCatch.style.boxShadow = '0 0 16px #ffdd44';
    } else {
      this.btnCatch.style.border = '2px solid rgba(255, 255, 255, 0.4)';
      this.btnCatch.style.boxShadow = '0 4px 8px rgba(0,0,0,0.4)';
    }
  }

  public poll(): TouchInputState {
    let moveX = 0;
    let moveY = 0;

    if (this.joystickPointerId !== null) {
      const match = this.joystickThumb.style.transform.match(/translate(([-d.]+)px,s*([-d.]+)px)/);
      if (match) {
        const rawX = parseFloat(match[1]) / this.MAX_STICK_RADIUS;
        const rawY = parseFloat(match[2]) / this.MAX_STICK_RADIUS;

        // Apply deadzone
        const len = Math.hypot(rawX, rawY);
        if (len > this.DEADZONE) {
          const scale = (len - this.DEADZONE) / (1 - this.DEADZONE);
          moveX = (rawX / len) * scale;
          moveY = -(rawY / len) * scale; // Invert Y for forward
        }
      }
    }

    const state: TouchInputState = {
      moveX,
      moveY,
      lookDx: this.lookAccumDx,
      lookDy: this.lookAccumDy,
      kickPressed: this.kickPointers.size > 0,
      firePressed: this.firePointers.size > 0,
      slidePressed: this.slidePointers.size > 0,
      catchPressed: this.catchPointers.size > 0,
    };

    // Consume accumulated look
    this.lookAccumDx = 0;
    this.lookAccumDy = 0;

    return state;
  }
}
