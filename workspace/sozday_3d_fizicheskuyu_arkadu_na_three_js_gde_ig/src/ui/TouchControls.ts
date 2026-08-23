/**
 * TouchControls: Unified Pointer & Keyboard input adapter.
 * Check G4: Layer is created AND mounted into DOM.
 */

export interface InputState {
  targetBaseX: number;
  isCrouching: boolean;
  pitchLeanOffset: number;
}

export class TouchControls {
  private element: HTMLElement;
  private inputState: InputState = {
    targetBaseX: 0,
    isCrouching: false,
    pitchLeanOffset: 0
  };

  private activePointerId: number | null = null;
  private pointerStartX: number = 0;
  private pointerStartY: number = 0;
  private onGripCallback?: () => void;

  // Keyboard state
  private keyState = {
    left: false,
    right: false,
    up: false,
    down: false
  };

  constructor(parentContainer: HTMLElement, onGrip?: () => void) {
    this.onGripCallback = onGrip;
    this.element = document.createElement('div');
    this.element.className = 'ui-layer';
    this.element.style.pointerEvents = 'none';

    // Touch zone in the bottom half of the screen
    const touchZone = document.createElement('div');
    touchZone.style.position = 'absolute';
    touchZone.style.bottom = '0';
    touchZone.style.left = '0';
    touchZone.style.width = '100%';
    touchZone.style.height = '60%';
    touchZone.style.pointerEvents = 'auto';
    touchZone.style.touchAction = 'none';
    this.element.appendChild(touchZone);

    // Mount to DOM
    parentContainer.appendChild(this.element);

    this.bindPointerEvents(touchZone);
    this.bindKeyboardEvents();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public getInputState(): InputState {
    // Process keyboard contribution
    let kbX = 0;
    if (this.keyState.left) kbX -= 0.8;
    if (this.keyState.right) kbX += 0.8;

    const isKbCrouch = this.keyState.down;
    let kbPitch = 0;
    if (this.keyState.up) kbPitch -= 0.8;
    if (this.keyState.down) kbPitch += 0.8;

    return {
      targetBaseX: Math.abs(kbX) > 0.01 ? kbX : this.inputState.targetBaseX,
      isCrouching: isKbCrouch || this.inputState.isCrouching,
      pitchLeanOffset: Math.abs(kbPitch) > 0.01 ? kbPitch : this.inputState.pitchLeanOffset
    };
  }

  private bindPointerEvents(zone: HTMLElement): void {
    zone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.pointerStartX = e.clientX;
      this.pointerStartY = e.clientY;
    });

    zone.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.activePointerId !== e.pointerId) return;
      const deltaX = e.clientX - this.pointerStartX;
      const deltaY = e.clientY - this.pointerStartY;

      // Horizontal sway mapping (-0.8m .. +0.8m)
      const maxPixelRange = window.innerWidth * 0.45;
      const normX = Math.max(-1.0, Math.min(1.0, deltaX / maxPixelRange));
      this.inputState.targetBaseX = normX * 0.8;

      // Vertical drag mapping
      if (deltaY > 40) {
        this.inputState.isCrouching = true;
      } else {
        this.inputState.isCrouching = false;
      }

      this.inputState.pitchLeanOffset = Math.max(-1.0, Math.min(1.0, deltaY / 150));
    });

    const resetPointer = (e: PointerEvent) => {
      if (this.activePointerId === e.pointerId) {
        this.activePointerId = null;
        try {
          zone.releasePointerCapture(e.pointerId);
        } catch {}
        this.inputState.targetBaseX = 0;
        this.inputState.isCrouching = false;
        this.inputState.pitchLeanOffset = 0;
      }
    };

    zone.addEventListener('pointerup', resetPointer);
    zone.addEventListener('pointercancel', resetPointer);
  }

  private bindKeyboardEvents(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.keyState.left = true;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.keyState.right = true;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        this.keyState.down = true;
      }
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.keyState.up = true;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.onGripCallback) {
          this.onGripCallback();
        }
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.keyState.left = false;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.keyState.right = false;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        this.keyState.down = false;
      }
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.keyState.up = false;
      }
    });
  }
}
