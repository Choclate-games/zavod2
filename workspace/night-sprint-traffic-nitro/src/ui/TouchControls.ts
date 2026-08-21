import { VehicleInput } from '../types';

export class TouchControls {
  private container: HTMLElement | null = null;
  private input: VehicleInput = {
    throttle: 0,
    brake: 0,
    steer: 0,
    nitro: false,
    nitroHoldTime: 0,
    handbrake: false,
    recover: false,
  };

  private keysDown: Record<string, boolean> = {};

  // Touch joystick tracking
  private stickPointerId: number | null = null;
  private stickOriginX = 0;
  private stickOriginY = 0;
  private stickCurrentX = 0;
  private stickKnobEl: HTMLElement | null = null;
  private stickBaseEl: HTMLElement | null = null;

  // Active touch buttons
  private isThrottleTouching = false;
  private isBrakeTouching = false;
  private isNitroTouching = false;
  private isHandbrakeTouching = false;

  mount(parent: HTMLElement): void {
    const container = document.createElement('div');
    container.id = 'touch-controls-layer';
    container.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 15; user-select: none; -webkit-user-select: none; display: none;'
    );

    // Left Steering Floating Zone
    const steerZone = document.createElement('div');
    steerZone.id = 'touch-steer-zone';
    steerZone.setAttribute(
      'style',
      'position: absolute; bottom: 0; left: 0; width: 45%; height: 60%; pointer-events: auto; touch-action: none;'
    );

    // Stick Base visual
    const stickBase = document.createElement('div');
    stickBase.setAttribute(
      'style',
      'position: absolute; width: 110px; height: 110px; border-radius: 55px; background: rgba(0, 240, 255, 0.12); border: 2px solid rgba(0, 240, 255, 0.4); transform: translate(-50%, -50%); display: none; pointer-events: none;'
    );
    const stickKnob = document.createElement('div');
    stickKnob.setAttribute(
      'style',
      'position: absolute; width: 50px; height: 50px; border-radius: 25px; background: rgba(0, 240, 255, 0.85); box-shadow: 0 0 15px #00f0ff; transform: translate(-50%, -50%); pointer-events: none;'
    );
    stickBase.appendChild(stickKnob);
    steerZone.appendChild(stickBase);
    this.stickBaseEl = stickBase;
    this.stickKnobEl = stickKnob;

    // Right Action Buttons Zone
    const actionZone = document.createElement('div');
    actionZone.id = 'touch-action-zone';
    actionZone.setAttribute(
      'style',
      'position: absolute; bottom: calc(20px + env(safe-area-inset-bottom)); right: calc(20px + env(safe-area-inset-right)); display: flex; flex-direction: column; gap: 14px; pointer-events: auto; touch-action: none;'
    );

    // Nitro Button (Big Glowing Cyan/Magenta)
    const nitroBtn = document.createElement('div');
    nitroBtn.id = 'btn-touch-nitro';
    nitroBtn.setAttribute(
      'style',
      'width: 72px; height: 72px; border-radius: 36px; background: linear-gradient(135deg, #00f0ff, #ff007f); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; color: #fff; box-shadow: 0 0 18px #00f0ff; touch-action: none; cursor: pointer;'
    );
    nitroBtn.textContent = 'N2O';

    // Throttle & Brake horizontal row
    const pedalRow = document.createElement('div');
    pedalRow.setAttribute('style', 'display: flex; gap: 14px; align-items: center;');

    const brakeBtn = document.createElement('div');
    brakeBtn.id = 'btn-touch-brake';
    brakeBtn.setAttribute(
      'style',
      'width: 64px; height: 64px; border-radius: 32px; background: rgba(255, 0, 51, 0.35); border: 2px solid #ff0033; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: #ff0033; box-shadow: 0 0 12px rgba(255, 0, 51, 0.4); touch-action: none; cursor: pointer;'
    );
    brakeBtn.textContent = 'ТОРМОЗ';

    const gasBtn = document.createElement('div');
    gasBtn.id = 'btn-touch-gas';
    gasBtn.setAttribute(
      'style',
      'width: 68px; height: 68px; border-radius: 34px; background: rgba(0, 255, 102, 0.35); border: 2px solid #00ff66; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; color: #00ff66; box-shadow: 0 0 14px rgba(0, 255, 102, 0.4); touch-action: none; cursor: pointer;'
    );
    gasBtn.textContent = 'ГАЗ';

    pedalRow.appendChild(brakeBtn);
    pedalRow.appendChild(gasBtn);

    // Handbrake pill button
    const handbrakeBtn = document.createElement('div');
    handbrakeBtn.id = 'btn-touch-handbrake';
    handbrakeBtn.setAttribute(
      'style',
      'width: 140px; height: 38px; border-radius: 19px; background: rgba(255, 215, 0, 0.25); border: 1.5px solid #ffd700; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px; color: #ffd700; box-shadow: 0 0 10px rgba(255, 215, 0, 0.3); touch-action: none; cursor: pointer;'
    );
    handbrakeBtn.textContent = 'ДРИФТ / РУЧНИК';

