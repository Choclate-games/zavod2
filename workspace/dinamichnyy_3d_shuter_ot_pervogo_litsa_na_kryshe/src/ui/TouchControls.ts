// Тач-схема управления (профиль shooter, ландшафт):
// левая половина — свайпы влево/вправо (полосы) и вверх/вниз (прыжок/подкат),
// правая половина — drag-наведение прицела, тап — выстрел.
// Только Pointer Events + setPointerCapture; каждый палец живёт своим pointerId.

import { el } from './components'
import { icon } from './icons'
import { t } from '../i18n/messages'
import type { InputRouter } from '../input/InputRouter'

const SWIPE_THRESHOLD_PX = 34

export class TouchControls {
  readonly root: HTMLElement
  private readonly leftZone: HTMLElement
  private readonly rightZone: HTMLElement
  private readonly overloadButton: HTMLButtonElement
  private readonly pauseButton: HTMLButtonElement

  private leftPointerId = -1
  private leftStartX = 0
  private leftStartY = 0
  private leftConsumed = false

  private rightPointerId = -1
  private rightLastX = 0
  private rightLastY = 0
  private rightDownTimeMs = 0
  private rightMovedFar = false
  aiming = false

  constructor(private readonly input: InputRouter) {
    this.root = el('div', 'touch-root')

    this.leftZone = el('div', 'touch-zone left')
    this.rightZone = el('div', 'touch-zone right')

    this.overloadButton = document.createElement('button')
    this.overloadButton.type = 'button'
    this.overloadButton.className = 'overload-button'
    this.overloadButton.innerHTML = `${icon('bolt')}<span>OVERLOAD</span>`
    this.overloadButton.style.flexDirection = 'column'
    this.overloadButton.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.input.queueOverload()
    })

    this.pauseButton = document.createElement('button')
    this.pauseButton.type = 'button'
    this.pauseButton.className = 'icon-btn pause-corner'
    this.pauseButton.setAttribute('aria-label', t('pause'))
    this.pauseButton.innerHTML = icon('pause')
    this.pauseButton.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.input.queuePause()
    })

    this.leftZone.addEventListener('pointerdown', (e) => this.onLeftDown(e))
    this.leftZone.addEventListener('pointermove', (e) => this.onLeftMove(e))
    this.leftZone.addEventListener('pointerup', () => this.onLeftUp())
    this.leftZone.addEventListener('pointercancel', () => this.onLeftUp())

    this.rightZone.addEventListener('pointerdown', (e) => this.onRightDown(e))
    this.rightZone.addEventListener('pointermove', (e) => this.onRightMove(e))
    this.rightZone.addEventListener('pointerup', (e) => this.onRightUp(e))
    this.rightZone.addEventListener('pointercancel', (e) => this.onRightUp(e))

    // контекстное меню и выделение по долгому нажатию запрещены
    for (const zone of [this.leftZone, this.rightZone]) {
      zone.addEventListener('contextmenu', (e) => e.preventDefault())
      zone.style.touchAction = 'none'
    }

    this.root.append(this.leftZone, this.rightZone, this.overloadButton, this.pauseButton)
  }

  private onLeftDown(e: PointerEvent): void {
    if (this.leftPointerId !== -1) return
    this.leftPointerId = e.pointerId
    this.leftStartX = e.clientX
    this.leftStartY = e.clientY
    this.leftConsumed = false
    this.leftZone.setPointerCapture(e.pointerId)
  }

  private onLeftMove(e: PointerEvent): void {
    if (e.pointerId !== this.leftPointerId || this.leftConsumed) return
    const dx = e.clientX - this.leftStartX
    const dy = e.clientY - this.leftStartY
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      this.input.queueStrafe(Math.sign(dx))
      this.leftConsumed = true
      this.leftStartX = e.clientX
    } else if (dy <= -SWIPE_THRESHOLD_PX * 1.4) {
      this.input.queueJump()
      this.leftConsumed = true
    } else if (dy >= SWIPE_THRESHOLD_PX * 1.4) {
      this.input.queueSlide()
      this.leftConsumed = true
    }
  }

  private onLeftUp(): void {
    this.leftPointerId = -1
    this.leftConsumed = false
  }

  private onRightDown(e: PointerEvent): void {
    if (this.rightPointerId !== -1) return
    this.rightPointerId = e.pointerId
    this.rightLastX = e.clientX
    this.rightLastY = e.clientY
    this.rightDownTimeMs = performance.now()
    this.rightMovedFar = false
    this.aiming = true
    this.rightZone.setPointerCapture(e.pointerId)
  }

  private onRightMove(e: PointerEvent): void {
    if (e.pointerId !== this.rightPointerId) return
    const dx = e.clientX - this.rightLastX
    const dy = e.clientY - this.rightLastY
    this.rightLastX = e.clientX
    this.rightLastY = e.clientY
    if (Math.hypot(dx, dy) > 3) this.rightMovedFar = true
    this.input.addAimDelta(dx * 2.4, dy * 2.4)
  }

  private onRightUp(e: PointerEvent): void {
    if (e.pointerId !== this.rightPointerId) return
    this.rightPointerId = -1
    this.aiming = false
    // короткий тап правой зоной — импульсный выстрел
    if (!this.rightMovedFar && performance.now() - this.rightDownTimeMs < 220) {
      this.input.touchFirePulse()
    }
  }

  setOverloadReady(ready: boolean): void {
    this.overloadButton.classList.toggle('ready', ready)
  }

  reset(): void {
    this.leftPointerId = -1
    this.rightPointerId = -1
    this.aiming = false
  }
}
