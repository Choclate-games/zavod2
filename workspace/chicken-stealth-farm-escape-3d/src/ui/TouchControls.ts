export class TouchControls {
  private container: HTMLDivElement;
  private joystickZone: HTMLDivElement;
  private joystickBase: HTMLDivElement;
  private joystickThumb: HTMLDivElement;
  private boxButton: HTMLButtonElement;

  private isTouchingJoystick: boolean = false;
  private joystickPointerId: number | null = null;
  private originX: number = 0;
  private originY: number = 0;
  private readonly maxRadius: number = 55;
  private readonly deadZone: number = 0.08;

  public axisX: number = 0;
  public axisY: number = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'touch-controls-layer';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      z-index: 15;
      display: none;
    `;

    // Left Half - Joystick Capture Zone
    this.joystickZone = document.createElement('div');
    this.joystickZone.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 50%;
      height: 100%;
      pointer-events: auto;
      touch-action: none;
    `;

    // Floating Joystick Base
    this.joystickBase = document.createElement('div');
    this.joystickBase.style.cssText = `
      position: absolute;
      width: 120px;
      height: 120px;
      margin-left: -60px;
      margin-top: -60px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(0,0,0,0.4) 100%);
      border: 3px solid rgba(255,255,255,0.45);
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      display: none;
      pointer-events: none;
    `;

    // Floating Joystick Thumb
    this.joystickThumb = document.createElement('div');
    this.joystickThumb.style.cssText = `
      position: absolute;
      width: 54px;
      height: 54px;
      margin-left: -27px;
      margin-top: -27px;
      top: 60px;
      left: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f1c40f, #e67e22);
      border: 2px solid #ffffff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      pointer-events: none;
    `;
    this.joystickBase.appendChild(this.joystickThumb);
    this.joystickZone.appendChild(this.joystickBase);
    this.container.appendChild(this.joystickZone);

    // Right Half - Box Disguise Action Button
    const rightZone = document.createElement('div');
    rightZone.style.cssText = `
      position: absolute;
      bottom: calc(24px + env(safe-area-inset-bottom, 0px));
      right: calc(24px + env(safe-area-inset-right, 0px));
      pointer-events: auto;
    `;

    this.boxButton = document.createElement('button');
    this.boxButton.id = 'touch-box-button';
    this.boxButton.innerHTML = `
      <div style="font-size: 38px; line-height: 1;">📦</div>
      <div style="font-size: 11px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 2px;">КОРОБКА</div>
    `;
    this.boxButton.style.cssText = `
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: linear-gradient(145deg, #e67e22, #d35400);
      color: #ffffff;
      border: 3px solid #f39c12;
      box-shadow: 0 6px 16px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.4);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      user-select: none;
      touch-action: none;
      font-family: 'Nunito', sans-serif;
      transition: transform 0.08s ease, filter 0.08s ease;
      outline: none;
    `;

    rightZone.appendChild(this.boxButton);
    this.container.appendChild(rightZone);

    document.getElementById('ui-root')?.appendChild(this.container);

    this.bindEvents();
  }

  private bindEvents(): void {
    // Joystick Pointer Events
    this.joystickZone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.isTouchingJoystick) return;
      e.preventDefault();

      this.isTouchingJoystick = true;
      this.joystickPointerId = e.pointerId;
      this.joystickZone.setPointerCapture(e.pointerId);

      this.originX = e.clientX;
      this.originY = e.clientY;

      this.joystickBase.style.left = `${this.originX}px`;
      this.joystickBase.style.top = `${this.originY}px`;
      this.joystickThumb.style.left = `60px`;
      this.joystickThumb.style.top = `60px`;
      this.joystickBase.style.display = 'block';

      this.axisX = 0;
      this.axisY = 0;
    });

    this.joystickZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isTouchingJoystick || e.pointerId !== this.joystickPointerId) return;
      e.preventDefault();

      const dx = e.clientX - this.originX;
      const dy = e.clientY - this.originY;
      const dist = Math.hypot(dx, dy);

      const clampedDist = Math.min(this.maxRadius, dist);
      const angle = Math.atan2(dy, dx);

      const thumbX = 60 + Math.cos(angle) * clampedDist;
      const thumbY = 60 + Math.sin(angle) * clampedDist;

      this.joystickThumb.style.left = `${thumbX}px`;
      this.joystickThumb.style.top = `${thumbY}px`;

      const normalizedDist = Math.min(1.0, dist / this.maxRadius);
      if (normalizedDist < this.deadZone) {
        this.axisX = 0;
        this.axisY = 0;
      } else {
        const factor = (normalizedDist - this.deadZone) / (1.0 - this.deadZone);
        this.axisX = Math.cos(angle) * factor;
        this.axisY = -Math.sin(angle) * factor;
      }
    });

    const endJoystick = (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      this.isTouchingJoystick = false;
      this.joystickPointerId = null;
      this.joystickBase.style.display = 'none';
      this.axisX = 0;
      this.axisY = 0;
    };

    this.joystickZone.addEventListener('pointerup', endJoystick);
    this.joystickZone.addEventListener('pointercancel', endJoystick);
    this.joystickZone.addEventListener('lostpointercapture', endJoystick);

    // Box Button Pointer Events
    this.boxButton.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      this.boxButton.setPointerCapture(e.pointerId);
      this.boxButton.style.transform = 'scale(0.88)';
      this.boxButton.style.filter = 'brightness(1.2)';

      // Trigger box hide action
      window.dispatchEvent(new CustomEvent('action:toggleBox'));
    });

    const endBoxTap = () => {
      this.boxButton.style.transform = 'scale(1)';
      this.boxButton.style.filter = 'brightness(1)';
    };

    this.boxButton.addEventListener('pointerup', endBoxTap);
    this.boxButton.addEventListener('pointercancel', endBoxTap);

    // Window blur & visibility resets
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.reset();
      }
    });
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
    if (!visible) {
      this.reset();
    }
  }

  public reset(): void {
    this.isTouchingJoystick = false;
    this.joystickPointerId = null;
    this.joystickBase.style.display = 'none';
    this.axisX = 0;
    this.axisY = 0;
    this.boxButton.style.transform = 'scale(1)';
  }

  public setBoxActiveState(isHiding: boolean): void {
    if (isHiding) {
      this.boxButton.style.background = 'linear-gradient(145deg, #27ae60, #2ecc71)';
      this.boxButton.style.borderColor = '#2ecc71';
    } else {
      this.boxButton.style.background = 'linear-gradient(145deg, #e67e22, #d35400)';
      this.boxButton.style.borderColor = '#f39c12';
    }
  }
}