    actionZone.appendChild(nitroBtn);
    actionZone.appendChild(pedalRow);
    actionZone.appendChild(handbrakeBtn);

    container.appendChild(steerZone);
    container.appendChild(actionZone);
    parent.appendChild(container);
    this.container = container;

    this.bindTouchEvents(steerZone, gasBtn, brakeBtn, nitroBtn, handbrakeBtn);
    this.bindKeyboardEvents();
  }

  show(): void {
    if (this.container) this.container.style.display = 'block';
  }

  hide(): void {
    if (this.container) this.container.style.display = 'none';
  }

  private bindTouchEvents(
    steerZone: HTMLElement,
    gasBtn: HTMLElement,
    brakeBtn: HTMLElement,
    nitroBtn: HTMLElement,
    handbrakeBtn: HTMLElement
  ): void {
    // Floating Stick
    steerZone.addEventListener('pointerdown', (e) => {
      if (this.stickPointerId !== null) return;
      this.stickPointerId = e.pointerId;
      this.stickOriginX = e.clientX;
      this.stickOriginY = e.clientY;
      this.stickCurrentX = e.clientX;

      if (this.stickBaseEl && this.stickKnobEl) {
        const rect = steerZone.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        this.stickBaseEl.style.left = localX + 'px';
        this.stickBaseEl.style.top = localY + 'px';
        this.stickBaseEl.style.display = 'block';
        this.stickKnobEl.style.left = '55px';
        this.stickKnobEl.style.top = '55px';
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.stickCurrentX = e.clientX;
      const deltaX = this.stickCurrentX - this.stickOriginX;
      const maxRadius = 45;
      const clampedDeltaX = Math.min(maxRadius, Math.max(-maxRadius, deltaX));

      if (this.stickKnobEl) {
        this.stickKnobEl.style.left = (55 + clampedDeltaX) + 'px';
      }
    });

    const resetStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.stickPointerId = null;
      this.stickOriginX = 0;
      this.stickCurrentX = 0;
      if (this.stickBaseEl) this.stickBaseEl.style.display = 'none';
    };
    window.addEventListener('pointerup', resetStick);
    window.addEventListener('pointercancel', resetStick);

    // Gas Button
    gasBtn.addEventListener('pointerdown', () => { this.isThrottleTouching = true; });
    gasBtn.addEventListener('pointerup', () => { this.isThrottleTouching = false; });
    gasBtn.addEventListener('pointercancel', () => { this.isThrottleTouching = false; });

    // Brake Button
    brakeBtn.addEventListener('pointerdown', () => { this.isBrakeTouching = true; });
    brakeBtn.addEventListener('pointerup', () => { this.isBrakeTouching = false; });
    brakeBtn.addEventListener('pointercancel', () => { this.isBrakeTouching = false; });

    // Nitro Button
    nitroBtn.addEventListener('pointerdown', () => { this.isNitroTouching = true; });
    nitroBtn.addEventListener('pointerup', () => { this.isNitroTouching = false; });
    nitroBtn.addEventListener('pointercancel', () => { this.isNitroTouching = false; });

    // Handbrake Button
    handbrakeBtn.addEventListener('pointerdown', () => { this.isHandbrakeTouching = true; });
    handbrakeBtn.addEventListener('pointerup', () => { this.isHandbrakeTouching = false; });
    handbrakeBtn.addEventListener('pointercancel', () => { this.isHandbrakeTouching = false; });
  }

  private bindKeyboardEvents(): void {
    window.addEventListener('keydown', (e) => {
      this.keysDown[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown[e.code] = false;
    });
  }

  update(dt: number): VehicleInput {
    let steer = 0;
    if (this.stickPointerId !== null) {
      const deltaX = this.stickCurrentX - this.stickOriginX;
      steer = Math.min(1.0, Math.max(-1.0, deltaX / 45.0));
    } else {
      if (this.keysDown['ArrowLeft'] || this.keysDown['KeyA']) steer -= 1.0;
      if (this.keysDown['ArrowRight'] || this.keysDown['KeyD']) steer += 1.0;
    }

    let throttle = 0;
    if (this.isThrottleTouching || this.keysDown['ArrowUp'] || this.keysDown['KeyW']) {
      throttle = 1.0;
    }

    let brake = 0;
    if (this.isBrakeTouching || this.keysDown['ArrowDown'] || this.keysDown['KeyS']) {
      brake = 1.0;
    }

    const nitro = this.isNitroTouching || Boolean(this.keysDown['Space'] || this.keysDown['ShiftLeft']);
    const handbrake = this.isHandbrakeTouching || Boolean(this.keysDown['KeyE'] || this.keysDown['KeyC']);

    if (nitro) {
      this.input.nitroHoldTime += dt;
    } else {
      this.input.nitroHoldTime = 0;
    }

    this.input.steer = steer;
    this.input.throttle = throttle;
    this.input.brake = brake;
    this.input.nitro = nitro;
    this.input.handbrake = handbrake;
    this.input.recover = Boolean(this.keysDown['KeyR']);

    return this.input;
  }
}