import { bus } from '../core/eventBus.js'
import { t } from '../core/i18n.js'
import type { InputRouter } from '../systems/InputRouter.js'

/** Экранное управление: Pointer Events + setPointerCapture и учёт pointerId
 * для каждой зоны; слой вставляется в DOM только в тач-схеме. */
export class TouchControls {
  readonly root: HTMLDivElement

  private host: HTMLElement
  private router: InputRouter
  private strafePointerId = -1
  private strafeStartX = 0
  private aimPointers = new Map<number, { x: number; y: number }>()
  private pinchStartDist = 0

  constructor(host: HTMLElement, router: InputRouter) {
    this.host = host
    this.router = router

    this.root = document.createElement('div')
    this.root.className = 'touch-layer'

    const strafeZone = document.createElement('div')
    strafeZone.className = 'touch-strafe-zone'
    const strafeFill = document.createElement('div')
    strafeFill.className = 'touch-strafe-fill'
    strafeZone.appendChild(strafeFill)
    this.strafeFill = strafeFill

    const aimZone = document.createElement('div')
    aimZone.className = 'touch-aim-zone'

    this.breathBtn = this.makeButton('touch-breath', 'lungs', () => this.setBreath(true), () => this.setBreath(false))
    this.fireBtn = this.makeButton('touch-fire', 'crosshair', () => bus.emit('input:fire'), undefined)
    this.echoBtn = this.makeButton('touch-echo', 'echo', () => bus.emit('input:echo'), undefined)
    this.zoomBtn = this.makeButton('touch-zoom', 'scope', () => bus.emit('input:zoom', { dir: 1 }), undefined)
    this.rangeBtn = this.makeButton('touch-range', 'ruler', () => bus.emit('input:rangefinder'), undefined)

    this.root.appendChild(aimZone)
    this.root.appendChild(strafeZone)
    this.root.appendChild(this.breathBtn)
    this.root.appendChild(this.fireBtn)
    this.root.appendChild(this.echoBtn)
    this.root.appendChild(this.zoomBtn)
    this.root.appendChild(this.rangeBtn)

    // зоны: слайдер шага и перетаскивание прицела
    strafeZone.addEventListener('pointerdown', (e) => this.onStrafeDown(e))
    strafeZone.addEventListener('pointermove', (e) => this.onStrafeMove(e))
    strafeZone.addEventListener('pointerup', (e) => this.onStrafeUp(e))
    strafeZone.addEventListener('pointercancel', (e) => this.onStrafeUp(e))
    aimZone.addEventListener('pointerdown', (e) => this.onAimDown(e))
    aimZone.addEventListener('pointermove', (e) => this.onAimMove(e))
    aimZone.addEventListener('pointerup', (e) => this.onAimUp(e))
    aimZone.addEventListener('pointercancel', (e) => this.onAimUp(e))

    this.aimZoneEl = aimZone
  }

  private strafeFill: HTMLDivElement
  private aimZoneEl: HTMLDivElement
  private breathBtn: HTMLButtonElement
  private fireBtn: HTMLButtonElement
  private echoBtn: HTMLButtonElement
  private zoomBtn: HTMLButtonElement
  private rangeBtn: HTMLButtonElement

  private makeButton(className: string, icon: string, onDown: () => void, onUp?: (() => void) | undefined): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `touch-btn ${className}`
    btn.setAttribute('aria-label', t(`touch.${icon}`))
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.innerHTML = `<use href="#icon-${icon}"></use>`
    btn.appendChild(svg)
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      btn.setPointerCapture(e.pointerId)
      btn.classList.add('pressed')
      onDown()
    })
    const release = (e: PointerEvent) => {
      e.preventDefault()
      btn.classList.remove('pressed')
      onUp?.()
    }
    btn.addEventListener('pointerup', release)
    btn.addEventListener('pointercancel', release)
    return btn
  }

  /** Вставка слоя в DOM — вызывается только в мобильной схеме. */
  mount(): void {
    if (this.root.parentElement === this.host) return
    this.host.appendChild(this.root)
  }

  unmount(): void {
    if (this.root.parentElement) this.root.parentElement.removeChild(this.root)
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible)
    if (!visible) this.resetAll()
  }

  private setBreath(active: boolean): void {
    this.router.state.breathHeld = active
    this.breathBtn.classList.toggle('active', active)
  }

  private onStrafeDown(event: PointerEvent): void {
    if (this.strafePointerId !== -1) return
    this.strafePointerId = event.pointerId
    this.strafeStartX = event.clientX
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  private onStrafeMove(event: PointerEvent): void {
    if (event.pointerId !== this.strafePointerId) return
    const width = Math.max(1, this.aimZoneEl.ownerDocument.defaultView?.innerWidth ?? 360)
    const delta = (event.clientX - this.strafeStartX) / (width * 0.16)
    const clamped = Math.max(-1, Math.min(1, delta))
    this.router.setTouchStrafe(clamped)
    this.strafeFill.style.transform = `scaleX(${Math.abs(clamped)})`
    this.strafeFill.style.transformOrigin = clamped < 0 ? 'right' : 'left'
  }

  private onStrafeUp(event: PointerEvent): void {
    if (event.pointerId !== this.strafePointerId) return
    this.strafePointerId = -1
    this.router.setTouchStrafe(0)
    this.strafeFill.style.transform = 'scaleX(0)'
  }

  private onAimDown(event: PointerEvent): void {
    this.aimPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.aimPointers.size === 2) {
      const points = [...this.aimPointers.values()]
      this.pinchStartDist = Math.abs(points[0].x - points[1].x) + Math.abs(points[0].y - points[1].y)
    }
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  private onAimMove(event: PointerEvent): void {
    const prev = this.aimPointers.get(event.pointerId)
    if (!prev) return
    const dx = event.clientX - prev.x
    const dy = event.clientY - prev.y
    prev.x = event.clientX
    prev.y = event.clientY
    if (this.aimPointers.size >= 2) {
      const points = [...this.aimPointers.values()]
      const dist = Math.abs(points[0].x - points[1].x) + Math.abs(points[0].y - points[1].y)
      if (Math.abs(dist - this.pinchStartDist) > 60) {
        bus.emit('input:zoom', { dir: dist > this.pinchStartDist ? -1 : 1 })
        this.pinchStartDist = dist
      }
      return
    }
    this.router.state.aimDX += dx * 2.4
    this.router.state.aimDY += dy * 2.4
  }

  private onAimUp(event: PointerEvent): void {
    this.aimPointers.delete(event.pointerId)
    this.pinchStartDist = 0
  }

  /** Сброс всех зажатых осей и кнопок: пауза, сворачивание вкладки, blur. */
  resetAll(): void {
    this.strafePointerId = -1
    this.aimPointers.clear()
    this.router.setTouchStrafe(0)
    this.setBreath(false)
    this.strafeFill.style.transform = 'scaleX(0)'
  }
}
