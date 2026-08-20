import type { InputManager } from '../core/InputManager';

interface TouchButton {
  el: HTMLDivElement;
  action: 'ascend' | 'descend' | 'pulse' | 'heavy';
  pointerId: number | null;
}

/**
 * Mobile touch controls (UI & HUD Layer). Built entirely on Pointer Events with
 * `setPointerCapture` and per-`pointerId` tracking so a second finger never
 * cancels the first. Left half = floating joystick (2 axes); right = primary
 * Pulse button + Ascend / Descend / Heavy. Movement and Pulse work together.
 */
export class VirtualJoystick {
  private readonly root: HTMLDivElement;
  private readonly stickZone: HTMLDivElement;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly buttons: TouchButton[] = [];

  private stickPointer: number | null = null;
  private originX = 0;
  private originY = 0;
  private readonly maxRadius = 60;
  private readonly dead = 0.08;

  constructor(parent: HTMLElement, private readonly input: InputManager) {
    this.root = document.createElement('div');
    this.root.id = 'touch-controls';

    this.stickZone = document.createElement('div');
    this.stickZone.id = 'stick-zone';
    this.base = document.createElement('div');
    this.base.id = 'stick-base';
    this.knob = document.createElement('div');
    this.knob.id = 'stick-knob';
    this.stickZone.append(this.base, this.knob);

    const right = document.createElement('div');
    right.className = 'touch-zone-right';
    const mk = (id: string, cls: string, label: string, action: TouchButton['action']) => {
      const b = document.createElement('div');
      b.id = id;
      b.className = `touch-btn ${cls}`;
      b.textContent = label;
      right.appendChild(b);
      this.buttons.push({ el: b, action, pointerId: null });
    };
    mk('btn-ascend', 'secondary', '▲', 'ascend');
    mk('btn-descend', 'secondary', '▼', 'descend');
    mk('btn-heavy', 'secondary', 'H', 'heavy');
    const primary = document.createElement('div');
    primary.id = 'btn-pulse';
    primary.className = 'touch-btn primary';
    primary.textContent = 'PULSE';
    right.appendChild(primary);
    this.buttons.push({ el: primary, action: 'pulse', pointerId: null });

    this.root.append(this.stickZone, right);
    parent.appendChild(this.root);

    this.wireStick();
    this.wireButtons();
  }

  private wireStick(): void {
    this.stickZone.addEventListener('pointerdown', (e) => {
      if (this.stickPointer !== null) return;
      e.preventDefault();
      this.stickPointer = e.pointerId;
      this.stickZone.setPointerCapture(e.pointerId);
      this.originX = e.clientX;
      this.originY = e.clientY;
      this.base.style.display = 'block';
      this.knob.style.display = 'block';
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.knob.style.left = `${e.clientX}px`;
      this.knob.style.top = `${e.clientY}px`;
    });
    this.stickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointer) return;
      e.preventDefault();
      let dx = e.clientX - this.originX;
      let dy = e.clientY - this.originY;
      const dist = Math.hypot(dx, dy);
      if (dist > this.maxRadius) {
        dx = (dx / dist) * this.maxRadius;
        dy = (dy / dist) * this.maxRadius;
      }
      this.knob.style.left = `${this.originX + dx}px`;
      this.knob.style.top = `${this.originY + dy}px`;
      let nx = dx / this.maxRadius;
      let ny = dy / this.maxRadius;
      if (Math.abs(nx) < this.dead) nx = 0;
      else nx = Math.sign(nx) * (Math.abs(nx) - this.dead) / (1 - this.dead);
      if (Math.abs(ny) < this.dead) ny = 0;
      else ny = Math.sign(ny) * (Math.abs(ny) - this.dead) / (1 - this.dead);
      // Screen up = forward = -Z, so moveZ follows ny (down = +Z backward).
      this.input.setTouchMove(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)));
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return;
      e.preventDefault();
      this.stickPointer = null;
      this.base.style.display = 'none';
      this.knob.style.display = 'none';
      this.input.setTouchMove(0, 0);
    };
    this.stickZone.addEventListener('pointerup', end);
    this.stickZone.addEventListener('pointercancel', end);
    this.stickZone.addEventListener('lostpointercapture', end);
  }

  private wireButtons(): void {
    for (const btn of this.buttons) {
      btn.el.addEventListener('pointerdown', (e) => {
        if (btn.pointerId !== null) return;
        e.preventDefault();
        btn.pointerId = e.pointerId;
        btn.el.setPointerCapture(e.pointerId);
        btn.el.classList.add('active');
        this.input.setTouchAction(btn.action, true);
      });
      const up = (e: PointerEvent) => {
        if (e.pointerId !== btn.pointerId) return;
        e.preventDefault();
        btn.pointerId = null;
        btn.el.classList.remove('active');
        this.input.setTouchAction(btn.action, false);
      };
      btn.el.addEventListener('pointerup', up);
      btn.el.addEventListener('pointercancel', up);
      btn.el.addEventListener('lostpointercapture', up);
    }
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('visible', v);
    if (!v) {
      this.stickPointer = null;
      this.base.style.display = 'none';
      this.knob.style.display = 'none';
      for (const b of this.buttons) {
        b.pointerId = null;
        b.el.classList.remove('active');
      }
      this.input.setTouchMove(0, 0);
      this.input.setTouchAction('ascend', false);
      this.input.setTouchAction('descend', false);
      this.input.setTouchAction('pulse', false);
      this.input.setTouchAction('heavy', false);
    }
  }
}
