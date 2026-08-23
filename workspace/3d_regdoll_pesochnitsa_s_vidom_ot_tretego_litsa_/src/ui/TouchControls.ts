import type { InputRouter } from '../core/InputRouter.ts'

/**
 * Тач-схема управления: слой создаётся ТОЛЬКО в мобильном режиме и вставляется
 * в DOM здесь же. Pointer Events с setPointerCapture и учётом pointerId.
 * Старт: касание в любой точке и оттягивание назад — прицел рогатки.
 * Полёт: удержание и свайп в сторону манёвра; короткий тап — Stunt Kick.
 */
export class TouchControls {
  readonly root: HTMLDivElement
  private hint: HTMLDivElement
  private activePointer: number | null = null
  private startX = 0
  private startY = 0
  private lastX = 0
  private lastY = 0
  private isFlightPhase = false

  constructor(
    private readonly router: InputRouter,
    mountTo: HTMLElement,
  ) {
    this.root = document.createElement('div')
    this.root.className = 'ui-layer controls-layer'

    const zone = document.createElement('div')
    zone.className = 'touch-zone'

    zone.addEventListener('pointerdown', (e) => {
      if (this.activePointer !== null) return
      this.activePointer = e.pointerId
      this.startX = e.clientX
      this.startY = e.clientY
      this.lastX = e.clientX
      this.lastY = e.clientY
      try {
        zone.setPointerCapture(e.pointerId)
      } catch { /* палец уже отпущен */ }
      if (!this.isFlightPhase) {
        this.router.beginAim(e.clientX, e.clientY)
      }
    })
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointer) return
      const dx = e.clientX - this.lastX
      const dy = e.clientY - this.lastY
      this.lastX = e.clientX
      this.lastY = e.clientY
      if (this.isFlightPhase) {
        // Свайп задаёт подруливание; оси затухают в Game по таймеру.
        this.router.steerRoll += dx * 0.02
        this.router.steerPitch -= dy * 0.02
        this.router.steerRoll = Math.max(-1, Math.min(1, this.router.steerRoll))
        this.router.steerPitch = Math.max(-1, Math.min(1, this.router.steerPitch))
      } else {
        this.router.moveAim(e.clientX, e.clientY)
      }
    })
    const finishPointer = (e: PointerEvent): void => {
      if (e.pointerId !== this.activePointer) return
      this.activePointer = null
      const dragDistance = Math.hypot(e.clientX - this.startX, e.clientY - this.startY)
      if (!this.isFlightPhase) {
        this.router.endAim()
      } else if (dragDistance < 12) {
        // Короткий тап в полёте/контакте — аварийный толчок Stunt Kick.
        this.router.queueKick()
      }
    }
    zone.addEventListener('pointerup', finishPointer)
    zone.addEventListener('pointercancel', finishPointer)

    this.hint = document.createElement('div')
    this.hint.className = 'touch-hint'
    this.hint.textContent = 'Оттяните палец назад и отпустите'

    this.root.appendChild(zone)
    this.root.appendChild(this.hint)

    // Отмена браузерных жестов.
    this.root.addEventListener('contextmenu', (e) => e.preventDefault())
    this.root.addEventListener('dragstart', (e) => e.preventDefault())

    mountTo.appendChild(this.root)

    const release = (): void => {
      this.activePointer = null
      this.router.releaseAll()
    }
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') release()
    })
  }

  setVisible(visible: boolean): void {
    // При скрытии слоя все оси и кнопки сбрасываются.
    this.root.style.display = visible ? '' : 'none'
    if (!visible && this.activePointer !== null) {
      this.activePointer = null
      this.router.releaseAll()
    }
  }

  setFlightPhase(flight: boolean): void {
    this.isFlightPhase = flight
    this.hint.textContent = flight ? 'Ведите пальцем: свайп — манёвр, тап — пинок' : 'Оттяните палец назад и отпустите'
  }
}
