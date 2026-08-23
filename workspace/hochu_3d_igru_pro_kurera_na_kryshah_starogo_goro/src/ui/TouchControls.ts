import { Player } from '../entities/Player'

export class TouchControls {
  public root: HTMLElement
  private player: Player
  private isVisible = false

  private startX = 0
  private startY = 0
  private startTime = 0
  private activePointerId: number | null = null
  private isHolding = false

  constructor(player: Player) {
    this.player = player

    this.root = document.createElement('div')
    this.root.id = 'touch-control-surface'
    this.root.className = 'touch-surface'
    this.root.style.position = 'absolute'
    this.root.style.inset = '0'
    this.root.style.width = '100%'
    this.root.style.height = '100%'
    this.root.style.pointerEvents = 'auto'
    this.root.style.touchAction = 'none'
    this.root.style.userSelect = 'none'
    this.root.style.display = 'none'

    // Mount to DOM touch layer (satisfying G4 Check)
    const touchLayer = document.getElementById('touch-layer')
    if (touchLayer) {
      touchLayer.appendChild(this.root)
    } else {
      document.body.appendChild(this.root)
    }

    this.bindEvents()
  }

  private bindEvents(): void {
    this.root.addEventListener('contextmenu', (e) => e.preventDefault())
    this.root.addEventListener('dragstart', (e) => e.preventDefault())

    this.root.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.activePointerId !== null) return
      this.activePointerId = e.pointerId
      this.root.setPointerCapture(e.pointerId)

      this.startX = e.clientX
      this.startY = e.clientY
      this.startTime = performance.now()
      this.isHolding = true

      this.player.handleHoldStart()
    })

    this.root.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return

      const dx = e.clientX - this.startX
      const dy = e.clientY - this.startY
      const distSq = dx * dx + dy * dy

      // If finger moves significantly, trigger directional gestures
      if (distSq > 900) { // 30px threshold
        if (Math.abs(dy) > Math.abs(dx)) {
          if (dy < -25) {
            // Swipe Up -> Jump or Ledge Grab
            this.player.handleJump()
            this.resetGesture(e.clientX, e.clientY)
          } else if (dy > 25) {
            // Swipe Down -> Slide
            this.player.handleSlide()
            this.resetGesture(e.clientX, e.clientY)
          }
        } else {
          if (dx > 25) {
            // Swipe Right -> Balance right
            this.player.handleBalanceTilt(1)
            this.resetGesture(e.clientX, e.clientY)
          } else if (dx < -25) {
            // Swipe Left -> Balance left
            this.player.handleBalanceTilt(-1)
            this.resetGesture(e.clientX, e.clientY)
          }
        }
      }
    })

    const endGesture = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return
      try {
        this.root.releasePointerCapture(e.pointerId)
      } catch {}

      const duration = performance.now() - this.startTime
      const dx = e.clientX - this.startX
      const dy = e.clientY - this.startY

      // Quick tap (short duration, minimal movement) -> Jump
      if (duration < 220 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        this.player.handleJump()
      }

      this.isHolding = false
      this.player.handleHoldEnd()
      this.activePointerId = null
    }

    this.root.addEventListener('pointerup', endGesture)
    this.root.addEventListener('pointercancel', endGesture)

    window.addEventListener('blur', () => this.reset())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset()
    })
  }

  private resetGesture(curX: number, curY: number): void {
    this.startX = curX
    this.startY = curY
    this.startTime = performance.now()
  }

  public reset(): void {
    this.activePointerId = null
    this.isHolding = false
    this.player.handleHoldEnd()
  }

  public show(): void {
    this.isVisible = true
    this.root.style.display = 'block'
  }

  public hide(): void {
    this.isVisible = false
    this.root.style.display = 'none'
    this.reset()
  }
}
