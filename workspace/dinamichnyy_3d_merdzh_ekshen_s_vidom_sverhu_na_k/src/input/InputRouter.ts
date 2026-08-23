import { EventBus } from '../core/EventBus'

export type InputMode = 'touch' | 'desktop'

export class InputRouter {
  mode: InputMode
  private readonly canvas: HTMLCanvasElement
  private forced: boolean

  constructor(private readonly bus: EventBus, canvas: HTMLCanvasElement, deviceType: 'mobile' | 'tablet' | 'desktop') {
    this.canvas = canvas
    const query = new URLSearchParams(location.search).get('input')
    this.forced = query === 'touch' || query === 'desktop'
    this.mode = query === 'touch' || (query !== 'desktop' && deviceType !== 'desktop') ? 'touch' : 'desktop'
    canvas.addEventListener('pointerdown', this.pointerDown)
    canvas.addEventListener('pointermove', this.pointerMove)
    canvas.addEventListener('pointerup', this.pointerUp)
    canvas.addEventListener('pointercancel', this.pointerUp)
    if (this.mode === 'desktop') {
      window.addEventListener('keydown', this.keyDown)
      window.addEventListener('keyup', this.keyUp)
      canvas.addEventListener('pointerdown', this.desktopPointerLock)
    }
    window.addEventListener('blur', this.reset)
    document.addEventListener('visibilitychange', this.reset)
    document.addEventListener('contextmenu', this.blockBrowserGesture, { passive: false })
    document.addEventListener('dragstart', this.blockBrowserGesture, { passive: false })
    document.addEventListener('touchmove', this.blockBrowserGesture, { passive: false })
  }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (event.button === 2) {
      event.preventDefault()
      this.bus.emit('input:chomp', undefined)
      return
    }
    if (!this.forced && event.pointerType === 'touch') this.switchMode('touch')
    this.canvas.setPointerCapture(event.pointerId)
    this.bus.emit('input:pointer-down', { x: event.clientX, y: event.clientY, pointerId: event.pointerId, pointerType: event.pointerType })
  }

  private readonly pointerMove = (event: PointerEvent): void => {
    if (!this.forced && event.pointerType === 'mouse' && (event.movementX !== 0 || event.movementY !== 0)) this.switchMode('desktop')
    this.bus.emit('input:pointer-move', { x: event.clientX, y: event.clientY, pointerId: event.pointerId })
  }

  private readonly pointerUp = (event: PointerEvent): void => {
    this.bus.emit('input:pointer-up', { x: event.clientX, y: event.clientY, pointerId: event.pointerId })
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
  }

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space') { event.preventDefault(); this.bus.emit('input:chomp', undefined) }
    if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); this.bus.emit('input:pause', undefined) }
    if (event.code === 'KeyR') this.bus.emit('input:restart', undefined)
  }

  private readonly keyUp = (_event: KeyboardEvent): void => {}

  private readonly desktopPointerLock = (): void => {
    if (this.mode === 'desktop' && document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock()
  }

  private readonly reset = (): void => {
    this.bus.emit('input:pointer-up', { x: 0, y: 0, pointerId: -1 })
  }

  private readonly blockBrowserGesture = (event: Event): void => {
    if (event.type !== 'touchmove' || (event instanceof TouchEvent && event.touches.length > 1)) event.preventDefault()
  }

  private switchMode(next: InputMode): void {
    if (this.mode === next) return
    this.bus.emit('input:pointer-up', { x: 0, y: 0, pointerId: -1 })
    this.mode = next
    if (next === 'desktop') {
      window.addEventListener('keydown', this.keyDown)
      window.addEventListener('keyup', this.keyUp)
      this.canvas.addEventListener('pointerdown', this.desktopPointerLock)
    } else {
      window.removeEventListener('keydown', this.keyDown)
      window.removeEventListener('keyup', this.keyUp)
      this.canvas.removeEventListener('pointerdown', this.desktopPointerLock)
    }
  }
}
