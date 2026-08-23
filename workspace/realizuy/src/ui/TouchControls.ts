import { getIconSvg } from './icons'

export interface TouchInputState {
  moveX: number
  moveY: number
  isKickPressed: boolean
  isKickHeld: boolean
  kickHoldDuration: number
  isDashPressed: boolean
  isGrabPressed: boolean
}

export class TouchControls {
  public root: HTMLElement
  private stickZone: HTMLElement
  private stickBase: HTMLElement
  private stickNub: HTMLElement
  private kickBtn: HTMLElement
  private dashBtn: HTMLElement
  private grabBtn: HTMLElement

  private stickPointerId: number | null = null
  private originX = 0
  private originY = 0
  private readonly maxRadius = 55
  private readonly deadzone = 0.08

  private kickStartTime = 0
  private kickPointerId: number | null = null

  public state: TouchInputState = {
    moveX: 0,
    moveY: 0,
    isKickPressed: false,
    isKickHeld: false,
    kickHoldDuration: 0,
    isDashPressed: false,
    isGrabPressed: false,
  }

  constructor(parentElement?: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'touch-layer'
    this.root.style.position = 'absolute'
    this.root.style.inset = '0'
    this.root.style.pointerEvents = 'none'

    this.root.innerHTML = `
      <div id="touch-stick-zone" class="touch-zone" style="position: absolute; left: 0; top: 0; width: 50%; height: 100%;">
        <div id="touch-stick-base" class="touch-stick-base">
          <div id="touch-stick-nub" class="touch-stick-nub"></div>
        </div>
      </div>

      <div class="touch-actions">
        <div style="display: flex; gap: var(--space-3); margin-bottom: var(--space-2);">
          <button id="touch-btn-grab" class="btn touch-btn-sub" title="Подбор / Бросок">${getIconSvg('grab', 28)}</button>
          <button id="touch-btn-dash" class="btn touch-btn-sub" title="Рывок">${getIconSvg('dash', 28)}</button>
        </div>
        <button id="touch-btn-kick" class="btn touch-btn-kick" title="Спартанский Пинок">${getIconSvg('kick', 44)}</button>
      </div>
    `

    this.stickZone = this.root.querySelector('#touch-stick-zone') as HTMLElement
    this.stickBase = this.root.querySelector('#touch-stick-base') as HTMLElement
    this.stickNub = this.root.querySelector('#touch-stick-nub') as HTMLElement
    this.kickBtn = this.root.querySelector('#touch-btn-kick') as HTMLElement
    this.dashBtn = this.root.querySelector('#touch-btn-dash') as HTMLElement
    this.grabBtn = this.root.querySelector('#touch-btn-grab') as HTMLElement

    this.setupPointerListeners()

    if (parentElement) {
      parentElement.appendChild(this.root)
    } else {
      const container = document.getElementById('touch')
      if (container) {
        container.appendChild(this.root)
      }
    }
  }

  private setupPointerListeners(): void {
    // Joystick zone
    this.stickZone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.stickPointerId !== null) return
      this.stickPointerId = e.pointerId
      this.stickZone.setPointerCapture(e.pointerId)

      this.originX = e.clientX
      this.originY = e.clientY

      this.stickBase.style.left = `${this.originX}px`
      this.stickBase.style.top = `${this.originY}px`
      this.stickBase.style.display = 'block'
      this.stickNub.style.transform = 'translate(0px, 0px)'
    })

    this.stickZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return
      const dx = e.clientX - this.originX
      const dy = e.clientY - this.originY
      const dist = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx)

      const clampedDist = Math.min(dist, this.maxRadius)
      const nubX = Math.cos(angle) * clampedDist
      const nubY = Math.sin(angle) * clampedDist
      this.stickNub.style.transform = `translate(${nubX}px, ${nubY}px)`

      const normalized = dist / this.maxRadius
      if (normalized < this.deadzone) {
        this.state.moveX = 0
        this.state.moveY = 0
      } else {
        const scaled = (Math.min(1.0, normalized) - this.deadzone) / (1.0 - this.deadzone)
        this.state.moveX = Math.cos(angle) * scaled
        this.state.moveY = Math.sin(angle) * scaled
      }
    })

    const releaseStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return
      this.stickPointerId = null
      this.stickBase.style.display = 'none'
      this.state.moveX = 0
      this.state.moveY = 0
    }

    this.stickZone.addEventListener('pointerup', releaseStick)
    this.stickZone.addEventListener('pointercancel', releaseStick)
    this.stickZone.addEventListener('lostpointercapture', releaseStick)

    // Kick button with charging
    this.kickBtn.addEventListener('pointerdown', (e: PointerEvent) => {
      this.kickPointerId = e.pointerId
      this.kickBtn.setPointerCapture(e.pointerId)
      this.kickStartTime = performance.now()
      this.state.isKickHeld = true
    })

    const releaseKick = (e: PointerEvent) => {
      if (e.pointerId !== this.kickPointerId) return
      this.kickPointerId = null
      const duration = (performance.now() - this.kickStartTime) / 1000
      this.state.kickHoldDuration = duration
      this.state.isKickPressed = true
      this.state.isKickHeld = false
      setTimeout(() => {
        this.state.isKickPressed = false
      }, 50)
    }

    this.kickBtn.addEventListener('pointerup', releaseKick)
    this.kickBtn.addEventListener('pointercancel', releaseKick)

    // Dash button
    this.dashBtn.addEventListener('pointerdown', (e: PointerEvent) => {
      this.dashBtn.setPointerCapture(e.pointerId)
      this.state.isDashPressed = true
      setTimeout(() => {
        this.state.isDashPressed = false
      }, 50)
    })

    // Grab / Throw button
    this.grabBtn.addEventListener('pointerdown', (e: PointerEvent) => {
      this.grabBtn.setPointerCapture(e.pointerId)
      this.state.isGrabPressed = true
      setTimeout(() => {
        this.state.isGrabPressed = false
      }, 50)
    })
  }

  public setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none'
    if (!visible) {
      this.releaseAll()
    }
  }

  public releaseAll(): void {
    this.stickPointerId = null
    this.kickPointerId = null
    this.stickBase.style.display = 'none'
    this.state.moveX = 0
    this.state.moveY = 0
    this.state.isKickPressed = false
    this.state.isKickHeld = false
    this.state.isDashPressed = false
    this.state.isGrabPressed = false
  }

  public destroy(): void {
    if (this.root.parentElement) {
      this.root.parentElement.removeChild(this.root)
    }
  }
}
