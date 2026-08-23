// Единая точка ввода. Две схемы: клавиатура+мышь и экранная.
// Активная выбирается по типу устройства моста (?input=touch|desktop — принудительно).
// Ни одна игровая система не слушает keydown/pointerdown напрямую.

import type { DeviceKind } from '../platform/PlaygamaService'

export type InputScheme = 'desktop' | 'touch'

export class InputSnapshot {
  aimDX = 0
  aimDY = 0
  fireHeld = false
  firePulsed = false
  overloadQueued = false
  jumpQueued = false
  slideQueued = false
  strafeQueued = 0
  pauseQueued = false
}

const URL_OVERRIDE_RE = /[?&]input=(touch|desktop)/

export class InputRouter {
  readonly snapshot = new InputSnapshot()
  scheme: InputScheme = 'desktop'
  sensitivity = 1.0

  private keysDown = new Set<string>()
  private pointerLocked = false
  private keyboardHooked = false
  private mouseHooked = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    const forcedTouch = /[?&]touch=1/.test(window.location.search)
    const match = window.location.search.match(URL_OVERRIDE_RE)
    if (match?.[1] === 'touch') this.scheme = 'touch'
    else if (match?.[1] === 'desktop') this.scheme = 'desktop'
    else this.scheme = forcedTouch ? 'touch' : 'desktop'
  }

  applyDevice(deviceKind: DeviceKind): void {
    const search = window.location.search
    if (URL_OVERRIDE_RE.test(search) || /[?&]touch=1/.test(search)) return
    this.setScheme(deviceKind === 'desktop' ? 'desktop' : 'touch')
  }

  setScheme(scheme: InputScheme): void {
    if (this.scheme === scheme && this.keyboardHooked === (scheme === 'desktop')) return
    this.resetAxes()
    this.scheme = scheme
    this.releasePointerLock()
    if (scheme === 'desktop') {
      this.hookKeyboard()
      this.hookMouse()
    } else {
      this.unhookKeyboard()
      this.unhookMouse()
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) {
      e.preventDefault()
      return
    }
    this.keysDown.add(e.code)
    switch (e.code) {
      case 'Space':
        this.snapshot.jumpQueued = true
        break
      case 'KeyS':
      case 'KeyC':
        this.snapshot.slideQueued = true
        break
      case 'KeyA':
        this.snapshot.strafeQueued = -1
        break
      case 'KeyD':
        this.snapshot.strafeQueued = 1
        break
      case 'KeyE':
        this.snapshot.overloadQueued = true
        break
      case 'Escape':
      case 'KeyP':
        this.snapshot.pauseQueued = true
        break
      default:
        return
    }
    e.preventDefault()
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code)
    if (e.code === 'Space') this.snapshot.fireHeld = false
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return
    this.snapshot.aimDX += e.movementX * this.sensitivity
    this.snapshot.aimDY += e.movementY * this.sensitivity
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (this.pointerLocked) {
      if (e.button === 0) {
        this.snapshot.fireHeld = true
        this.snapshot.firePulsed = true
      } else if (e.button === 2) {
        this.snapshot.overloadQueued = true
      }
      return
    }
    // Захват мыши запрашивается только из обработчика нажатия и только на десктопе.
    if (e.button === 0 && this.scheme === 'desktop') {
      try {
        const lock = this.canvas.requestPointerLock() as unknown
        if (lock instanceof Promise) lock.catch(() => undefined)
      } catch {
        // захват мог быть отклонён браузером — игра продолжается без него
      }
    }
  }

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.snapshot.fireHeld = false
  }

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas
  }

  private onBlur = (): void => {
    this.resetAxes()
  }

  private hookKeyboard(): void {
    if (this.keyboardHooked) return
    this.keyboardHooked = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    document.addEventListener('visibilitychange', this.onBlur)
  }

  private unhookKeyboard(): void {
    if (!this.keyboardHooked) return
    this.keyboardHooked = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    document.removeEventListener('visibilitychange', this.onBlur)
  }

  private hookMouse(): void {
    if (this.mouseHooked) return
    this.mouseHooked = true
    document.addEventListener('mousemove', this.onMouseMove)
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    this.canvas.addEventListener('contextmenu', this.preventContext)
  }

  private unhookMouse(): void {
    if (!this.mouseHooked) return
    this.mouseHooked = false
    document.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    this.canvas.removeEventListener('contextmenu', this.preventContext)
  }

  private preventContext = (e: Event): void => {
    e.preventDefault()
  }

  private releasePointerLock(): void {
    if (document.pointerLockElement != null) document.exitPointerLock()
    this.pointerLocked = false
  }

  /** Экранная схема пишет в тот же снимок через эти методы. */
  addAimDelta(dx: number, dy: number): void {
    this.snapshot.aimDX += dx * this.sensitivity
    this.snapshot.aimDY += dy * this.sensitivity
  }

  touchFirePulse(): void {
    this.snapshot.fireHeld = false
    this.snapshot.firePulsed = true
  }

  queueJump(): void {
    this.snapshot.jumpQueued = true
  }

  queueSlide(): void {
    this.snapshot.slideQueued = true
  }

  queueStrafe(direction: number): void {
    this.snapshot.strafeQueued = direction < 0 ? -1 : 1
  }

  queueOverload(): void {
    this.snapshot.overloadQueued = true
  }

  queuePause(): void {
    this.snapshot.pauseQueued = true
  }

  resetAxes(): void {
    this.keysDown.clear()
    const snap = this.snapshot
    snap.aimDX = 0
    snap.aimDY = 0
    snap.fireHeld = false
    snap.firePulsed = false
    snap.overloadQueued = false
    snap.jumpQueued = false
    snap.slideQueued = false
    snap.strafeQueued = 0
    snap.pauseQueued = false
  }
}
