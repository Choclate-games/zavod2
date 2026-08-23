import { inputManager } from '../input/InputManager';
import { ICONS } from './icons';

export class TouchControls {
  public element: HTMLDivElement;
  private leftZone: HTMLDivElement;
  private rightZone: HTMLDivElement;
  private stickBase: HTMLDivElement;
  private stickKnob: HTMLDivElement;

  private fireBtn: HTMLButtonElement;
  private adsBtn: HTMLButtonElement;
  private jumpBtn: HTMLButtonElement;
  private uavBtn: HTMLButtonElement;

  private movePointerId: number | null = null;
  private lookPointerId: number | null = null;
  private stickCenter = { x: 0, y: 0 };
  private lastLookPos = { x: 0, y: 0 };
  private touchStartY: number = 0;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'touch-controls-root';
    this.element.className = 'ui-layer';
    this.element.style.display = 'none';

    // Left half: Virtual Joystick Zone
    this.leftZone = document.createElement('div');
    this.leftZone.className = 'touch-zone-left';
    this.element.appendChild(this.leftZone);

    this.stickBase = document.createElement('div');
    this.stickBase.className = 'touch-stick-base';
    this.stickKnob = document.createElement('div');
    this.stickKnob.className = 'touch-stick-knob';
    this.stickBase.appendChild(this.stickKnob);
    this.leftZone.appendChild(this.stickBase);

    // Right half: Look & Action Buttons Zone
    this.rightZone = document.createElement('div');
    this.rightZone.className = 'touch-zone-right';
    this.element.appendChild(this.rightZone);

    // Action buttons
    this.fireBtn = document.createElement('button');
    this.fireBtn.type = 'button';
    this.fireBtn.className = 'btn touch-btn-fire';
    this.fireBtn.innerHTML = ICONS.crosshair;
    this.element.appendChild(this.fireBtn);

    this.adsBtn = document.createElement('button');
    this.adsBtn.type = 'button';
    this.adsBtn.className = 'btn touch-btn-ads';
    this.adsBtn.innerHTML = ICONS.ads;
    this.element.appendChild(this.adsBtn);

    this.jumpBtn = document.createElement('button');
    this.jumpBtn.type = 'button';
    this.jumpBtn.className = 'btn touch-btn-jump';
    this.jumpBtn.innerHTML = ICONS.jump;
    this.element.appendChild(this.jumpBtn);

    this.uavBtn = document.createElement('button');
    this.uavBtn.type = 'button';
    this.uavBtn.className = 'btn btn-success touch-btn-uav';
    this.uavBtn.innerHTML = `${ICONS.uav} <span>БПЛА РАЗВЕДКА</span>`;
    this.element.appendChild(this.uavBtn);

    parent.appendChild(this.element);
    this.setupListeners();
    this.checkTouchSupport();
  }

  private checkTouchSupport(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const forceTouch = urlParams.get('touch') === '1';
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    if (isTouchDevice || forceTouch) {
      this.element.style.display = 'block';
    }
  }

  public setVisible(visible: boolean): void {
    const urlParams = new URLSearchParams(window.location.search);
    const forceTouch = urlParams.get('touch') === '1';
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    if ((isTouchDevice || forceTouch) && visible) {
      this.element.style.display = 'block';
    } else {
      this.element.style.display = 'none';
      this.reset();
    }
  }

  public setUavButtonVisible(visible: boolean): void {
    this.uavBtn.style.display = visible ? 'flex' : 'none';
  }

  private setupListeners(): void {
    // 1. Left Zone - Floating Joystick
    this.leftZone.addEventListener('pointerdown', (e) => {
      if (this.movePointerId !== null) return;
      this.movePointerId = e.pointerId;
      this.leftZone.setPointerCapture(e.pointerId);

      this.stickCenter = { x: e.clientX, y: e.clientY };
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickBase.style.display = 'block';
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
    });

    this.leftZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.movePointerId) return;

      const dx = e.clientX - this.stickCenter.x;
      const dy = e.clientY - this.stickCenter.y;
      const dist = Math.hypot(dx, dy);
      const maxRadius = 50;

      // 8% deadzone
      if (dist < maxRadius * 0.08) {
        inputManager.touchMoveX = 0;
        inputManager.touchMoveZ = 0;
        this.stickKnob.style.transform = 'translate(-50%, -50%)';
        return;
      }

      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      this.stickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

      inputManager.touchMoveX = knobX / maxRadius;
      inputManager.touchMoveZ = knobY / maxRadius;
    });

    const endMove = (e: PointerEvent) => {
      if (e.pointerId !== this.movePointerId) return;
      this.movePointerId = null;
      this.stickBase.style.display = 'none';
      inputManager.touchMoveX = 0;
      inputManager.touchMoveZ = 0;
    };
    this.leftZone.addEventListener('pointerup', endMove);
    this.leftZone.addEventListener('pointercancel', endMove);

    // 2. Right Zone - Aim Look Drag & Downward Swipe for Slide
    this.rightZone.addEventListener('pointerdown', (e) => {
      if (this.lookPointerId !== null) return;
      this.lookPointerId = e.pointerId;
      this.rightZone.setPointerCapture(e.pointerId);
      this.lastLookPos = { x: e.clientX, y: e.clientY };
      this.touchStartY = e.clientY;
    });

    this.rightZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointerId) return;

      const dx = e.clientX - this.lastLookPos.x;
      const dy = e.clientY - this.lastLookPos.y;
      this.lastLookPos = { x: e.clientX, y: e.clientY };

      inputManager.touchLookDeltaX += dx * 0.0035;
      inputManager.touchLookDeltaY += dy * 0.0035;

      // Downward swipe detection for Combat Slide
      if (e.clientY - this.touchStartY > 45) {
        inputManager.touchSlidePressed = true;
        this.touchStartY = e.clientY;
      }
    });

    const endLook = (e: PointerEvent) => {
      if (e.pointerId !== this.lookPointerId) return;
      this.lookPointerId = null;
    };
    this.rightZone.addEventListener('pointerup', endLook);
    this.rightZone.addEventListener('pointercancel', endLook);

    // 3. Action Buttons
    this.fireBtn.addEventListener('pointerdown', (e) => {
      this.fireBtn.setPointerCapture(e.pointerId);
      inputManager.touchFiring = true;
      inputManager.touchFireJustPressed = true;
    });
    this.fireBtn.addEventListener('pointerup', () => {
      inputManager.touchFiring = false;
    });
    this.fireBtn.addEventListener('pointercancel', () => {
      inputManager.touchFiring = false;
    });

    this.adsBtn.addEventListener('click', () => {
      inputManager.touchAiming = !inputManager.touchAiming;
    });

    this.jumpBtn.addEventListener('pointerdown', () => {
      inputManager.touchJumpPressed = true;
    });

    this.uavBtn.addEventListener('click', () => {
      inputManager.touchUavPressed = true;
    });
  }

  public reset(): void {
    this.movePointerId = null;
    this.lookPointerId = null;
    this.stickBase.style.display = 'none';
    inputManager.touchMoveX = 0;
    inputManager.touchMoveZ = 0;
    inputManager.touchFiring = false;
    inputManager.touchAiming = false;
  }
}