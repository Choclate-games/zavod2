import type { DeviceKind } from '../platform/PlaygamaService'
import type { EventBus } from '../core/EventBus'

export type InputScheme = 'desktop' | 'touch'
export type TouchLayerMount = (scheme: InputScheme) => void

function readForcedScheme(): InputScheme | null {
  const value = new URLSearchParams(window.location.search).get('input')
  if (value === 'touch' || value === 'desktop') return value
  return null
}

/**
 * Единственный слушатель сырого ввода в проекте. Игровые системы читают
 * семантические события шины и не подписываются на keydown/pointerdown сами.
 * Активную схему выбирает тип устройства с площадки; ?input= принудительно
 * фиксирует схему для проверки обеих раскладок на одной машине.
 */
export class InputRouter {
  scheme: InputScheme
  private readonly forced: InputScheme | null
  private orbitHeld = false
  private spaceHeld = false
  private aiming = false
  private pinchStartDist = 0
  private lastTapTime = 0
  private readonly lastTapPos = { x: 0, y: 0 }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly events: EventBus,
    deviceType: DeviceKind,
    private readonly onTouchLayerChanged: TouchLayerMount,
  ) {
    this.forced = readForcedScheme()
    const touchDevice = deviceType === 'mobile' || deviceType === 'tablet'
    this.scheme = this.forced ?? (touchDevice ? 'touch' : 'desktop')
    this.applyScheme()
  }

  private applyScheme(): void {
    this.releaseAll()
    this.onTouchLayerChanged(this.scheme)
    if (this.scheme === 'desktop') {
      window.addEventListener('keydown', this.onKeyDown)
      window.addEventListener('keyup', this.onKeyUp)
      this.canvas.addEventListener('pointerdown', this.onDesktopPointerDown)
      window.addEventListener('pointermove', this.onDesktopPointerMove)
      window.addEventListener('pointerup', this.onDesktopPointerUp)
      this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    } else {
      window.removeEventListener('keydown', this.onKeyDown)
      window.removeEventListener('keyup', this.onKeyUp)
      this.canvas.removeEventListener('pointerdown', this.onDesktopPointerDown)
      window.removeEventListener('pointermove', this.onDesktopPointerMove)
      window.removeEventListener('pointerup', this.onDesktopPointerUp)
      this.canvas.removeEventListener('wheel', this.onWheel)
    }
  }

  /** Смена режима на лету: сначала отпускаем всё зажатое. */
  switchTo(scheme: InputScheme): void {
    if (this.forced || this.scheme === scheme) return
    this.scheme = scheme
    this.applyScheme()
  }

  releaseAll(): void {
    this.orbitHeld = false
    this.spaceHeld = false
    this.aiming = false
    this.pinchStartDist = 0
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.switchTo('desktop')
    switch (event.code) {
      case 'Space':
        this.spaceHeld = true
        break
      case 'KeyR':
        this.events.emit('act:restart', {})
        break
      case 'KeyC':
        this.events.emit('act:view', {})
        break
      case 'Escape':
      case 'KeyP':
        this.events.emit('act:pause', {})
        break
      default:
        break
    }
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space') this.spaceHeld = false
  }

  private onDesktopPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') {
      this.switchTo('touch')
      return
    }
    const wantOrbit = event.button === 2 || event.button === 1 || this.spaceHeld
    if (wantOrbit) {
      this.orbitHeld = true
      return
    }
    if (event.button === 0 && event.target === this.canvas) {
      this.aiming = true
      this.events.emit('aim:start', { x: event.clientX, y: event.clientY })
    }
  }

  private onDesktopPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return
    if (this.orbitHeld) {
      this.events.emit('cam:orbit', { dx: event.movementX, dy: event.movementY, zoom: 0 })
      return
    }
    if (this.aiming) {
      this.events.emit('aim:move', { x: event.clientX, y: event.clientY })
    }
  }

  private onDesktopPointerUp = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return
    this.orbitHeld = false
    if (this.aiming) {
      this.aiming = false
      this.events.emit('aim:end', { x: event.clientX, y: event.clientY })
    }
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    this.events.emit('cam:orbit', { dx: 0, dy: 0, zoom: event.deltaY > 0 ? 1.1 : 0.9 })
  }

  // ── экранная схема: слой тач-управления шлёт семантику сюда ─────────────

  touchAimStart(x: number, y: number): void {
    const now = performance.now()
    const nearLast = Math.hypot(x - this.lastTapPos.x, y - this.lastTapPos.y) < 48
    if (nearLast && now - this.lastTapTime < 350) {
      this.lastTapTime = 0
      this.events.emit('charge:request', { x, y })
      return
    }
    this.lastTapTime = now
    this.lastTapPos.x = x
    this.lastTapPos.y = y
    this.aiming = true
    this.events.emit('aim:start', { x, y })
  }

  touchAimMove(x: number, y: number): void {
    if (!this.aiming) return
    this.events.emit('aim:move', { x, y })
  }

  touchAimEnd(): void {
    if (!this.aiming) return
    this.aiming = false
    this.events.emit('aim:end', { x: -1, y: -1 })
  }

  touchOrbit(dx: number, dy: number): void {
    this.events.emit('cam:orbit', { dx, dy, zoom: 0 })
  }

  touchPinch(dist: number): void {
    if (this.pinchStartDist <= 0) {
      this.pinchStartDist = dist
      return
    }
    const factor = this.pinchStartDist / Math.max(20, dist)
    this.pinchStartDist = dist
    this.events.emit('cam:orbit', { dx: 0, dy: 0, zoom: factor })
  }

  touchPinchEnd(): void {
    this.pinchStartDist = 0
  }
}
