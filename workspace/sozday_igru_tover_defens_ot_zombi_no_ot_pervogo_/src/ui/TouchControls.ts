export class TouchControls {
  public element: HTMLDivElement;
  private joystickZone: HTMLDivElement;
  private joystickBase: HTMLDivElement;
  private joystickStick: HTMLDivElement;
  private lookZone: HTMLDivElement;

  private activeMovePointerId: number | null = null;
  private activeLookPointerId: number | null = null;
  private joystickOrigin = { x: 0, y: 0 };

  public moveVector = { x: 0, z: 0 };
  public lookDelta = { x: 0, y: 0 };
  public isVisible = false;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'touch-layer';
    this.element.style.display = 'none';

    // 1. Зона виртуального стика (слева)
    this.joystickZone = document.createElement('div');
    this.joystickZone.className = 'joystick-zone';

    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'joystick-base';

    this.joystickStick = document.createElement('div');
    this.joystickStick.className = 'joystick-stick';

    this.joystickBase.appendChild(this.joystickStick);
    this.joystickZone.appendChild(this.joystickBase);
    this.element.appendChild(this.joystickZone);

    // 2. Зона свободного обзора (справа)
    this.lookZone = document.createElement('div');
    this.lookZone.className = 'look-zone';
    this.element.appendChild(this.lookZone);

    this.setupPointerListeners();

    // Проверка тач-устройства или отладочного флага ?touch=1
    const urlParams = new URLSearchParams(window.location.search);
    const forceTouch = urlParams.get('touch') === '1';
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    if (forceTouch || isTouchDevice) {
      this.show();
    }

    // Вставка в переданный родительский узел (DOM)
    parent.appendChild(this.element);
  }

  private setupPointerListeners(): void {
    // Джойстик перемещения
    this.joystickZone.addEventListener('pointerdown', (e) => {
      if (this.activeMovePointerId !== null) return;
      this.activeMovePointerId = e.pointerId;
      this.joystickZone.setPointerCapture(e.pointerId);

      const rect = this.joystickZone.getBoundingClientRect();
      this.joystickOrigin.x = e.clientX - rect.left;
      this.joystickOrigin.y = e.clientY - rect.top;

      this.joystickBase.style.left = `${this.joystickOrigin.x}px`;
      this.joystickBase.style.top = `${this.joystickOrigin.y}px`;
      this.joystickBase.style.display = 'block';

      this.updateStick(0, 0);
    });

    this.joystickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activeMovePointerId) return;
      const rect = this.joystickZone.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const dx = currentX - this.joystickOrigin.x;
      const dy = currentY - this.joystickOrigin.y;
      const dist = Math.hypot(dx, dy);
      const maxRadius = 50;

      if (dist < maxRadius * 0.08) {
        // Мертвая зона 8%
        this.moveVector.x = 0;
        this.moveVector.z = 0;
        this.updateStick(0, 0);
      } else {
        const clampedDist = Math.min(dist, maxRadius);
        const normX = dx / dist;
        const normY = dy / dist;

        this.moveVector.x = normX * (clampedDist / maxRadius);
        this.moveVector.z = -normY * (clampedDist / maxRadius);

        this.updateStick(normX * clampedDist, normY * clampedDist);
      }
    });

    const endMove = (e: PointerEvent) => {
      if (e.pointerId !== this.activeMovePointerId) return;
      this.activeMovePointerId = null;
      this.moveVector.x = 0;
      this.moveVector.z = 0;
      this.joystickBase.style.display = 'none';
      this.updateStick(0, 0);
    };
    this.joystickZone.addEventListener('pointerup', endMove);
    this.joystickZone.addEventListener('pointercancel', endMove);

    // Зона обзора / свайпа камеры
    let lastLookX = 0;
    let lastLookY = 0;

    this.lookZone.addEventListener('pointerdown', (e) => {
      if (this.activeLookPointerId !== null) return;
      this.activeLookPointerId = e.pointerId;
      this.lookZone.setPointerCapture(e.pointerId);
      lastLookX = e.clientX;
      lastLookY = e.clientY;
    });

    this.lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activeLookPointerId) return;
      const dx = e.clientX - lastLookX;
      const dy = e.clientY - lastLookY;
      lastLookX = e.clientX;
      lastLookY = e.clientY;

      this.lookDelta.x += dx * 0.0035;
      this.lookDelta.y += dy * 0.0035;
    });

    const endLook = (e: PointerEvent) => {
      if (e.pointerId !== this.activeLookPointerId) return;
      this.activeLookPointerId = null;
    };
    this.lookZone.addEventListener('pointerup', endLook);
    this.lookZone.addEventListener('pointercancel', endLook);
  }

  private updateStick(offsetX: number, offsetY: number): void {
    this.joystickStick.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  }

  public show(): void {
    this.isVisible = true;
    this.element.style.display = 'block';
  }

  public hide(): void {
    this.isVisible = false;
    this.element.style.display = 'none';
    this.moveVector.x = 0;
    this.moveVector.z = 0;
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
  }

  public consumeLookDelta(): { x: number; y: number } {
    const delta = { x: this.lookDelta.x, y: this.lookDelta.y };
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    return delta;
  }
}
