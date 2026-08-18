import type { InputManager } from './InputManager';

export class TouchControls {
  readonly element: HTMLDivElement;
  private readonly panZone: HTMLDivElement;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private activePointerId: number | null = null;
  private originX = 0;
  private originY = 0;

  constructor(private readonly input: InputManager) {
    this.element = document.createElement('div');
    this.element.className = 'touch-layer';
    this.panZone = document.createElement('div');
    this.panZone.className = 'pan-zone';
    this.base = document.createElement('div');
    this.base.className = 'stick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    const actions = document.createElement('div');
    actions.className = 'touch-actions';
    actions.innerHTML = '<button class="touch-button main" aria-label="Купить">+</button><button class="touch-button" aria-label="Пауза">II</button>';
    this.element.append(this.panZone, this.base, this.knob, actions);

    this.panZone.addEventListener('pointerdown', (event) => this.beginPan(event));
    this.panZone.addEventListener('pointermove', (event) => this.movePan(event));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.panZone.addEventListener(type, (event) => this.endPan(event as PointerEvent));
    }
    this.element.addEventListener('contextmenu', (event) => event.preventDefault());
    this.element.addEventListener('dragstart', (event) => event.preventDefault());
    this.element.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle('visible', visible && this.shouldShow());
    if (!visible) this.releaseAll();
  }

  private shouldShow(): boolean {
    const forced = new URLSearchParams(window.location.search).get('touch');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
  }

  private beginPan(event: PointerEvent): void {
    event.preventDefault();
    if (this.activePointerId !== null) return;
    this.activePointerId = event.pointerId;
    this.originX = event.clientX;
    this.originY = event.clientY;
    this.panZone.setPointerCapture(event.pointerId);
    this.base.style.display = 'block';
    this.knob.style.display = 'block';
    this.base.style.left = `${this.originX}px`;
    this.base.style.top = `${this.originY}px`;
    this.knob.style.left = `${this.originX}px`;
    this.knob.style.top = `${this.originY}px`;
  }

  private movePan(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    const radius = 52;
    const dx = Math.max(-radius, Math.min(radius, event.clientX - this.originX));
    const dy = Math.max(-radius, Math.min(radius, event.clientY - this.originY));
    this.knob.style.left = `${this.originX + dx}px`;
    this.knob.style.top = `${this.originY + dy}px`;
  }

  private endPan(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;
    this.releaseAll();
  }

  private releaseAll(): void {
    this.activePointerId = null;
    this.input.reset();
    this.base.style.display = 'none';
    this.knob.style.display = 'none';
  }
}
