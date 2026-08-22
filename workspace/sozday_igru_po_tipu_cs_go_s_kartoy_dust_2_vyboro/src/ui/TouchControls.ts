import { ICONS } from './icons';
import { audio } from '../audio/AudioManager';

export interface TouchInputState {
  moveX: number; // -1 to 1
  moveY: number; // -1 to 1
  lookDeltaX: number; // pixels
  lookDeltaY: number; // pixels
  isFiring: boolean;
  isDefusing: boolean;
  isReloading: boolean;
  isSwitchingWeapon: boolean;
  wasSwipeStopped: boolean;
}

export class TouchControls {
  private static instance: TouchControls;
  public readonly element: HTMLDivElement;

  private leftStickZone: HTMLDivElement;
  private rightAimZone: HTMLDivElement;
  private fireBtn: HTMLButtonElement;
  private defuseBtn: HTMLButtonElement;
  private reloadBtn: HTMLButtonElement;
  private weaponBtn: HTMLButtonElement;

  private stickBase: HTMLDivElement;
  private stickKnob: HTMLDivElement;

  private activeStickPointerId: number | null = null;
  private activeAimPointerId: number | null = null;
  private stickOriginX = 0;
  private stickOriginY = 0;
  private lastAimX = 0;
  private lastAimY = 0;

  private state: TouchInputState = {
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    isFiring: false,
    isDefusing: false,
    isReloading: false,
    isSwitchingWeapon: false,
    wasSwipeStopped: false,
  };

  private isEnabled = false;

  private constructor() {
    this.element = document.createElement('div');
    this.element.className = 'touch-controls-layer';
    this.element.style.display = 'none';

    // Left move zone (45%)
    this.leftStickZone = document.createElement('div');
    this.leftStickZone.className = 'touch-stick-zone';

    this.stickBase = document.createElement('div');
    this.stickBase.style.cssText = 'position:absolute;width:100px;height:100px;border-radius:50%;border:2px dashed rgba(255,255,255,0.4);display:none;pointer-events:none;transform:translate(-50%,-50%);';

    this.stickKnob = document.createElement('div');
    this.stickKnob.style.cssText = 'position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(255,153,0,0.8);top:28px;left:28px;';
    this.stickBase.appendChild(this.stickKnob);
    this.leftStickZone.appendChild(this.stickBase);

    // Right aim zone (55%)
    this.rightAimZone = document.createElement('div');
    this.rightAimZone.className = 'touch-aim-zone';

    // Action buttons
    this.fireBtn = document.createElement('button');
    this.fireBtn.className = 'touch-btn touch-btn-fire';
    this.fireBtn.innerHTML = ICONS.CROSSHAIR;
    this.fireBtn.setAttribute('aria-label', 'Fire');

    this.defuseBtn = document.createElement('button');
    this.defuseBtn.className = 'touch-btn touch-btn-defuse';
    this.defuseBtn.innerHTML = ICONS.DEFUSE_KIT;
    this.defuseBtn.setAttribute('aria-label', 'Defuse C4');

    this.reloadBtn = document.createElement('button');
    this.reloadBtn.className = 'touch-btn touch-btn-reload';
    this.reloadBtn.innerHTML = ICONS.RELOAD;
    this.reloadBtn.setAttribute('aria-label', 'Reload');

    this.weaponBtn = document.createElement('button');
    this.weaponBtn.className = 'touch-btn touch-btn-weapon';
    this.weaponBtn.innerHTML = ICONS.AK47;
    this.weaponBtn.setAttribute('aria-label', 'Switch Weapon');

    this.element.appendChild(this.leftStickZone);
    this.element.appendChild(this.rightAimZone);
    this.element.appendChild(this.fireBtn);
    this.element.appendChild(this.defuseBtn);
    this.element.appendChild(this.reloadBtn);
    this.element.appendChild(this.weaponBtn);

    this.initEvents();
  }

  public static getInstance(): TouchControls {
    if (!TouchControls.instance) {
      TouchControls.instance = new TouchControls();
    }
    return TouchControls.instance;
  }

  private initEvents(): void {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const urlParams = new URLSearchParams(window.location.search);
    const forceTouch = urlParams.get('touch');

    if (forceTouch === '1' || (forceTouch !== '0' && isTouchDevice)) {
      this.isEnabled = true;
    }

    // Left Stick Events
    this.leftStickZone.addEventListener('pointerdown', (e) => {
      if (this.activeStickPointerId !== null) return;
      this.activeStickPointerId = e.pointerId;
      this.leftStickZone.setPointerCapture(e.pointerId);

      this.stickOriginX = e.clientX;
      this.stickOriginY = e.clientY;
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickBase.style.display = 'block';
      this.stickKnob.style.transform = 'translate(0px, 0px)';
      this.state.wasSwipeStopped = false;
    });

    this.leftStickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activeStickPointerId) return;

