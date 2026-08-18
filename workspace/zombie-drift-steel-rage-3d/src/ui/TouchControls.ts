import { inputManager } from '../core/InputManager';

/**
 * Мобильное управление машиной.
 *
 * Раскладка «руль + педали», а не один стик: для дрифт-аркады важно давить газ
 * и одновременно доворачивать руль, чего один джойстик не позволяет.
 *
 *   слева  — плавающий джойстик поворота (берётся вся левая половина экрана,
 *            стик появляется под пальцем);
 *   справа — ГАЗ / НАЗАД, НИТРО и ДРИФТ (ручник).
 *
 * Всё построено на Pointer Events, поэтому работает и мышью — управление можно
 * проверить на десктопе, не открывая эмулятор устройства.
 */
export class TouchControls {
  private root: HTMLElement;
  private stickZone: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;

  private steerPointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private readonly maxRadius = 64;

  /** Кнопка -> указатели, которые её сейчас держат (мультитач: газ + нитро). */
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
        <div class="touch-hint">РУЛЬ</div>
      </div>

      <div class="touch-zone touch-zone-right">
        <div class="touch-btn-column">
          <div class="touch-btn touch-btn-drift" data-action="handbrake">ДРИФТ</div>
          <div class="touch-btn touch-btn-reverse" data-action="reverse">НАЗАД</div>
        </div>
        <div class="touch-btn-column">
          <div class="touch-btn touch-btn-nitro" data-action="nitro">НИТРО</div>
          <div class="touch-btn touch-btn-gas" data-action="throttle">ГАЗ</div>
        </div>
      </div>
    `;
    container.appendChild(this.root);

    this.stickZone = this.root.querySelector('#touch-steer-zone') as HTMLElement;
    this.stickBase = this.root.querySelector('#touch-stick-base') as HTMLElement;
    this.stickKnob = this.root.querySelector('#touch-stick-knob') as HTMLElement;

    this.bindSteering();
    this.bindButtons();
    this.bindGlobalGuards();
    this.setVisible(false);
  }

  /**
   * Тач-управление включаем на сенсорных устройствах, на узких экранах и по
   * явному флагу `?touch=1` — последнее нужно для отладки во внутреннем браузере.
   */
  private static shouldEnable(): boolean {
    const forced = new URLSearchParams(location.search).get('touch');
    if (forced === '1') return true;
    if (forced === '0') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return inputManager.isTouchDevice || coarse || window.innerWidth < 900;
  }

  // ── Руль ────────────────────────────────────────────────────────────────

  private bindSteering(): void {
    this.stickZone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.steerPointerId !== null) return;
      e.preventDefault();
      this.steerPointerId = e.pointerId;
      this.stickZone.setPointerCapture(e.pointerId);

      // Плавающий стик: центр там, где палец коснулся экрана.
      this.originX = e.clientX;
      this.originY = e.clientY;
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickBase.classList.add('active');
      this.updateSteering(e.clientX, e.clientY);
    });

    this.stickZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.steerPointerId) return;
      e.preventDefault();
      this.updateSteering(e.clientX, e.clientY);
    });

    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.steerPointerId) return;
      this.releaseSteering();
    };
    this.stickZone.addEventListener('pointerup', release);
    this.stickZone.addEventListener('pointercancel', release);
    this.stickZone.addEventListener('lostpointercapture', release);
  }

  private updateSteering(x: number, y: number): void {
    const dx = x - this.originX;
    const dy = y - this.originY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clamped;
    const knobY = Math.sin(angle) * clamped;
    this.stickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

    // Мёртвая зона убирает дрожание руля от микродвижений пальца.
    const raw = dx / this.maxRadius;
    const dead = 0.08;
    const steer = Math.abs(raw) < dead ? 0 : Math.sign(raw) * Math.min(1, (Math.abs(raw) - dead) / (1 - dead));
    inputManager.setTouchSteering(steer);

    // Вертикаль руля работает только «в помощь»: резкий рывок вниз тормозит.
    if (dy / this.maxRadius > 0.75) {
      inputManager.setTouchBrake(true);
    } else {
      inputManager.setTouchBrake(false);
    }
  }

  private releaseSteering(): void {
    this.steerPointerId = null;
    this.stickBase.classList.remove('active');
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
    inputManager.setTouchSteering(0);
    inputManager.setTouchBrake(false);
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

  private applyAction(action: string, pressed: boolean): void {
    switch (action) {
      case 'throttle':
        inputManager.setTouchThrottle(pressed ? 1 : 0);
        break;
      case 'reverse':
        inputManager.setTouchThrottle(pressed ? -1 : 0);
        break;
      case 'nitro':
        inputManager.setTouchNitro(pressed);
        break;
      case 'handbrake':
        inputManager.setTouchHandbrake(pressed);
        break;
    }
  }

  // ── Защита от «браузерных» жестов поверх игры ────────────────────────────

  private bindGlobalGuards(): void {
    // Долгое нажатие на кнопку не должно открывать контекстное меню,
    // а свайп по холсту — тянуть страницу или запускать pull-to-refresh.
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    this.root.addEventListener('dragstart', (e) => e.preventDefault());

    // Ушли со вкладки / потеряли фокус — отпускаем все кнопки, иначе машина
    // уедет с зажатым газом.
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  public releaseAll(): void {
    this.releaseSteering();
    for (const [btn, held] of this.buttonPointers) {
      held.clear();
      btn.classList.remove('pressed');
    }
    inputManager.setTouchThrottle(0);
    inputManager.setTouchNitro(false);
    inputManager.setTouchHandbrake(false);
  }

  // ── Видимость ───────────────────────────────────────────────────────────

  /** Управление показывается только во время заезда, но не поверх меню и паузы. */
  public setVisible(visible: boolean): void {
    this.visible = visible && this.enabled;
    this.root.style.display = this.visible ? 'flex' : 'none';
    if (!this.visible) this.releaseAll();
  }

  public isVisible(): boolean {
    return this.visible;
  }
}
