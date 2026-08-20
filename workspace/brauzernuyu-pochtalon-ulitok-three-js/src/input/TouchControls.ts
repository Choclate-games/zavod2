type ActionName = 'hydrate' | 'guard';

export class TouchControls {
  private readonly layer: HTMLElement;
  private readonly joystickZone: HTMLElement;
  private readonly joystickBase: HTMLElement;
  private readonly joystickKnob: HTMLElement;
  private readonly actionPointers = new Map<ActionName, Set<number>>();
  private readonly actionRequests = new Map<ActionName, number>();
  private readonly enabled: boolean;
  private joystickPointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private _axisX = 0;
  private _axisY = 0;
  private readonly maxRadius = 56;

  public constructor() {
    this.layer = document.getElementById('touch-controls') as HTMLElement;
    this.joystickZone = document.getElementById('joystick-zone') as HTMLElement;
    this.joystickBase = document.getElementById('joystick-base') as HTMLElement;
    this.joystickKnob = document.getElementById('joystick-knob') as HTMLElement;
    this.actionPointers.set('hydrate', new Set<number>());
    this.actionPointers.set('guard', new Set<number>());
    this.actionRequests.set('hydrate', 0);
    this.actionRequests.set('guard', 0);
    const forced = new URLSearchParams(window.location.search).get('touch');
    this.enabled = forced === '1' || (forced !== '0' && ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900));
    this.bindJoystick();
    this.bindAction('hydrate', document.getElementById('hydrate-button') as HTMLElement);
    this.bindAction('guard', document.getElementById('guard-button') as HTMLElement);
    this.layer.addEventListener('contextmenu', (event) => event.preventDefault());
    this.layer.addEventListener('dragstart', (event) => event.preventDefault());
    this.layer.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
  }

  public get axisX(): number { return this._axisX; }
  public get axisY(): number { return this._axisY; }

  public setVisible(visible: boolean): void {
    this.layer.style.display = visible && this.enabled ? 'block' : 'none';
    if (!visible) this.releaseAll();
  }

  public consumeAction(action: ActionName): boolean {
    const requests = this.actionRequests.get(action) ?? 0;
    if (requests <= 0) return false;
    this.actionRequests.set(action, requests - 1);
    return true;
  }

  public releaseAll(): void {
    this.joystickPointerId = null;
    this._axisX = 0;
    this._axisY = 0;
    this.joystickBase.style.display = 'none';
    this.joystickKnob.style.transform = 'translate(0, 0)';
    for (const pointers of this.actionPointers.values()) pointers.clear();
    for (const action of this.actionRequests.keys()) this.actionRequests.set(action, 0);
  }

  private bindJoystick(): void {
    this.joystickZone.addEventListener('pointerdown', (event: PointerEvent) => {
      event.preventDefault();
      if (this.joystickPointerId !== null) return;
      this.joystickPointerId = event.pointerId;
      this.joystickZone.setPointerCapture(event.pointerId);
      this.originX = event.clientX;
      this.originY = event.clientY;
      this.joystickBase.style.display = 'block';
      this.joystickBase.style.left = `${event.clientX}px`;
      this.joystickBase.style.top = `${event.clientY}px`;
      this.updateJoystick(event.clientX, event.clientY);
    });
    this.joystickZone.addEventListener('pointermove', (event: PointerEvent) => {
      if (event.pointerId === this.joystickPointerId) this.updateJoystick(event.clientX, event.clientY);
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this._axisX = 0;
      this._axisY = 0;
      this.joystickBase.style.display = 'none';
    };
    this.joystickZone.addEventListener('pointerup', release);
    this.joystickZone.addEventListener('pointercancel', release);
    this.joystickZone.addEventListener('lostpointercapture', release);
  }

  private bindAction(action: ActionName, button: HTMLElement): void {
    const pointers = this.actionPointers.get(action);
    if (!pointers) return;
    const release = (event: PointerEvent) => { pointers.delete(event.pointerId); button.classList.toggle('pressed', pointers.size > 0); };
    button.addEventListener('pointerdown', (event: PointerEvent) => {
      event.preventDefault();
      if (pointers.size === 0) this.actionRequests.set(action, (this.actionRequests.get(action) ?? 0) + 1);
      pointers.add(event.pointerId);
      button.setPointerCapture(event.pointerId);
      button.classList.add('pressed');
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  private updateJoystick(clientX: number, clientY: number): void {
    const dx = clientX - this.originX;
    const dy = clientY - this.originY;
    const length = Math.hypot(dx, dy);
    const scale = length > this.maxRadius ? this.maxRadius / length : 1;
    const limitedX = dx * scale;
    const limitedY = dy * scale;
    const normalizedX = limitedX / this.maxRadius;
    const normalizedY = limitedY / this.maxRadius;
    const deadZone = 0.08;
    this._axisX = Math.abs(normalizedX) < deadZone ? 0 : Math.sign(normalizedX) * (Math.abs(normalizedX) - deadZone) / (1 - deadZone);
    this._axisY = Math.abs(normalizedY) < deadZone ? 0 : Math.sign(normalizedY) * (Math.abs(normalizedY) - deadZone) / (1 - deadZone);
    this.joystickKnob.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
  }
}
