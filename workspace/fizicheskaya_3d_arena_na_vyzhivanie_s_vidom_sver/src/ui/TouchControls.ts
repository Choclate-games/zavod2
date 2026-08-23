/**
 * Тач-слой: плавающий джойстик на левой половине экрана и кнопки
 * ТУРБО / ОТСКОК справа внизу. Только Pointer Events с setPointerCapture
 * и учётом pointerId: второй палец не сбрасывает первый, палец за границей
 * зоны не теряется. Создаётся и вставляется в DOM только в тач-режиме.
 */
const JOYSTICK_RADIUS = 52

export class TouchControls {
  readonly root: HTMLElement
  private readonly joystickBase: HTMLElement
  private readonly joystickStick: HTMLElement
  private readonly boostButton: HTMLElement
  private readonly reboundButton: HTMLElement

  private joyPointerId = -1
  private joyCenterX = 0
  private joyCenterY = 0
  private boostPointerId = -1
  private reboundPointerId = -1

  axisX = 0
  axisY = 0
  boostHeld = false
  private reboundQueued = false

  private mounted = false

  constructor(labels: { boost: string; rebound: string }) {
    this.root = document.createElement('div')
    this.root.className = 'touch-layer'

    this.joystickBase = document.createElement('div')
    this.joystickBase.className = 'joystick-base'
    this.joystickStick = document.createElement('div')
    this.joystickStick.className = 'joystick-stick'
    this.joystickBase.appendChild(this.joystickStick)
    this.joystickBase.style.display = 'none'
    this.root.appendChild(this.joystickBase)

    this.boostButton = this.createActionButton(labels.boost)
    this.reboundButton = this.createActionButton(labels.rebound)

    this.root.addEventListener('pointerdown', this.handlePointerDown)
    this.root.addEventListener('pointermove', this.handlePointerMove)
    this.root.addEventListener('pointerup', this.handlePointerUp)
    this.root.addEventListener('pointercancel', this.handlePointerUp)
    window.addEventListener('blur', this.resetState)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    this.layout()
  }

  /** Раскладка кнопок с учётом safe-area; пересчитывается при повороте. */
  layout(): void {
    const insetRight = 'calc(24px + env(safe-area-inset-right))'
    const insetBottom = 'calc(28px + env(safe-area-inset-bottom) + var(--banner-height))'
    this.boostButton.style.right = insetRight
    this.boostButton.style.bottom = insetBottom
    this.boostButton.style.width = '112px'
    this.boostButton.style.height = '112px'
    this.reboundButton.style.right = insetRight
    this.reboundButton.style.bottom = `calc(${insetBottom} + 124px)`
    this.reboundButton.style.width = '76px'
    this.reboundButton.style.height = '76px'
  }

  private createActionButton(labelText: string): HTMLElement {
    const button = document.createElement('div')
    button.className = 'action-button'
    const label = document.createElement('span')
    label.textContent = labelText
    button.appendChild(label)
    this.root.appendChild(button)
    return button
  }

  mount(parent: HTMLElement): void {
    if (this.mounted) return
    parent.appendChild(this.root)
    this.mounted = true
  }

  unmount(): void {
    if (!this.mounted) return
    this.resetState()
    this.root.remove()
    this.mounted = false
  }

  get isMounted(): boolean {
    return this.mounted
  }

  consumeRebound(): boolean {
    if (!this.reboundQueued) return false
    this.reboundQueued = false
    return true
  }

  resetState = (): void => {
    this.joyPointerId = -1
    this.boostPointerId = -1
    this.reboundPointerId = -1
    this.axisX = 0
    this.axisY = 0
    this.boostHeld = false
    this.reboundQueued = false
    this.joystickBase.style.display = 'none'
    this.boostButton.classList.remove('pressed')
    this.reboundButton.classList.remove('pressed')
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.resetState()
  }

  private handlePointerDown = (event: PointerEvent): void => {
    const target = event.target as HTMLElement
    if (target === this.boostButton || this.boostButton.contains(target)) {
      if (this.boostPointerId >= 0) return
      this.boostPointerId = event.pointerId
      this.boostHeld = true
      this.boostButton.classList.add('pressed')
      this.boostButton.setPointerCapture(event.pointerId)
      return
    }
    if (target === this.reboundButton || this.reboundButton.contains(target)) {
      if (this.reboundPointerId >= 0) return
      this.reboundPointerId = event.pointerId
      this.reboundQueued = true
      this.reboundButton.classList.add('pressed')
      this.reboundButton.setPointerCapture(event.pointerId)
      return
    }
    // Плавающий стик: база появляется под пальцем в любой точке левой половины.
    if (this.joyPointerId < 0 && event.clientX < window.innerWidth * 0.5) {
      this.joyPointerId = event.pointerId
      this.joyCenterX = event.clientX
      this.joyCenterY = event.clientY
      this.joystickBase.style.display = 'block'
      this.joystickBase.style.left = `${event.clientX}px`
      this.joystickBase.style.top = `${event.clientY}px`
      this.updateStick(event.clientX, event.clientY)
      this.root.setPointerCapture(event.pointerId)
    }
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.joyPointerId) return
    this.updateStick(event.clientX, event.clientY)
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.joyPointerId) {
      this.joyPointerId = -1
      this.axisX = 0
      this.axisY = 0
      this.joystickBase.style.display = 'none'
    } else if (event.pointerId === this.boostPointerId) {
      this.boostPointerId = -1
      this.boostHeld = false
      this.boostButton.classList.remove('pressed')
    } else if (event.pointerId === this.reboundPointerId) {
      this.reboundPointerId = -1
      this.reboundButton.classList.remove('pressed')
    }
  }

  private updateStick(x: number, y: number): void {
    let dx = x - this.joyCenterX
    let dy = y - this.joyCenterY
    const dist = Math.hypot(dx, dy)
    const deadZone = JOYSTICK_RADIUS * 0.08
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS
      dy = (dy / dist) * JOYSTICK_RADIUS
    }
    this.joystickStick.style.left = `${60 + dx}px`
    this.joystickStick.style.top = `${60 + dy}px`
    const magnitude = Math.min(1, dist / JOYSTICK_RADIUS)
    if (magnitude < deadZone / JOYSTICK_RADIUS) {
      this.axisX = 0
      this.axisY = 0
      return
    }
    const norm = Math.max(magnitude, 0.25)
    this.axisX = (dx / JOYSTICK_RADIUS) * norm
    this.axisY = (-dy / JOYSTICK_RADIUS) * norm
  }
}
