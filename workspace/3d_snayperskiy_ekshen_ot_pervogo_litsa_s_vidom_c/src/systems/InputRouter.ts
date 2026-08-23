import { bus } from '../core/eventBus.js'
import type { PlaygamaService, DeviceKind } from '../platform/PlaygamaService.js'
import { createInputState, resetInputState, type InputState } from './inputState.js'

export type InputMode = 'desktop' | 'touch'

interface ModeOverride {
  mode: InputMode | null
}

function queryOverride(): ModeOverride {
  const params = new URLSearchParams(window.location.search)
  const forced = params.get('input')
  if (forced === 'touch' || forced === 'desktop') return { mode: forced }
  const touchFlag = params.get('touch')
  if (touchFlag === '1') return { mode: 'touch' }
  if (touchFlag === '0') return { mode: 'desktop' }
  return { mode: null }
}

/** Роутер ввода: ровно две схемы (клавиатура+мышь и экранная), активную
 * выбирает bridge.device.type; игровые системы не слушают keydown сами. */
export class InputRouter {
  readonly state: InputState = createInputState()
  mode: InputMode

  private keyboardActive = false
  private switchCooldown = 0
  private readonly keysDown = new Set<string>()

  constructor(
    private readonly canvas: HTMLCanvasElement,
    platform: PlaygamaService,
    private readonly onModeChanged: (mode: InputMode) => void,
  ) {
    const override = queryOverride()
    let kind: DeviceKind = override.mode ? 'desktop' : platform.getDeviceType()
    if (!override.mode) {
      // запасной вариант для dev-сервера без моста — и только он
      if (kind === 'desktop' && ('ontouchstart' in window) && navigator.maxTouchPoints > 0) {
        kind = window.innerWidth < 1024 ? 'mobile' : 'desktop'
      }
    }
    this.mode = override.mode ?? (kind === 'desktop' ? 'desktop' : 'touch')

    document.addEventListener('keydown', this.onKeyDownCaptureSwitch, { capture: true })
    document.addEventListener('pointerdown', this.onPointerDownSwitch, { capture: true })
    window.addEventListener('blur', this.releaseAll)
    document.addEventListener('visibilitychange', this.releaseAll)
    this.applyMode(this.mode)
  }

  /** Смена режима на лету: сначала отпускаем все оси и кнопки. */
  private applyMode(mode: InputMode): void {
    this.releaseAll()
    if (mode === 'desktop') this.attachKeyboard()
    else this.detachKeyboard()
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
    this.mode = mode
    bus.emit('screen:changed', { id: this.currentScreenId })
    this.onModeChanged(mode)
    bus.emit('input:mode', { mode })
  }

  currentScreenId = 'menu'

  setScreen(id: string): void {
    this.currentScreenId = id
  }

  private onPointerDownSwitch = (event: PointerEvent): void => {
    if (this.switchCooldown > 0) return
    if (event.pointerType === 'touch' && this.mode !== 'touch') {
      this.switchCooldown = 1
      this.applyMode('touch')
    } else if (this.mode !== 'desktop' && event.pointerType === 'mouse') {
      this.switchCooldown = 1
      this.applyMode('desktop')
    }
  }

  private onKeyDownCaptureSwitch = (event: KeyboardEvent): void => {
    if (this.switchCooldown <= 0 && this.mode !== 'desktop' && !event.repeat) {
      this.applyMode('desktop')
    }
  }

  // ── клавиатура + мышь ────────────────────────────────────────────────────
  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKey(event, true)
  private readonly onKeyUp = (event: KeyboardEvent) => this.handleKey(event, false)

  private handleKey(event: KeyboardEvent, down: boolean): void {
    const code = event.code
    if (down && !event.repeat) {
      switch (code) {
        case 'Space':
          bus.emit('input:rangefinder')
          event.preventDefault()
          break
        case 'KeyC':
          bus.emit('input:crouch')
          break
        case 'KeyE':
          bus.emit('input:echo')
          break
        case 'Escape':
        case 'KeyP':
          bus.emit('input:pause')
          break
        default:
          break
      }
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.state.breathHeld = down
      return
    }
    if (down) this.keysDown.add(code)
    else this.keysDown.delete(code)
    this.recomputeStrafe()
  }

  private recomputeStrafe(): void {
    let strafe = 0
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) strafe -= 1
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) strafe += 1
    this.state.strafe = strafe !== 0 ? strafe : this.touchStrafe
  }

  /** Слайдер тача сообщает шаг напрямую через этот сеттер. */
  touchStrafe = 0
  setTouchStrafe(value: number): void {
    this.touchStrafe = value
    this.state.strafe = value
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement === this.canvas) {
      this.state.aimDX += event.movementX
      this.state.aimDY += event.movementY
    }
  }

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) bus.emit('input:fire')
    else if (event.button === 2) this.state.breathHeld = true
  }

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button === 2) this.state.breathHeld = false
  }

  private readonly onWheel = (event: WheelEvent): void => {
    bus.emit('input:zoom', { dir: event.deltaY > 0 ? 1 : -1 })
    event.preventDefault()
  }

  /** Захват курсора — только в десктопной схеме и только из обработчика нажатия. */
  private readonly onCanvasPointerDown = (event: PointerEvent): void => {
    if (this.mode !== 'desktop') return
    if (event.target !== this.canvas) return
    try {
      const request = this.canvas.requestPointerLock() as unknown
      if (request instanceof Promise) request.catch(() => undefined)
    } catch {
      /* захват мог не состояться — играем без него */
    }
  }

  private attachKeyboard(): void {
    if (this.keyboardActive) return
    this.keyboardActive = true
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mousedown', this.onMouseDown)
    document.addEventListener('mouseup', this.onMouseUp)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDown)
  }

  private detachKeyboard(): void {
    if (!this.keyboardActive) return
    this.keyboardActive = false
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mousedown', this.onMouseDown)
    document.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown)
    this.keysDown.clear()
  }

  /** Полный сброс зажатого: смена схемы, пауза площадки, сворачивание вкладки. */
  releaseAll = (): void => {
    resetInputState(this.state)
    this.keysDown.clear()
    this.touchStrafe = 0
  }

  consumeAim(out: { dx: number; dy: number }): void {
    out.dx = this.state.aimDX
    out.dy = this.state.aimDY
    this.state.aimDX = 0
    this.state.aimDY = 0
  }

  tick(dt: number): void {
    if (this.switchCooldown > 0) this.switchCooldown -= dt
  }
}
