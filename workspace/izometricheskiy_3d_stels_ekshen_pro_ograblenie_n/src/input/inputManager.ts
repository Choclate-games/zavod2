import * as THREE from 'three'
import { bus } from '../core/events.js'

/**
 * Десктопная схема: клавиатура + мышь. Все игровые системы слушают ввод только
 * через этот менеджер — прямых keydown в геймплее нет. Активность клавиатуры
 * переводит игру в десктопную схему (планшет с клавиатурой и т.п.).
 */

export interface InputCallbacks {
  onLungeWorld: (dirX: number, dirZ: number) => void
  onParry: () => void
  onKickOrBlendPress: () => void
  onDash: () => void
  onConfettiAimed: (x: number | null, z: number | null) => void
  onConfettiSelf: () => void
  onPauseToggle: () => void
}

export class DesktopInput {
  private readonly keys = new Set<string>()
  private readonly ndc = new THREE.Vector2(0, 0)
  private readonly groundPoint = new THREE.Vector3()
  private active = false

  constructor(
    private readonly canvasHost: HTMLElement,
    private readonly camera: THREE.OrthographicCamera,
    private readonly cb: InputCallbacks,
  ) {
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('pointermove', this.handlePointerMove)
    window.addEventListener('pointerdown', this.handlePointerDown)
    window.addEventListener('contextmenu', this.handleContextMenu)
    window.addEventListener('blur', () => this.keys.clear())
  }

  setActive(active: boolean): void {
    if (active === this.active) return
    this.active = active
    if (!active) this.keys.clear()
  }

  get isDesktopScheme(): boolean {
    return this.active
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerdown', this.handlePointerDown)
    window.removeEventListener('contextmenu', this.handleContextMenu)
  }

  /** Ось движения из WASD и стрелок. */
  moveAxis(out: { x: number; z: number }): void {
    let x = 0
    let z = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    out.x = x
    out.z = z
  }

  /** Удержание Space — шаг шествия (синхронизация скорости с потоком). */
  get blending(): boolean {
    return this.active && this.keys.has('Space')
  }

  /** Точка курсора на земле — цель выпада и хлопушки. */
  screenToGround(clientX: number, clientY: number, out: THREE.Vector3): boolean {
    const rect = this.canvasHost.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    const nx = ((clientX - rect.left) / width) * 2 - 1
    const ny = -(((clientY - rect.top) / height) * 2 - 1)
    // Ортокамера: луч строится из позиции камеры через плоскость NDC.
    const origin = new THREE.Vector3(nx, ny, 0).unproject(this.camera)
    const dir = origin.clone().sub(this.camera.position).normalize()
    if (Math.abs(dir.y) < 1e-5) return false
    const t = -origin.y / dir.y
    if (t <= 0) return false
    out.copy(origin).addScaledVector(dir, t)
    return true
  }

  private markDesktopActivity(): void {
    if (!this.active) {
      this.active = true
      bus.emit('scheme:changed', 'desktop')
    }
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return
    this.markDesktopActivity()
    this.keys.add(event.code)
    switch (event.code) {
      case 'Escape':
        this.cb.onPauseToggle()
        break
      case 'Space':
        this.cb.onKickOrBlendPress()
        break
      case 'KeyE':
        if (this.screenToGround(this.ndc.x, this.ndc.y, this.groundPoint)) {
          this.cb.onConfettiAimed(this.groundPoint.x, this.groundPoint.z)
        } else {
          this.cb.onConfettiAimed(null, null)
        }
        break
      case 'KeyQ':
        this.cb.onConfettiSelf()
        break
      case 'ShiftLeft':
      case 'ShiftRight':
        this.cb.onDash()
        break
      default:
        break
    }
  }

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return
    this.markDesktopActivity()
    this.ndc.set(event.clientX, event.clientY)
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return
    this.markDesktopActivity()
    const target = event.target as HTMLElement | null
    if (target && target.closest('button, [data-action]')) return
    if (event.button === 0) {
      if (this.screenToGround(event.clientX, event.clientY, this.groundPoint)) {
        this.cb.onLungeWorld(this.groundPoint.x, this.groundPoint.z)
      } else {
        this.cb.onLungeWorld(Math.sin(0), Math.cos(0))
      }
    } else if (event.button === 2) {
      this.cb.onParry()
    }
  }

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }
}
