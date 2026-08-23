import { bus } from '../core/events.js'

/**
 * Экранная схема управления: виртуальный джойстик, зона «Шаг шествия» и кнопки
 * действий. Pointer Events с захватом pointerId — палец, уехавший за границу
 * зоны, управление не роняет. Слой вставляется в DOM только активной схемы.
 */

export interface TouchCallbacks {
  onParry: () => void
  onKick: () => void
  onDash: () => void
  onConfetti: () => void
}

export class TouchControls {
  readonly root = document.createElement('div')
  private readonly joystickZone = document.createElement('div')
  private readonly joystickBase = document.createElement('div')
  private readonly joystickStick = document.createElement('div')
  private readonly blendZone = document.createElement('div')
  private readonly buttonRow = document.createElement('div')
  private readonly buttons = new Map<string, HTMLButtonElement>()

  private movePointerId = -1
  private blendPointerId = -1
  private originX = 0
  private originY = 0
  moveX = 0
  moveZ = 0
  blending = false

  constructor(private readonly cb: TouchCallbacks) {
    this.root.className = 'touch-layer'
    this.joystickZone.className = 'touch-joystick-zone'
    this.joystickBase.className = 'touch-joystick-base'
    this.joystickStick.className = 'touch-joystick-stick'
    this.blendZone.className = 'touch-blend-zone'
    this.buttonRow.className = 'touch-buttons'

    this.joystickBase.appendChild(this.joystickStick)
    this.joystickZone.appendChild(this.joystickBase)

    const defs: Array<{ id: string; labelKey: string; icon: string; cls: string }> = [
      { id: 'parry', labelKey: 'act.parry', icon: iconShield(), cls: 'touch-btn-parry' },
      { id: 'kick', labelKey: 'act.kick', icon: iconBoot(), cls: 'touch-btn-kick' },
      { id: 'confetti', labelKey: 'act.confetti', icon: iconPop(), cls: 'touch-btn-confetti' },
      { id: 'dash', labelKey: 'act.dash', icon: iconRam(), cls: 'touch-btn-dash' },
    ]
    for (const def of defs) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `touch-btn ${def.cls}`
      btn.dataset.action = `touch-${def.id}`
      btn.setAttribute('aria-label', def.labelKey)
      btn.innerHTML = `${def.icon}<span class="touch-btn-label" data-lang="${def.labelKey}"></span>`
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        btn.setPointerCapture(e.pointerId)
        this.fire(def.id)
      })
      this.buttons.set(def.id, btn)
      this.buttonRow.appendChild(btn)
    }

    // Кнопка выпада крупнее и стоит отдельно справа над остальными.
    const lungeBtn = document.createElement('button')
    lungeBtn.type = 'button'
    lungeBtn.className = 'touch-btn touch-btn-lunge'
    lungeBtn.dataset.action = 'touch-lunge'
    lungeBtn.setAttribute('aria-label', 'act.lunge')
    lungeBtn.innerHTML = `${iconBlade()}<span class="touch-btn-label" data-lang="act.lunge"></span>`
    lungeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      lungeBtn.setPointerCapture(e.pointerId)
      bus.emit('ui:lungeRequested', { x: null, z: null })
    })

    this.root.appendChild(this.joystickZone)
    this.root.appendChild(this.blendZone)
    this.root.appendChild(this.buttonRow)
    this.root.appendChild(lungeBtn)

    this.joystickZone.addEventListener('pointerdown', this.onJoystickDown)
    this.joystickZone.addEventListener('pointermove', this.onJoystickMove)
    this.joystickZone.addEventListener('pointerup', this.onJoystickUp)
    this.joystickZone.addEventListener('pointercancel', this.onJoystickUp)
    this.blendZone.addEventListener('pointerdown', this.onBlendDown)
    this.blendZone.addEventListener('pointerup', this.onBlendUp)
    this.blendZone.addEventListener('pointercancel', this.onBlendUp)

    window.addEventListener('blur', this.resetAll)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetAll()
    })
  }

  /** Слой вставляется в переданный контейнер интерфейса. */
  mount(container: HTMLElement): void {
    container.appendChild(this.root)
  }

  unmount(): void {
    if (this.root.parentElement) this.root.parentElement.removeChild(this.root)
    this.resetAll()
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? '' : 'none'
  }

  private fire(id: string): void {
    switch (id) {
      case 'parry':
        this.cb.onParry()
        break
      case 'kick':
        this.cb.onKick()
        break
      case 'dash':
        this.cb.onDash()
        break
      case 'confetti':
        this.cb.onConfetti()
        break
      default:
        break
    }
  }

  private onJoystickDown = (event: PointerEvent): void => {
    event.preventDefault()
    this.joystickZone.setPointerCapture(event.pointerId)
    this.movePointerId = event.pointerId
    const rect = this.joystickZone.getBoundingClientRect()
    this.originX = rect.left + rect.width / 2
    this.originY = rect.top + rect.height / 2
    this.applyJoystick(event.clientX, event.clientY)
  }

  private onJoystickMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.movePointerId) return
    this.applyJoystick(event.clientX, event.clientY)
  }

  private onJoystickUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.movePointerId) return
    this.movePointerId = -1
    this.moveX = 0
    this.moveZ = 0
    this.joystickStick.style.transform = ''
  }

  private applyJoystick(clientX: number, clientY: number): void {
    const maxRadius = 52
    let dx = clientX - this.originX
    let dy = clientY - this.originY
    const len = Math.hypot(dx, dy)
    if (len > maxRadius) {
      dx = (dx / len) * maxRadius
      dy = (dy / len) * maxRadius
    }
    this.moveX = dx / maxRadius
    this.moveZ = dy / maxRadius
    this.joystickStick.style.transform = `translate(${dx}px, ${dy}px)`
  }

  private onBlendDown = (event: PointerEvent): void => {
    event.preventDefault()
    this.blendZone.setPointerCapture(event.pointerId)
    this.blendPointerId = event.pointerId
    this.blending = true
    this.blendZone.classList.add('is-active')
  }

  private onBlendUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.blendPointerId) return
    this.blendPointerId = -1
    this.blending = false
    this.blendZone.classList.remove('is-active')
  }

  resetAll = (): void => {
    this.movePointerId = -1
    this.blendPointerId = -1
    this.moveX = 0
    this.moveZ = 0
    this.blending = false
    this.joystickStick.style.transform = ''
    this.blendZone.classList.remove('is-active')
  }
}

function svgIcon(paths: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
}

function iconBlade(): string {
  return svgIcon('<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/>')
}

function iconShield(): string {
  return svgIcon('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>')
}

function iconBoot(): string {
  return svgIcon('<path d="M4 16v3h10l4-4h2v-3h-6l-2 2H6z"/><path d="M6 12V5h4l1 4h5"/>')
}

function iconPop(): string {
  return svgIcon('<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15v4"/><path d="M21 17h-4"/>')
}

function iconRam(): string {
  return svgIcon('<path d="M13 5h6v6"/><path d="m19 5-7 7"/><path d="M5 19l4-4"/>')
}
