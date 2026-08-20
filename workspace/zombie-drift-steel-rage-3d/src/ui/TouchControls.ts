import { inputManager } from '../core/InputManager';
import { eventBus } from '../core/EventBus';

/**
 * Переработанное мобильное управление:
 * Игрок тянет пальцем в любую сторону — машина плавно поворачивает и едет в указанную сторону!
 * Справа — кнопки НИТРО и ДРИФТ.
 * Сверху справа — кнопка ПАУЗА.
 */
export class TouchControls {
  private root: HTMLElement;
  private stickZone: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;

  private steerPointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private readonly maxRadius = 60;

  /** Кнопка -> указатели, которые её сейчас держат (мультитач) */
  private buttonPointers = new Map<HTMLElement, Set<number>>();

  private visible = false;
  private enabled: boolean;

  constructor(container: HTMLElement) {
    this.enabled = TouchControls.shouldEnable();

    this.root = document.createElement('div');
    this.root.id = 'touch-controls';
    this.root.innerHTML = `
      <div id="touch-steer-zone" class="touch-zone touch-zone-left">
        <div id="touch-stick-base" class="touch-stick-base">
          <div id="touch-stick-knob" class="touch-stick-knob"></div>
        </div>
        <div class="touch-hint">ТЯНИ ДЛЯ ДВИЖЕНИЯ</div>
      </div>

      <div class="touch-zone touch-zone-right">
        <div class="touch-btn-column">
          <div class="touch-btn touch-btn-nitro" data-action="nitro">НИТРО</div>
          <div class="touch-btn touch-btn-drift" data-action="handbrake">ДРИФТ</div>
        </div>
      </div>

      <button id="touch-pause-btn" class="touch-pause-btn" aria-label="Пауза" type="button">II</button>
    `;
    container.appendChild(this.root);

    this.stickZone = this.root.querySelector('#touch-steer-zone') as HTMLElement;
    this.stickBase = this.root.querySelector('#touch-stick-base') as HTMLElement;
    this.stickKnob = this.root.querySelector('#touch-stick-knob') as HTMLElement;

    this.bindDirectionalStick();
    this.bindButtons();
    this.bindPause();
    this.bindGlobalGuards();
    this.setVisible(false);
  }

  private static shouldEnable(): boolean {
    const forced = new URLSearchParams(location.search).get('touch');
    if (forced === '1') return true;
    if (forced === '0') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return inputManager.isTouchDevice || coarse || window.innerWidth < 960;
  }

  // ── Направленный джойстик (в ту сторону, куда тянут) ────────────────────

  private bindDirectionalStick(): void {
    this.stickZone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.steerPointerId !== null) return;
      e.preventDefault();
      this.steerPointerId = e.pointerId;
      this.stickZone.setPointerCapture(e.pointerId);

      this.originX = e.clientX;
      this.originY = e.clientY;
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickBase.classList.add('active');
      this.updateDirection(e.clientX, e.clientY);
    });

    this.stickZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.steerPointerId) return;
      e.preventDefault();
      this.updateDirection(e.clientX, e.clientY);
    });

    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.steerPointerId) return;
      this.releaseStick();
    };
    this.stickZone.addEventListener('pointerup', release);
    this.stickZone.addEventListener('pointercancel', release);
    this.stickZone.addEventListener('lostpointercapture', release);
  }

  private updateDirection(x: number, y: number): void {
    const dx = x - this.originX;
    const dy = y - this.originY;
    const dist = Math.hypot(dx, dy);

    if (dist < 6) {
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
      inputManager.setTouchDirection(null, 0);
      return;
    }

    const clampedDist = Math.min(dist, this.maxRadius);
    const knobX = (dx / dist) * clampedDist;
    const knobY = (dy / dist) * clampedDist;
    this.stickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

    // Вычисляем целевой угол направления и силу тяги
    const targetAngle = Math.atan2(dx, dy);
    const magnitude = Math.min(1.0, (dist - 6) / (this.maxRadius - 6));

    inputManager.setTouchDirection(targetAngle, magnitude);
  }

  private releaseStick(): void {
    this.steerPointerId = null;
    this.stickBase.classList.remove('active');
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
    inputManager.setTouchDirection(null, 0);
  }

  // ── Кнопки ──────────────────────────────────────────────────────────────

  private bindButtons(): void {
    const buttons = Array.from(this.root.querySelectorAll<HTMLElement>('.touch-btn'));

    for (const btn of buttons) {
      const action = btn.dataset.action!;
      this.buttonPointers.set(btn, new Set());

      btn.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        this.buttonPointers.get(btn)!.add(e.pointerId);
        btn.classList.add('pressed');
        this.applyAction(action, true);
      });

      const up = (e: PointerEvent) => {
        const held = this.buttonPointers.get(btn)!;
        if (!held.delete(e.pointerId)) return;
        if (held.size === 0) {
          btn.classList.remove('pressed');
          this.applyAction(action, false);
        }
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
    }
  }

  private bindPause(): void {
    const pauseBtn = this.root.querySelector('#touch-pause-btn') as HTMLElement;
    const trigger = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      eventBus.emit('TOGGLE_PAUSE');
    };
    pauseBtn.addEventListener('pointerdown', trigger);
  }

  private applyAction(action: string, pressed: boolean): void {
    switch (action) {
      case 'nitro':
        inputManager.setTouchNitro(pressed);
        break;
      case 'handbrake':
        inputManager.setTouchHandbrake(pressed);
        break;
    }
  }

  private bindGlobalGuards(): void {
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    this.root.addEventListener('dragstart', (e) => e.preventDefault());

    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  public releaseAll(): void {
    this.releaseStick();
    for (const [btn, held] of this.buttonPointers) {
      held.clear();
      btn.classList.remove('pressed');
    }
    inputManager.setTouchNitro(false);
    inputManager.setTouchHandbrake(false);
  }

  public setVisible(visible: boolean): void {
    this.visible = visible && this.enabled;
    this.root.style.display = this.visible ? 'flex' : 'none';
    if (!this.visible) this.releaseAll();
  }

  public isVisible(): boolean {
    return this.visible;
  }
}
