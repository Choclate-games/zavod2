import { events } from '../core/EventBus'
import { CaliberType, ThermalPalette } from '../types'

export class InputManager {
  private static instance: InputManager
  private keysDown: Set<string> = new Set()
  private isMouseFireHeld = false
  private isTouchFireHeld = false
  private aimDelta = { x: 0, y: 0 }
  private currentZoom = 1.0
  private currentPalette: ThermalPalette = 'WHITE_HOT'

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager()
    }
    return InputManager.instance
  }

  public init(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => this.onKeyDown(e))
    window.addEventListener('keyup', (e) => this.onKeyUp(e))

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) {
        this.isMouseFireHeld = true
        events.emit('INPUT_FIRE_START', true)
      }
    })

    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) {
        this.isMouseFireHeld = false
        events.emit('INPUT_FIRE_END', true)
      }
    })

    window.addEventListener('mousemove', (e) => {
      this.aimDelta.x += e.movementX * 0.25
      this.aimDelta.y += e.movementY * 0.25
    })

    window.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.cycleZoom(e.deltaY < 0)
    }, { passive: false })

    // Listen to Touch Controls events
    events.on('TOUCH_AIM_START', () => {})
    events.on('TOUCH_AIM_END', () => {})

    events.on('TOUCH_AIM_DELTA', (data: { dx: number; dy: number }) => {
      this.aimDelta.x += data.dx * 0.35
      this.aimDelta.y += data.dy * 0.35
    })

    events.on('TOUCH_SELECT_CALIBER', (caliber: CaliberType) => {
      events.emit('INPUT_SELECT_CALIBER', caliber)
    })

    events.on('TOUCH_FIRE_START', (caliber: CaliberType) => {
      this.isTouchFireHeld = true
      events.emit('INPUT_SELECT_CALIBER', caliber)
      events.emit('INPUT_FIRE_START', true)
    })

    events.on('TOUCH_FIRE_END', () => {
      this.isTouchFireHeld = false
      events.emit('INPUT_FIRE_END', true)
    })

    events.on('TOUCH_CYCLE_ZOOM', () => {
      this.cycleZoom(true)
    })

    events.on('TOUCH_CYCLE_PALETTE', () => {
      this.togglePalette()
    })
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keysDown.add(e.code)

    if (e.code === 'Digit1') {
      events.emit('INPUT_SELECT_CALIBER', '25mm')
    } else if (e.code === 'Digit2') {
      events.emit('INPUT_SELECT_CALIBER', '40mm')
    } else if (e.code === 'Digit3') {
      events.emit('INPUT_SELECT_CALIBER', '105mm')
    } else if (e.code === 'KeyZ') {
      this.cycleZoom(true)
    } else if (e.code === 'KeyT') {
      this.togglePalette()
    } else if (e.code === 'Space') {
      this.isMouseFireHeld = true
      events.emit('INPUT_FIRE_START', true)
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      events.emit('INPUT_TOGGLE_PAUSE', true)
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.code)
    if (e.code === 'Space') {
      this.isMouseFireHeld = false
      events.emit('INPUT_FIRE_END', true)
    }
  }

  public cycleZoom(zoomIn = true): void {
    if (zoomIn) {
      this.currentZoom = this.currentZoom === 1.0 ? 2.0 : this.currentZoom === 2.0 ? 4.0 : 1.0
    } else {
      this.currentZoom = this.currentZoom === 4.0 ? 2.0 : this.currentZoom === 2.0 ? 1.0 : 4.0
    }
    events.emit('ZOOM_CHANGED', this.currentZoom)
  }

  public togglePalette(): void {
    this.currentPalette = this.currentPalette === 'WHITE_HOT' ? 'BLACK_HOT' : 'WHITE_HOT'
    events.emit('PALETTE_CHANGED', this.currentPalette)
  }

  public consumeAimDelta(): { x: number; y: number } {
    const delta = { x: this.aimDelta.x, y: this.aimDelta.y }
    this.aimDelta.x = 0
    this.aimDelta.y = 0
    return delta
  }

  public isFireHeld(): boolean {
    return this.isMouseFireHeld || this.isTouchFireHeld || this.keysDown.has('Space')
  }

  public reset(): void {
    this.keysDown.clear()
    this.isMouseFireHeld = false
    this.isTouchFireHeld = false
    this.aimDelta = { x: 0, y: 0 }
  }
}

export const input = InputManager.getInstance()
