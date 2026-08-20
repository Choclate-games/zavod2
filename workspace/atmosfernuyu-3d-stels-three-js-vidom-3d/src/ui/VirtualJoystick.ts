export class VirtualJoystick {
  private zone: HTMLElement;
  private base: HTMLElement;
  private thumb: HTMLElement;

  private activePointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private currentX = 0;
  private currentY = 0;

  private readonly maxRadius = 55;
  private readonly deadzone = 0.08;

  public axisX = 0;
  public axisY = 0;
  public isActive = false;

  constructor() {
    this.zone = document.getElementById('joystick-zone')!;
    this.base = document.getElementById('joystick-base')!;
    this.thumb = document.getElementById('joystick-thumb')!;

    this.setupListeners();
  }

  private setupListeners(): void {
    if (!this.zone) return;

    this.zone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.activePointerId !== null) return;
      e.preventDefault();

      this.activePointerId = e.pointerId;
      try {
        this.zone.setPointerCapture(e.pointerId);
      } catch {}

      const rect = this.zone.getBoundingClientRect();
      this.originX = e.clientX - rect.left;
      this.originY = e.clientY - rect.top;
      this.currentX = this.originX;
      this.currentY = this.originY;

      this.base.style.left = `${this.originX}px`;
      this.base.style.top = `${this.originY}px`;
      this.base.style.display = 'block';

      this.thumb.style.left = '50%';
      this.thumb.style.top = '50%';

      this.isActive = true;
      this.updateAxes();
    });

    this.zone.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.activePointerId !== e.pointerId) return;
      e.preventDefault();

      const rect = this.zone.getBoundingClientRect();
      this.currentX = e.clientX - rect.left;
      this.currentY = e.clientY - rect.top;

      this.updateAxes();
    });

    const endHandler = (e: PointerEvent) => {
      if (this.activePointerId !== e.pointerId) return;
      this.reset();
    };

    this.zone.addEventListener('pointerup', endHandler);
    this.zone.addEventListener('pointercancel', endHandler);
    this.zone.addEventListener('lostpointercapture', endHandler);
  }

  private updateAxes(): void {
    const dx = this.currentX - this.originX;
    const dy = this.currentY - this.originY;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
      this.axisX = 0;
      this.axisY = 0;
      this.thumb.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const clampedDist = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);

    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;
    this.thumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;

    const norm = clampedDist / this.maxRadius;
    if (norm < this.deadzone) {
      this.axisX = 0;
      this.axisY = 0;
    } else {
      const scaled = (norm - this.deadzone) / (1 - this.deadzone);
      this.axisX = Math.cos(angle) * scaled;
      this.axisY = Math.sin(angle) * scaled;
    }
  }

  reset(): void {
    if (this.activePointerId !== null) {
      try {
        this.zone.releasePointerCapture(this.activePointerId);
      } catch {}
    }
    this.activePointerId = null;
    this.axisX = 0;
    this.axisY = 0;
    this.isActive = false;
    if (this.base) {
      this.base.style.display = 'none';
    }
  }
}