      const dx = e.clientX - this.stickOriginX;
      const dy = e.clientY - this.stickOriginY;
      const dist = Math.hypot(dx, dy);
      const maxRadius = 45;

      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.atan2(dy, dx) ? Math.sin(angle) * clampedDist : 0;
      this.stickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

      // Deadzone 8%
      if (dist < 4) {
        this.state.moveX = 0;
        this.state.moveY = 0;
      } else {
        this.state.moveX = dx / maxRadius;
        this.state.moveY = dy / maxRadius;
      }
    });

    const releaseStick = (e: PointerEvent) => {
      if (e.pointerId !== this.activeStickPointerId) return;
      this.activeStickPointerId = null;
      this.stickBase.style.display = 'none';
      this.state.moveX = 0;
      this.state.moveY = 0;
      this.state.wasSwipeStopped = true; // triggers counter-strafe brake
      audio.playScuffStep();
    };

    this.leftStickZone.addEventListener('pointerup', releaseStick);
    this.leftStickZone.addEventListener('pointercancel', releaseStick);

    // Right Aim Events
    this.rightAimZone.addEventListener('pointerdown', (e) => {
      if (this.activeAimPointerId !== null) return;
      this.activeAimPointerId = e.pointerId;
      this.rightAimZone.setPointerCapture(e.pointerId);
      this.lastAimX = e.clientX;
      this.lastAimY = e.clientY;
    });

    this.rightAimZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activeAimPointerId) return;

      this.state.lookDeltaX += e.clientX - this.lastAimX;
      this.state.lookDeltaY += e.clientY - this.lastAimY;
      this.lastAimX = e.clientX;
      this.lastAimY = e.clientY;
    });

    const releaseAim = (e: PointerEvent) => {
      if (e.pointerId !== this.activeAimPointerId) return;
      this.activeAimPointerId = null;
    };

    this.rightAimZone.addEventListener('pointerup', releaseAim);
    this.rightAimZone.addEventListener('pointercancel', releaseAim);

    // Button Pointer Events
    this.bindButtonPointer(this.fireBtn, (pressed) => {
      this.state.isFiring = pressed;
    });

    this.bindButtonPointer(this.defuseBtn, (pressed) => {
      this.state.isDefusing = pressed;
    });

    this.bindButtonPointer(this.reloadBtn, (pressed) => {
      if (pressed) {
        this.state.isReloading = true;
      }
    });

    this.bindButtonPointer(this.weaponBtn, (pressed) => {
      if (pressed) {
        this.state.isSwitchingWeapon = true;
      }
    });

    // Reset on window blur
    window.addEventListener('blur', () => this.reset());
  }

  private bindButtonPointer(btn: HTMLElement, callback: (pressed: boolean) => void): void {
    const heldPointers = new Set<number>();

    btn.addEventListener('pointerdown', (e) => {
      btn.setPointerCapture(e.pointerId);
      heldPointers.add(e.pointerId);
      callback(true);
    });

    const onRelease = (e: PointerEvent) => {
      heldPointers.delete(e.pointerId);
      if (heldPointers.size === 0) {
        callback(false);
      }
    };

    btn.addEventListener('pointerup', onRelease);
    btn.addEventListener('pointercancel', onRelease);
  }

  public show(): void {
    if (this.isEnabled) {
      this.element.style.display = 'block';
    }
  }

  public hide(): void {
    this.element.style.display = 'none';
    this.reset();
  }

  public reset(): void {
    this.activeStickPointerId = null;
    this.activeAimPointerId = null;
    this.stickBase.style.display = 'none';
    this.state.moveX = 0;
    this.state.moveY = 0;
    this.state.lookDeltaX = 0;
    this.state.lookDeltaY = 0;
    this.state.isFiring = false;
    this.state.isDefusing = false;
    this.state.isReloading = false;
    this.state.isSwitchingWeapon = false;
    this.state.wasSwipeStopped = false;
  }

  public consumeInput(): TouchInputState {
    const res: TouchInputState = {
      ...this.state,
    };
    this.state.lookDeltaX = 0;
    this.state.lookDeltaY = 0;
    this.state.isReloading = false;
    this.state.isSwitchingWeapon = false;
    this.state.wasSwipeStopped = false;
    return res;
  }
}

export const touchControls = TouchControls.getInstance();
