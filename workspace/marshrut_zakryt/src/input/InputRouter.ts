export type InputScheme = 'desktop' | 'touch'

/** Тип устройства в терминах площадки: планшет считается тачем. */
export type DeviceKind = 'mobile' | 'tablet' | 'desktop' | 'tv'

/**
 * Единственный роутер ввода: игровые системы берут состояние отсюда и не
 * вешают keydown/pointerdown сами. Схем ровно две; активную выбирает тип
 * устройства от площадки, ?input= принудительно переключает и отключает
 * автопереключение.
 */
export class InputRouter {
  private scheme: InputScheme = 'desktop'
  private autoSwitch = true
  private keys = new Set<string>()
  private firing = false
  private aimX = 0.5
  private aimY = 0.5
  private moveTouchId: number | null = null
  private moveStartX = 0
  private moveStartY = 0
  private moveX = 0
  private moveY = 0
  // Переиспользуемые значения: игровой цикл не аллоцирует.
  private readonly axisVec = { x: 0, y: 0 }
  private readonly aimVec = { x: 0.5, y: 0.5 }
  private readonly listeners: Array<[EventTarget, string, EventListener]> = []

  constructor(deviceType: DeviceKind | null) {
    const forced = new URLSearchParams(window.location.search).get('input')
    if (forced === 'touch' || forced === 'desktop') {
      this.scheme = forced
      this.autoSwitch = false
    } else {
      const type = deviceType ?? this.guessDevice()
      this.scheme = type === 'mobile' || type === 'tablet' || type === 'tv' ? 'touch' : 'desktop'
    }
    this.bind()
  }

  /** Запасной путь для dev-сервера, где моста нет. */
  private guessDevice(): DeviceKind {
    const coarse = navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches
    return coarse ? 'mobile' : 'desktop'
  }

  getScheme(): InputScheme {
    return this.scheme
  }

  /** Оси движения −1..1 из WASD или перетаскивания; возвращает общий вектор. */
  moveAxis(): { readonly x: number; readonly y: number } {
    let x = 0
    let y = 0
    if (this.scheme === 'desktop') {
      if (this.keys.has('KeyA')) x -= 1
      if (this.keys.has('KeyD')) x += 1
      if (this.keys.has('KeyW')) y += 1
      if (this.keys.has('KeyS')) y -= 1
    } else {
      x = this.moveX
      y = -this.moveY
    }
    this.axisVec.x = Math.max(-1, Math.min(1, x))
    this.axisVec.y = Math.max(-1, Math.min(1, y))
    return this.axisVec
  }

  isFiring(): boolean {
    return this.firing
  }

  /** Нормированные координаты прицела 0..1 по экрану; общий вектор. */
  aim(): { readonly x: number; readonly y: number } {
    this.aimVec.x = this.aimX
    this.aimVec.y = this.aimY
    return this.aimVec
  }

  /** Смена схемы начинается с отпускания всех зажатых осей и кнопок. */
  releaseAll(): void {
    this.keys.clear()
    this.firing = false
    this.moveTouchId = null
    this.moveX = 0
    this.moveY = 0
  }

  dispose(): void {
    for (const [target, type, handler] of this.listeners) target.removeEventListener(type, handler)
    this.listeners.length = 0
  }

  private bind(): void {
    // Клавиатура вешается напрямую: это ядро десктопной схемы.
    const onKeyDown = (event: KeyboardEvent) => {
      if (this.autoSwitch && this.scheme !== 'desktop') this.switchScheme('desktop')
      this.keys.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      this.keys.delete(event.code)
    }
    window.addEventListener('keydown', onKeyDown as EventListener)
    this.listeners.push([window, 'keydown', onKeyDown as EventListener])
    window.addEventListener('keyup', onKeyUp as EventListener)
    this.listeners.push([window, 'keyup', onKeyUp as EventListener])

    const add = <T extends Event>(target: EventTarget, type: string, handler: (event: T) => void) => {
      const listener = handler as EventListener
      target.addEventListener(type, listener)
      this.listeners.push([target, type, listener])
    }

    add(window, 'blur', () => this.releaseAll())
    add(document, 'visibilitychange', () => {
      if (document.hidden) this.releaseAll()
    })

    add(window, 'pointermove', (event: PointerEvent) => {
      this.aimX = event.clientX / Math.max(1, window.innerWidth)
      this.aimY = event.clientY / Math.max(1, window.innerHeight)
      if (this.moveTouchId !== null && event.pointerId === this.moveTouchId) {
        this.moveX = Math.max(-1, Math.min(1, (event.clientX - this.moveStartX) / 120))
        this.moveY = Math.max(-1, Math.min(1, (event.clientY - this.moveStartY) / 120))
      }
    })

    add(window, 'pointerdown', (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        if (this.autoSwitch && this.scheme !== 'touch') this.switchScheme('touch')
        // Первый палец в нижней половине экрана ведёт движение.
        if (this.moveTouchId === null && event.clientY > window.innerHeight * 0.5) {
          this.moveTouchId = event.pointerId
          this.moveStartX = event.clientX
          this.moveStartY = event.clientY
          if (event.target instanceof Element) event.target.setPointerCapture(event.pointerId)
        } else {
          this.firing = true
        }
        this.aimX = event.clientX / Math.max(1, window.innerWidth)
        this.aimY = event.clientY / Math.max(1, window.innerHeight)
        return
      }
      if (this.autoSwitch && this.scheme !== 'desktop') this.switchScheme('desktop')
      if (event.button === 0) this.firing = true
    })

    add(window, 'pointerup', (event: PointerEvent) => {
      if (event.pointerId === this.moveTouchId) {
        this.moveTouchId = null
        this.moveX = 0
        this.moveY = 0
      }
      if (event.button === 0 || event.pointerType === 'touch') this.firing = false
    })

    add(window, 'pointercancel', (event: PointerEvent) => {
      if (event.pointerId === this.moveTouchId) {
        this.moveTouchId = null
        this.moveX = 0
        this.moveY = 0
      }
      this.firing = false
    })
  }

  /** Живое переключение схем без перезагрузки страницы. */
  private switchScheme(next: InputScheme): void {
    if (this.scheme === next) {
      this.scheme = next
      return
    }
    this.releaseAll()
    this.scheme = next
  }
}
