import { InputSnapshot, createZeroInput } from './InputSnapshot.ts';

const MAX_RADIUS = 64;
const DEAD_ZONE = 0.08;

function detectTouchMode(): boolean {
  const forced = new URLSearchParams(location.search).get('touch');
  if (forced === '1') return true;
  if (forced === '0') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches || innerWidth < 900;
}

export class TouchControls {
  private layer: HTMLElement;
  private stickOrigin = { x: 0, y: 0 };
  private stickActive = false;
  private stickPointerId = -1;
  private stickDelta = { x: 0, y: 0 };
  private primaryPointerIds = new Set<number>();
  private secondaryPointerIds = new Set<number>();
  private dashPointerIds = new Set<number>();
  private active = false;
  private touchMode = false;

  constructor() {
    const el = document.getElementById('touch-controls');
    if (!el) throw new Error('touch-controls element not found');
    this.layer = el;
    this.touchMode = detectTouchMode();
  }

  init(): void {
    if (!this.touchMode) return;
    this.layer.classList.add('active');
    this.layer.innerHTML = `
      <div id="stick-base" style="display:none;position:absolute;width:96px;height:96px;border:3px solid rgba(255,255,255,0.25);border-radius:50%;transform:translate(-50%,-50%);"></div>
      <div id="stick-knob" style="display:none;position:absolute;width:40px;height:40px;background:rgba(255,255,255,0.5);border-radius:50%;transform:translate(-50%,-50%);"></div>
      <div class="touch-zone-right" style="position:absolute;right:0;bottom:0;width:50%;height:100%;display:flex;align-items:flex-end;justify-content:flex-end;padding-right:calc(18px + var(--safe-r));padding-bottom:calc(18px + var(--safe-b));gap:12px;">
        <button id="btn-dash" style="width:64px;height:64px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.12);color:#fff;font-size:12px;">DASH</button>
        <button id="btn-attack" style="width:110px;height:110px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.12);color:#fff;font-size:14px;">DRILL</button>
      </div>
    `;

    this.layer.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.layer.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.layer.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.layer.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    this.layer.addEventListener('contextmenu', (e) => e.preventDefault());
    this.layer.addEventListener('dragstart', (e) => e.preventDefault());
    this.layer.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.releaseAll();
  }

  sample(): InputSnapshot {
    const snap = createZeroInput();
    if (this.stickActive) {
      snap.moveX = this.stickDelta.x;
      snap.moveY = this.stickDelta.y;
    }
    snap.primary = this.primaryPointerIds.size > 0;
    snap.secondary = this.secondaryPointerIds.size > 0;
    snap.dash = this.dashPointerIds.size > 0;
    return snap;
  }

  releaseAll(): void {
    this.stickActive = false;
    this.stickPointerId = -1;
    this.stickDelta = { x: 0, y: 0 };
    this.primaryPointerIds.clear();
    this.secondaryPointerIds.clear();
    this.dashPointerIds.clear();
    this.updateStickVisuals();
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.active) return;
    e.preventDefault();
    const target = e.target as HTMLElement;
    const x = e.clientX;
    const y = e.clientY;

    if (target.id === 'btn-attack') {
      this.primaryPointerIds.add(e.pointerId);
      target.setPointerCapture(e.pointerId);
      return;
    }
    if (target.id === 'btn-dash') {
      this.dashPointerIds.add(e.pointerId);
      target.setPointerCapture(e.pointerId);
      return;
    }

    if (!this.stickActive && x < window.innerWidth / 2) {
      this.stickActive = true;
      this.stickPointerId = e.pointerId;
      this.stickOrigin = { x, y };
      this.layer.setPointerCapture(e.pointerId);
      this.updateStickVisuals();
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.active || !this.stickActive || e.pointerId !== this.stickPointerId) return;
    e.preventDefault();
    const dx = e.clientX - this.stickOrigin.x;
    const dy = e.clientY - this.stickOrigin.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    const rawX = (Math.cos(angle) * clamped) / MAX_RADIUS;
    const rawY = (Math.sin(angle) * clamped) / MAX_RADIUS;
    this.stickDelta = {
      x: this.applyDeadZone(rawX),
      y: this.applyDeadZone(rawY)
    };
    this.updateStickVisuals();
  }

  private onPointerUp(e: PointerEvent): void {
    const id = e.pointerId;
    if (id === this.stickPointerId) {
      this.stickActive = false;
      this.stickPointerId = -1;
      this.stickDelta = { x: 0, y: 0 };
      this.updateStickVisuals();
    }
    this.primaryPointerIds.delete(id);
    this.dashPointerIds.delete(id);
  }

  private applyDeadZone(raw: number): number {
    const abs = Math.abs(raw);
    if (abs < DEAD_ZONE) return 0;
    return Math.sign(raw) * Math.min(1, (abs - DEAD_ZONE) / (1 - DEAD_ZONE));
  }

  private updateStickVisuals(): void {
    const base = document.getElementById('stick-base');
    const knob = document.getElementById('stick-knob');
    if (!base || !knob) return;
    if (!this.stickActive) {
      base.style.display = 'none';
      knob.style.display = 'none';
      return;
    }
    base.style.display = 'block';
    knob.style.display = 'block';
    base.style.left = `${this.stickOrigin.x}px`;
    base.style.top = `${this.stickOrigin.y}px`;
    knob.style.left = `${this.stickOrigin.x + this.stickDelta.x * MAX_RADIUS}px`;
    knob.style.top = `${this.stickOrigin.y + this.stickDelta.y * MAX_RADIUS}px`;
  }
}
