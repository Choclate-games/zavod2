import * as THREE from 'three';
import { InputManager } from './InputManager';
import type { InputSnapshot } from '../core/types';

export interface PointerSample {
  id: number;
  /** Нормализованные координаты устройства, -1..1. */
  ndc: THREE.Vector2;
  /** Смещение с прошлого кадра в пикселях (для pointer lock и свайпов). */
  delta: THREE.Vector2;
  down: boolean;
}

type KeyHandler = (code: string, ev: KeyboardEvent) => void;
/**
 * Нажатие кнопки указателя как СОБЫТИЕ: 0 — левая, 2 — правая.
 *
 * Отдельно от `activePointers` по той же причине, по какой клавиши отдаются
 * событием: `down: true` в снимке живёт, пока кнопку держат, и удар «на
 * удержании» повторялся бы каждый кадр.
 */
type ButtonHandler = (button: number, ev: PointerEvent) => void;

/**
 * Единый источник ввода для всех демо стенда.
 *
 * Построен на Pointer Events с `setPointerCapture` и учётом `pointerId`
 * (CRITICAL_RULES §56-59): `mousedown`/`touchstart` теряют пальцы на границах
 * элементов и позволяют второму пальцу отменить первый.
 *
 * Клавиатурные нажатия отдаются подписчикам активного демо как СОБЫТИЯ (нажал —
 * один раз), а удержание читается через `isDown()`. Смешивать эти два способа в
 * одном демо нельзя: удар «на удержании» повторяется каждый кадр.
 */
export class InputHub {
  readonly vehicle: InputManager;

  private readonly keys = new Set<string>();
  private readonly pointers = new Map<number, PointerSample>();
  private keyDownHandlers = new Set<KeyHandler>();
  private keyUpHandlers = new Set<KeyHandler>();
  private buttonHandlers = new Set<ButtonHandler>();
  private locked = false;
  private lockDelta = new THREE.Vector2();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.vehicle = new InputManager();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.releaseAll);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    // Без этого правая кнопка открывает системное меню поверх канваса, и
    // «сильный удар» превращается в «Сохранить изображение как…».
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  // ───────────────────────────────────────────────────────────── клавиатура
  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** WASD/стрелки как вектор в плоскости XZ (z<0 — «вперёд от камеры»). */
  moveVector(out = new THREE.Vector2()): THREE.Vector2 {
    out.set(0, 0);
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) out.x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) out.x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) out.y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) out.y += 1;
    if (out.lengthSq() > 1) out.normalize();
    return out;
  }

  onKey(down: KeyHandler, up?: KeyHandler): () => void {
    this.keyDownHandlers.add(down);
    if (up) this.keyUpHandlers.add(up);
    return () => {
      this.keyDownHandlers.delete(down);
      if (up) this.keyUpHandlers.delete(up);
    };
  }

  /**
   * Подписка на нажатие кнопки указателя. Возвращает функцию отписки — как
   * `onKey`, и снимается тем же `clearSubscribers` при смене вкладки.
   */
  onPointerButton(handler: ButtonHandler): () => void {
    this.buttonHandlers.add(handler);
    return () => { this.buttonHandlers.delete(handler); };
  }

  /** Снять всех подписчиков — вызывается хостом при смене вкладки. */
  clearSubscribers(): void {
    this.keyDownHandlers.clear();
    this.keyUpHandlers.clear();
    this.buttonHandlers.clear();
  }

  // ───────────────────────────────────────────────────────────── указатель
  get activePointers(): PointerSample[] {
    return [...this.pointers.values()];
  }

  get primary(): PointerSample | null {
    return this.pointers.values().next().value ?? null;
  }

  get isPointerLocked(): boolean {
    return this.locked;
  }

  requestPointerLock(): void {
    this.canvas.requestPointerLock?.();
  }

  /** Смещение мыши в режиме захвата за прошлый кадр; обнуляется при чтении. */
  consumeLockDelta(out = new THREE.Vector2()): THREE.Vector2 {
    out.copy(this.lockDelta);
    this.lockDelta.set(0, 0);
    return out;
  }

  /** Обнулить кадровые дельты. Хост вызывает в конце кадра. */
  endFrame(): void {
    for (const p of this.pointers.values()) p.delta.set(0, 0);
  }

  vehicleSnapshot(): InputSnapshot {
    return this.vehicle.snapshot();
  }

  releaseAll = (): void => {
    this.keys.clear();
    this.pointers.clear();
    this.lockDelta.set(0, 0);
    this.vehicle.releaseAll();
  };

  // ───────────────────────────────────────────────────────────── внутреннее
  private toNdc(ev: PointerEvent, out: THREE.Vector2): THREE.Vector2 {
    // getBoundingClientRect, а не innerWidth: канвас в платформенном iframe
    // не занимает всё окно, и на баннере смещение достигает десятков пикселей.
    const r = this.canvas.getBoundingClientRect();
    out.set(
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      -((ev.clientY - r.top) / r.height) * 2 + 1,
    );
    return out;
  }

  private readonly onPointerDown = (ev: PointerEvent): void => {
    // Подписчики — первыми, и захват в try. `setPointerCapture` кидает
    // NotFoundError на любом указателе, которого браузер не считает
    // активным, и тогда весь обработчик обрывался до удара.
    this.buttonHandlers.forEach((h) => h(ev.button, ev));
    try { this.canvas.setPointerCapture(ev.pointerId); } catch { /* не критично */ }
    this.pointers.set(ev.pointerId, {
      id: ev.pointerId,
      ndc: this.toNdc(ev, new THREE.Vector2()),
      delta: new THREE.Vector2(),
      down: true,
    });
  };

  private readonly onPointerMove = (ev: PointerEvent): void => {
    if (this.locked) {
      this.lockDelta.x += ev.movementX;
      this.lockDelta.y += ev.movementY;
      return;
    }
    const p = this.pointers.get(ev.pointerId);
    if (p) {
      const prev = p.ndc.clone();
      this.toNdc(ev, p.ndc);
      p.delta.set(ev.movementX || (p.ndc.x - prev.x), ev.movementY || (prev.y - p.ndc.y));
    } else {
      // Наведение без нажатия (десктоп): держим как «нулевой» указатель.
      this.pointers.set(ev.pointerId, {
        id: ev.pointerId,
        ndc: this.toNdc(ev, new THREE.Vector2()),
        delta: new THREE.Vector2(ev.movementX, ev.movementY),
        down: false,
      });
    }
  };

  private readonly onPointerUp = (ev: PointerEvent): void => {
    this.canvas.releasePointerCapture?.(ev.pointerId);
    const p = this.pointers.get(ev.pointerId);
    if (p) p.down = false;
    if (ev.pointerType !== 'mouse') this.pointers.delete(ev.pointerId);
  };

  private readonly onKeyDown = (ev: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
      ev.preventDefault();
    }
    const repeat = this.keys.has(ev.code);
    this.keys.add(ev.code);
    if (!repeat) this.keyDownHandlers.forEach((h) => h(ev.code, ev));
  };

  private readonly onKeyUp = (ev: KeyboardEvent): void => {
    this.keys.delete(ev.code);
    this.keyUpHandlers.forEach((h) => h(ev.code, ev));
  };
}
