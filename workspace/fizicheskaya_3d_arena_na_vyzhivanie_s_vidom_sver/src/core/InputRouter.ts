/**
 * Роутер ввода: единственное место, где живут слушатели клавиатуры.
 * Игровые системы читают состояние отсюда и никогда не вешают keydown сами.
 * Схем ровно две — десктопная (клавиатура) и тач (слой TouchControls в ui/),
 * активную выбирает тип устройства от моста; ?input=... форсирует режим.
 */
export type InputMode = 'desktop' | 'touch'

export interface TouchSource {
  axisX: number
  axisY: number
  boostHeld: boolean
  consumeRebound(): boolean
}

const URL_FORCE_RE = /[?&]input=(touch|desktop)/

export class InputRouter {
  mode: InputMode = 'desktop'
  private readonly keys = new Set<string>()
  private touchSource: TouchSource | null = null
  private reboundQueued = false
  private pauseQueued = false
  private forced = false

  onModeChanged: ((mode: InputMode) => void) | null = null
  /** Первый жест игрока: разблокировка аудио и прочие одноразовые действия. */
  onFirstGesture: (() => void) | null = null

  constructor(deviceType: string) {
    if (URL_FORCE_RE.test(window.location.search)) {
      this.forced = true
      this.mode = RegExp.$1 === 'touch' ? 'touch' : 'desktop'
    } else if (deviceType === 'mobile' || deviceType === 'tablet') {
      this.mode = 'touch'
    } else if (deviceType === 'desktop') {
      this.mode = 'desktop'
    } else {
      // Моста нет (dev-сервер): браузерный признак — запасной вариант и только он.
      this.mode = window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'desktop'
    }
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('pointerdown', this.handlePointerDown)
    window.addEventListener('blur', this.releaseAll)
  }

  /** Слой тач-управления подключается извне (ui/), ядро DOM не создаёт. */
  attachTouch(source: TouchSource): void {
    this.touchSource = source
  }

  detachTouch(): void {
    this.touchSource = null
    this.reboundQueued = false
  }

  setMode(mode: InputMode): void {
    if (this.mode === mode) return
    this.releaseAll()
    this.mode = mode
    if (mode === 'desktop') this.detachTouch()
    if (this.onModeChanged) this.onModeChanged(mode)
  }

  /** Тип устройства приходит от моста после инициализации площадки. */
  setDeviceType(deviceType: string): void {
    if (this.forced) return
    if (deviceType === 'mobile' || deviceType === 'tablet') this.setMode('touch')
    else if (deviceType === 'desktop') this.setMode('desktop')
    else if (window.matchMedia('(pointer: coarse)').matches) this.setMode('touch')
  }

  /** Оси движения: -1..1 по X (право/лево) и Y (вперёд/назад). */
  getMoveAxis(out: { x: number; y: number }): void {
    out.x = 0
    out.y = 0
    if (this.mode === 'touch' && this.touchSource) {
      out.x += this.touchSource.axisX
      out.y += this.touchSource.axisY
      return
    }
    const keys = this.keys
    if (keys.has('KeyA') || keys.has('ArrowLeft')) out.x -= 1
    if (keys.has('KeyD') || keys.has('ArrowRight')) out.x += 1
    if (keys.has('KeyW') || keys.has('ArrowUp')) out.y += 1
    if (keys.has('KeyS') || keys.has('ArrowDown')) out.y -= 1
  }

  isBoostHeld(): boolean {
    if (this.mode === 'touch' && this.touchSource) return this.touchSource.boostHeld
    return this.keys.has('Space') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
  }

  queueRebound(): void {
    this.reboundQueued = true
  }

  consumeRebound(): boolean {
    if (this.mode === 'touch' && this.touchSource && this.touchSource.consumeRebound()) return true
    if (!this.reboundQueued) return false
    this.reboundQueued = false
    return true
  }

  consumePause(): boolean {
    if (!this.pauseQueued) return false
    this.pauseQueued = false
    return true
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('pointerdown', this.handlePointerDown)
    window.removeEventListener('blur', this.releaseAll)
  }

  private releaseAll = (): void => {
    this.keys.clear()
    this.reboundQueued = false
    this.pauseQueued = false
    if (this.touchSource) {
      this.touchSource.axisX = 0
      this.touchSource.axisY = 0
      this.touchSource.boostHeld = false
    }
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return
    this.fireFirstGesture()
    // В тач-схеме клавиши не управляют игрой: только переключение режима и пауза.
    if (this.mode === 'touch') {
      if (event.code === 'KeyP' || event.code === 'Escape') this.pauseQueued = true
      if (!this.forced) this.setMode('desktop')
      return
    }
    this.keys.add(event.code)
    if (event.code === 'Space') event.preventDefault()
    if (event.code === 'KeyP' || event.code === 'Escape') this.pauseQueued = true
  }

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.fireFirstGesture()
    // Настоящий палец переводит игру в тач-схему без перезагрузки.
    if (!this.forced && this.mode !== 'touch' && event.pointerType === 'touch') {
      this.setMode('touch')
    }
  }

  private fireFirstGesture(): void {
    if (this.onFirstGesture) {
      const callback = this.onFirstGesture
      this.onFirstGesture = null
      callback()
    }
  }
}
