export interface VehicleInputState {
  steer: number;      // -1 (left) to +1 (right)
  throttle: number;   // 0 to 1
  brake: number;      // 0 to 1
  handbrake: boolean; // drift initiator
  nitro: boolean;     // nitro boost
}

export class TouchControls {
  private container: HTMLElement;
  private isVisible = false;

  private leftPressed = false;
  private rightPressed = false;
  private gasPressed = false;
  private brakePressed = false;
  private driftPressed = false;
  private nitroPressed = false;

  constructor(targetLayer: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'touch-controls-root';
    this.container.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: none;
      justify-content: space-between;
      align-items: flex-end;
      padding: calc(var(--space-4) * var(--ui-scale)) calc(var(--space-6) * var(--ui-scale));
      touch-action: none;
    `;

    this.buildMarkup();
    targetLayer.appendChild(this.container);

    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  private buildMarkup(): void {
    // Left Zone: Steer Left & Steer Right
    const leftPad = document.createElement('div');
    leftPad.className = 'touch-pad touch-pad-left';
    leftPad.style.cssText = `
      display: flex;
      gap: calc(var(--space-3) * var(--ui-scale));
      pointer-events: none;
    `;

    const btnLeft = this.createButton('STEER_LEFT', '◀', 80, 80);
    const btnRight = this.createButton('STEER_RIGHT', '▶', 80, 80);
    leftPad.appendChild(btnLeft);
    leftPad.appendChild(btnRight);

    // Right Zone: Gas, Brake, Drift, Nitro
    const rightPad = document.createElement('div');
    rightPad.className = 'touch-pad touch-pad-right';
    rightPad.style.cssText = `
      display: flex;
      align-items: flex-end;
      gap: calc(var(--space-3) * var(--ui-scale));
      pointer-events: none;
    `;

    const subCol = document.createElement('div');
    subCol.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: calc(var(--space-2) * var(--ui-scale));
      pointer-events: none;
    `;

    const btnNitro = this.createButton('NITRO', 'NITRO', 84, 56, 'btn-nitro');
    const btnDrift = this.createButton('DRIFT', 'DRIFT', 84, 56, 'btn-secondary');
    const btnBrake = this.createButton('BRAKE', 'BRAKE', 84, 56, 'btn-danger');
    subCol.appendChild(btnNitro);
    subCol.appendChild(btnDrift);
    subCol.appendChild(btnBrake);

    const btnGas = this.createButton('GAS', 'GAS', 100, 140, 'btn-primary');

    rightPad.appendChild(subCol);
    rightPad.appendChild(btnGas);

    this.container.appendChild(leftPad);
    this.container.appendChild(rightPad);
  }

  private createButton(
    action: string,
    label: string,
    wPx: number,
    hPx: number,
    customClass = 'btn-secondary'
  ): HTMLElement {
    const btn = document.createElement('button');
    btn.className = `btn cyber-cut ${customClass}`;
    btn.textContent = label;
    btn.style.cssText = `
      pointer-events: auto;
      width: calc(${wPx}px * var(--ui-scale));
      height: calc(${hPx}px * var(--ui-scale));
      font-size: calc(15px * var(--ui-scale));
      touch-action: none;
    `;

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      this.handleAction(action, true);
    };

    const onUp = (e: PointerEvent) => {
      e.preventDefault();
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch {}
      this.handleAction(action, false);
    };

    btn.addEventListener('pointerdown', onDown);
    btn.addEventListener('pointerup', onUp);
    btn.addEventListener('pointercancel', onUp);

    return btn;
  }

  private handleAction(action: string, pressed: boolean): void {
    switch (action) {
      case 'STEER_LEFT':
        this.leftPressed = pressed;
        break;
      case 'STEER_RIGHT':
        this.rightPressed = pressed;
        break;
      case 'GAS':
        this.gasPressed = pressed;
        break;
      case 'BRAKE':
        this.brakePressed = pressed;
        break;
      case 'DRIFT':
        this.driftPressed = pressed;
        break;
      case 'NITRO':
        this.nitroPressed = pressed;
        break;
    }
  }

  show(): void {
    this.isVisible = true;
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
    this.reset();
  }

  reset(): void {
    this.leftPressed = false;
    this.rightPressed = false;
    this.gasPressed = false;
    this.brakePressed = false;
    this.driftPressed = false;
    this.nitroPressed = false;
  }

  getState(): VehicleInputState {
    let steer = 0;
    if (this.leftPressed && !this.rightPressed) steer = -1;
    if (this.rightPressed && !this.leftPressed) steer = 1;

    return {
      steer,
      throttle: this.gasPressed ? 1 : 0,
      brake: this.brakePressed ? 1 : 0,
      handbrake: this.driftPressed,
      nitro: this.nitroPressed,
    };
  }
}
