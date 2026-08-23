/**
 * Единственный роутер ввода. Игровые системы читают состояние отсюда и не
 * вешают keydown/pointerdown сами. Схем две — десктопная и тач — и ровно одна
 * активна; режим выбирает площадка (bridge.device.type), браузерные признаки —
 * запасной вариант для dev-сервера. ?input=touch / ?input=desktop / ?touch=1|0
 * принудительно задают схему и отключают автопереключение.
 */
export type InputScheme = 'desktop' | 'touch'
export type PlatformDeviceType = 'mobile' | 'tablet' | 'desktop' | string

export interface InputSnapshot {
  steer: number
  throttle: number
  brake: number
  handbrake: boolean
}

export class InputRouter {
  scheme: InputScheme = 'desktop'
  private autoSwitch = true

  /** Целевые оси. Пишутся клавиатурой или тач-слоем, читаются игрой. */
  private steerAxis = 0
  private throttleAxis = 0
  private brakeAxis = 0
  private handbrakeOn = false
  private turboEdge = false
  private valveEdge = false

  onPauseRequest: (() => void) | null = null
  onRestartRequest: (() => void) | null = null

  private readonly keys = new Set<string>()
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return
    const code = e.code
    if (!this.autoSwitch && this.scheme !== 'desktop') return
    if (this.scheme !== 'desktop') {
      if (code === 'KeyA' || code === 'KeyD' || code === 'KeyW' || code === 'ArrowLeft' || code === 'ArrowRight') {
        this.setScheme('desktop')
      } else {
        return
      }
    }
    if (e.type === 'keyup') {
      this.keys.delete(code)
    } else {
      this.keys.add(code)
      if (code === 'Space') this.handbrakeOn = true
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.turboEdge = true
      if (code === 'KeyE' || code === 'KeyF') this.valveEdge = true
      if (code === 'Escape' || code === 'KeyP') this.onPauseRequest?.()
      if (code === 'KeyR') this.onRestartRequest?.()
    }
    this.recomputeAxes()
  }

  private readonly onPointerProbe = (e: PointerEvent): void => {
    if (this.autoSwitch && this.scheme !== 'touch' && e.pointerType === 'touch') {
      this.setScheme('touch')
    }
  }

  private readonly onBlur = (): void => this.releaseAll()

  constructor(private readonly onChange: (scheme: InputScheme) => void) {}

  resolveInitialScheme(deviceType: PlatformDeviceType | null): void {
    const params = new URLSearchParams(window.location.search)
    const forced = params.get('input')
    const touchParam = params.get('touch')
    if (forced === 'touch' || touchParam === '1') {
      this.scheme = 'touch'
      this.autoSwitch = false
    } else if (forced === 'desktop' || touchParam === '0') {
      this.scheme = 'desktop'
      this.autoSwitch = false
    } else if (deviceType === 'mobile' || deviceType === 'tablet') {
      this.scheme = 'touch'
    } else if (deviceType === 'desktop') {
      this.scheme = 'desktop'
    } else {
      const coarse = window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0
      this.scheme = coarse ? 'touch' : 'desktop'
    }
  }

  attach(): void {
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKey)
    window.addEventListener('pointerdown', this.onPointerProbe)
    window.addEventListener('blur', this.onBlur)
    document.addEventListener('visibilitychange', this.onBlur)
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKey)
    window.removeEventListener('pointerdown', this.onPointerProbe)
    window.removeEventListener('blur', this.onBlur)
    document.removeEventListener('visibilitychange', this.onBlur)
  }

  setScheme(scheme: InputScheme): void {
    if (this.scheme === scheme) return
    this.releaseAll()
    this.scheme = scheme
    this.onChange(scheme)
  }

  /** Тач-слой пишет оси через эти методы. */
  setSteerAxis(value: number): void {
    this.steerAxis = Math.max(-1, Math.min(1, value))
  }

  setPedals(throttle: number, brake: number): void {
    this.throttleAxis = Math.max(0, Math.min(1, throttle))
    this.brakeAxis = Math.max(0, Math.min(1, brake))
  }

  setHandbrake(pressed: boolean): void {
    this.handbrakeOn = pressed
  }

  pressTurbo(): void {
    this.turboEdge = true
  }

  pressValve(): void {
    this.valveEdge = true
  }

  consumeTurbo(): boolean {
    const fired = this.turboEdge
    this.turboEdge = false
    return fired
  }

  consumeValve(): boolean {
    const fired = this.valveEdge
    this.valveEdge = false
    return fired
  }

  /** Снимок для физики: объект переиспользуется, в кадре аллокаций нет. */
  read(out: InputSnapshot): InputSnapshot {
    out.steer = this.steerAxis
    out.throttle = this.throttleAxis
    out.brake = this.brakeAxis
    out.handbrake = this.handbrakeOn
    return out
  }

  releaseAll(): void {
    this.keys.clear()
    this.steerAxis = 0
    this.throttleAxis = 0
    this.brakeAxis = 0
    this.handbrakeOn = false
    this.turboEdge = false
    this.valveEdge = false
  }

  private recomputeAxes(): void {
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft')
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight')
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp')
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown')
    this.steerAxis = (right ? 1 : 0) - (left ? 1 : 0)
    this.throttleAxis = up ? 1 : 0
    this.brakeAxis = down ? 1 : 0
  }
}
