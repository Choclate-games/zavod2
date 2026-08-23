/**
 * Единственный маршрутизатор ввода. Игровые системы не вешают keydown/pointerdown
 * сами — они читают состояние отсюда. Две схемы: десктоп и тач.
 * Неактивная схема не слушает ничего.
 */

export type InputScheme = 'desktop' | 'touch'

export class InputRouter {
  scheme: InputScheme = 'desktop'

  /** Оси движения (-1..1). */
  moveX = 0
  moveY = 0
  /** Накопленный дельта-обзор за кадр. */
  lookDX = 0
  lookDY = 0
  /** Крайний флаг выстрела (полуавтомат: читается событие, не удержание). */
  private fireQueued = false
  fireHeld = false
  zoomHeld = false
  /** Крайний флаг паузы. */
  private pauseQueued = false

  private readonly keys = new Set<string>()

  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null
  private mouseDownHandler: ((e: MouseEvent) => void) | null = null
  private mouseUpHandler: ((e: MouseEvent) => void) | null = null
  private blurHandler: (() => void) | null = null

  activate(scheme: InputScheme): void {
    if (this.scheme === scheme) return
    this.releaseAll()
    this.scheme = scheme
    if (scheme === 'desktop') this.attachDesktop()
    else this.detachDesktop()
  }

  private attachDesktop(): void {
    this.keyDownHandler = (e: KeyboardEvent): void => {
      // Клавиша R в этой игре не используется вовсе: перезарядки нет.
      if (e.code === 'KeyR') return
      if (e.repeat) {
        if (e.code === 'Space') e.preventDefault()
        return
      }
      this.keys.add(e.code)
      if (e.code === 'Space') {
        this.fireQueued = true
        this.fireHeld = true
        e.preventDefault()
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        this.pauseQueued = true
      }
    }
    this.keyUpHandler = (e: KeyboardEvent): void => {
      this.keys.delete(e.code)
      if (e.code === 'Space') this.fireHeld = false
    }
    this.mouseMoveHandler = (e: MouseEvent): void => {
      if (document.pointerLockElement) {
        this.lookDX += e.movementX
        this.lookDY += e.movementY
      }
    }
    this.mouseDownHandler = (e: MouseEvent): void => {
      if (!document.pointerLockElement) return
      // Кнопки указателя различаются: ЛКМ — огонь, ПКМ — приближение.
      if (e.button === 0) {
        this.fireQueued = true
        this.fireHeld = true
      } else if (e.button === 2) {
        this.zoomHeld = true
      }
    }
    this.mouseUpHandler = (e: MouseEvent): void => {
      if (e.button === 0) this.fireHeld = false
      else if (e.button === 2) this.zoomHeld = false
    }
    this.blurHandler = (): void => this.releaseAll()

    window.addEventListener('keydown', this.keyDownHandler)
    window.addEventListener('keyup', this.keyUpHandler)
    window.addEventListener('mousemove', this.mouseMoveHandler)
    window.addEventListener('mousedown', this.mouseDownHandler)
    window.addEventListener('mouseup', this.mouseUpHandler)
    window.addEventListener('blur', this.blurHandler)
  }

  private detachDesktop(): void {
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler)
    if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler)
    if (this.mouseMoveHandler) window.removeEventListener('mousemove', this.mouseMoveHandler)
    if (this.mouseDownHandler) window.removeEventListener('mousedown', this.mouseDownHandler)
    if (this.mouseUpHandler) window.removeEventListener('mouseup', this.mouseUpHandler)
    if (this.blurHandler) window.removeEventListener('blur', this.blurHandler)
    this.keyDownHandler = null
    this.keyUpHandler = null
    this.mouseMoveHandler = null
    this.mouseDownHandler = null
    this.mouseUpHandler = null
    this.blurHandler = null
  }

  /* ── Тач-схема: пишет слой TouchControls ─────────────────────────────── */

  touchMove(x: number, y: number): void {
    this.moveX = x
    this.moveY = y
  }

  touchLook(dx: number, dy: number): void {
    this.lookDX += dx
    this.lookDY += dy
  }

  touchFirePress(): void {
    this.fireQueued = true
    this.fireHeld = true
  }

  touchFireRelease(): void {
    this.fireHeld = false
  }

  touchZoom(active: boolean): void {
    this.zoomHeld = active
  }

  touchPause(): void {
    this.pauseQueued = true
  }

  /* ── Чтение игровым циклом ───────────────────────────────────────────── */

  get firePressed(): boolean {
    return this.fireQueued
  }

  get pausePressed(): boolean {
    return this.pauseQueued
  }

  consumeFrameInput(): void {
    const kx = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0)
    const ky = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
    if (this.scheme === 'desktop') {
      this.moveX = kx
      this.moveY = ky
    }
    this.fireQueued = false
    this.pauseQueued = false
    this.lookDX = 0
    this.lookDY = 0
  }

  releaseAll(): void {
    this.keys.clear()
    this.moveX = 0
    this.moveY = 0
    this.lookDX = 0
    this.lookDY = 0
    this.fireQueued = false
    this.fireHeld = false
    this.zoomHeld = false
    this.pauseQueued = false
  }
}
