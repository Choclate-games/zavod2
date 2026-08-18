import * as THREE from 'three';

export class VirtualJoystick {
  private zoneEl: HTMLElement;
  private baseEl: HTMLElement;
  private knobEl: HTMLElement;

  private isDragging = false;
  private touchId: number | null = null;
  private basePos: { x: number; y: number } = { x: 0, y: 0 };
  private maxRadius = 50;

  public moveVector: THREE.Vector2 = new THREE.Vector2(0, 0);

  // Keyboard state
  private keyState: Record<string, boolean> = {};

  constructor(zoneElement: HTMLElement, baseElement: HTMLElement, knobElement: HTMLElement) {
    this.zoneEl = zoneElement;
    this.baseEl = baseElement;
    this.knobEl = knobElement;

    this.setupTouchListeners();
    this.setupKeyboardListeners();
  }

  private setupTouchListeners(): void {
    // Touch Events
    this.zoneEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.isDragging) return;

      const touch = e.changedTouches[0];
      this.touchId = touch.identifier;
      this.isDragging = true;

      this.basePos = { x: touch.clientX, y: touch.clientY };
      this.baseEl.style.left = `${this.basePos.x}px`;
      this.baseEl.style.top = `${this.basePos.y}px`;
      this.baseEl.style.display = 'block';

      this.updateKnob(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          e.preventDefault();
          this.updateKnob(touch.clientX, touch.clientY);
          break;
        }
      }
    }, { passive: false });

    const endTouch = (e: TouchEvent) => {
      if (!this.isDragging) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchId) {
          this.isDragging = false;
          this.touchId = null;
          this.baseEl.style.display = 'none';
          this.resetMoveVector();
          break;
        }
      }
    };

    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);

    // Mouse Fallback for testing joystick on desktop
    this.zoneEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.basePos = { x: e.clientX, y: e.clientY };
      this.baseEl.style.left = `${this.basePos.x}px`;
      this.baseEl.style.top = `${this.basePos.y}px`;
      this.baseEl.style.display = 'block';
      this.updateKnob(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.updateKnob(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.baseEl.style.display = 'none';
        this.resetMoveVector();
      }
    });
  }

  private updateKnob(clientX: number, clientY: number): void {
    const dx = clientX - this.basePos.x;
    const dy = clientY - this.basePos.y;
    const dist = Math.hypot(dx, dy);

    const clampedDist = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    this.knobEl.style.transform = `translate3d(${knobX}px, ${knobY}px, 0)`;

    // Output normalized vector
    const intensity = clampedDist / this.maxRadius;
    this.moveVector.set(Math.cos(angle) * intensity, Math.sin(angle) * intensity);
  }

  private resetMoveVector(): void {
    this.knobEl.style.transform = `translate3d(0, 0, 0)`;
    this.moveVector.set(0, 0);
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keyState[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keyState[e.code] = false;
    });
  }

  public getVector(): THREE.Vector2 {
    let kx = 0;
    let kz = 0;

    if (this.keyState['KeyW'] || this.keyState['ArrowUp']) kz -= 1;
    if (this.keyState['KeyS'] || this.keyState['ArrowDown']) kz += 1;
    if (this.keyState['KeyA'] || this.keyState['ArrowLeft']) kx -= 1;
    if (this.keyState['KeyD'] || this.keyState['ArrowRight']) kx += 1;

    if (kx !== 0 || kz !== 0) {
      const len = Math.hypot(kx, kz);
      return new THREE.Vector2(kx / len, kz / len);
    }

    return this.moveVector;
  }
}
