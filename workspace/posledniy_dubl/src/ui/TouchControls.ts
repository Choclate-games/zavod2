import { t } from '../i18n/strings.js'

/**
 * Тач-схема управления: левая половина — плавающий стик ходьбы
 * (мёртвая зона 8%), правая половина — обзор, круглая кнопка ОГОНЬ.
 * Только Pointer Events + setPointerCapture, мультитач обязателен:
 * ходьба, обзор и огонь работают одновременно.
 */

const MAX_RADIUS = 64
const DEAD_ZONE = 0.08

export class TouchControls {
  readonly root = document.createElement('div')

  private readonly joystickBase = document.createElement('div')
  private readonly joystickKnob = document.createElement('div')
  private readonly moveZone = document.createElement('div')
  private readonly aimZone = document.createElement('div')
  private readonly fireButton = document.createElement('button')

  private movePointer = -1
  private aimPointer = -1
  private firePointer = -1
  private originX = 0
  private originY = 0

  constructor(
    private readonly onMove: (x: number, y: number) => void,
    private readonly onLook: (dx: number, dy: number) => void,
    private readonly onFire: (pressed: boolean) => void,
  ) {
    this.root.id = 'touch-layer'
    this.root.className = 'touch-layer'

    this.moveZone.id = 'touch-move-zone'
    this.moveZone.className = 'touch-zone'
    this.aimZone.id = 'touch-aim-zone'
    this.aimZone.className = 'touch-zone'

    this.joystickBase.id = 'joystick-base'
    this.joystickKnob.id = 'joystick-knob'
    this.joystickBase.appendChild(this.joystickKnob)

    this.fireButton.id = 'fire-button'
    this.fireButton.type = 'button'
    this.fireButton.textContent = t('fire')

    this.root.append(this.moveZone, this.aimZone, this.joystickBase, this.fireButton)

    // Палец, уехавший за границу зоны, не роняет управление: capture + pointerId.
    this.moveZone.addEventListener('pointerdown', this.handleMoveDown)
    this.moveZone.addEventListener('pointermove', this.handleMoveMove)
    this.moveZone.addEventListener('pointerup', this.handleMoveUp)
    this.moveZone.addEventListener('pointercancel', this.handleMoveUp)
    this.moveZone.addEventListener('lostpointercapture', this.handleMoveUp)

    this.aimZone.addEventListener('pointerdown', this.handleAimDown)
    this.aimZone.addEventListener('pointermove', this.handleAimMove)
    this.aimZone.addEventListener('pointerup', this.handleAimUp)
    this.aimZone.addEventListener('pointercancel', this.handleAimUp)

    // Второй палец на зоне прицела — краткое приближение.
    this.aimZone.dataset.secondFingerZoom = 'true'
    this.aimZone.addEventListener('pointerdown', this.handleAimSecondFinger)

    this.fireButton.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.firePointer = e.pointerId
      this.fireButton.setPointerCapture(e.pointerId)
      this.onFire(true)
    })
    const fireUp = (e: PointerEvent): void => {
      if (e.pointerId !== this.firePointer) return
      this.firePointer = -1
      this.onFire(false)
    }
    this.fireButton.addEventListener('pointerup', fireUp)
    this.fireButton.addEventListener('pointercancel', fireUp)
    this.fireButton.addEventListener('contextmenu', preventEvent, true)

    // Долгое нажатие не открывает контекстное меню; свайп не скроллит страницу.
    for (const zone of [this.moveZone, this.aimZone]) {
      zone.addEventListener('contextmenu', preventEvent, true)
    }
    this.root.addEventListener('dragstart', preventEvent, true)
  }

  private aimLastX = 0
  private aimLastY = 0
  private aimFingers = new Set<number>()
  private zoomFinger = -1
  private onZoomChange: ((active: boolean) => void) | null = null

  setZoomHandler(cb: (active: boolean) => void): void {
    this.onZoomChange = cb
  }

  private readonly handleMoveDown = (e: PointerEvent): void => {
    if (this.movePointer !== -1) return
    e.preventDefault()
    this.movePointer = e.pointerId
    this.moveZone.setPointerCapture(e.pointerId)
    this.originX = e.clientX
    this.originY = e.clientY
    this.joystickBase.style.left = `${e.clientX}px`
    this.joystickBase.style.top = `${e.clientY}px`
    this.joystickBase.classList.add('visible')
    this.updateJoystick(e.clientX, e.clientY)
  }

  private readonly handleMoveMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.movePointer) return
    e.preventDefault()
    this.updateJoystick(e.clientX, e.clientY)
  }

  private readonly handleMoveUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.movePointer) return
    this.movePointer = -1
    this.joystickBase.classList.remove('visible')
    this.joystickKnob.style.transform = 'translate(0px, 0px)'
    this.onMove(0, 0)
  }

  private updateJoystick(x: number, y: number): void {
    let dx = x - this.originX
    let dy = y - this.originY
    const dist = Math.hypot(dx, dy)
    const clamped = Math.min(MAX_RADIUS, dist)
    if (dist > 0) {
      dx = (dx / dist) * clamped
      dy = (dy / dist) * clamped
    }
    this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`
    let nx = dx / MAX_RADIUS
    let ny = dy / MAX_RADIUS
    nx = Math.abs(nx) < DEAD_ZONE ? 0 : Math.sign(nx) * ((Math.abs(nx) - DEAD_ZONE) / (1 - DEAD_ZONE))
    ny = Math.abs(ny) < DEAD_ZONE ? 0 : Math.sign(ny) * ((Math.abs(ny) - DEAD_ZONE) / (1 - DEAD_ZONE))
    this.onMove(nx, -ny)
  }

  private readonly handleAimDown = (e: PointerEvent): void => {
    if (this.aimPointer !== -1) return
    e.preventDefault()
    this.aimPointer = e.pointerId
    this.aimFingers.add(e.pointerId)
    this.aimZone.setPointerCapture(e.pointerId)
    this.aimLastX = e.clientX
    this.aimLastY = e.clientY
  }

  private readonly handleAimSecondFinger = (e: PointerEvent): void => {
    // Второй палец (пока первый держит прицел) включает приближение.
    if (this.aimFingers.size >= 1 && this.zoomFinger === -1 && e.pointerId !== this.aimPointer) {
      this.zoomFinger = e.pointerId
      if (this.onZoomChange) this.onZoomChange(true)
    }
  }

  private readonly handleAimMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.aimPointer) return
    e.preventDefault()
    this.onLook(e.clientX - this.aimLastX, e.clientY - this.aimLastY)
    this.aimLastX = e.clientX
    this.aimLastY = e.clientY
  }

  private readonly handleAimUp = (e: PointerEvent): void => {
    this.aimFingers.delete(e.pointerId)
    if (e.pointerId === this.zoomFinger) {
      this.zoomFinger = -1
      if (this.onZoomChange) this.onZoomChange(false)
    }
    if (e.pointerId === this.aimPointer) {
      this.aimPointer = -1
    }
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.root)
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('active', visible)
    if (!visible) this.releaseAll()
  }

  releaseAll(): void {
    this.movePointer = -1
    this.aimPointer = -1
    this.firePointer = -1
    this.zoomFinger = -1
    this.aimFingers.clear()
    this.joystickBase.classList.remove('visible')
    this.joystickKnob.style.transform = 'translate(0px, 0px)'
    this.onMove(0, 0)
    this.onFire(false)
    if (this.onZoomChange) this.onZoomChange(false)
  }
}

function preventEvent(e: Event): void {
  e.preventDefault()
}
