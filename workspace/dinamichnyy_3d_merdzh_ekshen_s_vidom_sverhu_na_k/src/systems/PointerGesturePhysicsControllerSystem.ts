import { BALANCE } from '../balance'
import { EventBus } from '../core/EventBus'
import type { EntityManager } from '../entities/EntityManager'

type Point = { x: number; z: number }

export class PointerGesturePhysicsControllerSystem {
  private readonly start: Point = { x: 0, z: 0 }
  private readonly current: Point = { x: 0, z: 0 }
  private activePointer = -1
  private dragging = false
  private selectedIndex = -1

  constructor(private readonly bus: EventBus, private readonly entities: EntityManager, private readonly toArena: (x: number, y: number) => Point, private readonly fling: (slot: number, x: number, z: number) => void, private readonly chomp: () => void, private readonly aim: (startX: number, startZ: number, currentX: number, currentZ: number) => void, private readonly clearAim: () => void) {
    bus.on('input:pointer-down', (sample) => this.down(sample.x, sample.y, sample.pointerId))
    bus.on('input:pointer-move', (sample) => this.move(sample.x, sample.y, sample.pointerId))
    bus.on('input:pointer-up', (sample) => this.up(sample.x, sample.y, sample.pointerId))
  }

  private down(x: number, y: number, pointerId: number): void {
    if (this.activePointer !== -1) return
    const point = this.toArena(x, y)
    let best = -1
    let nearest = 2.2
    for (let index = 0; index < this.entities.blobs.length; index += 1) {
      const blob = this.entities.blobs[index]
      if (!blob.active) continue
      const dx = blob.x - point.x
      const dz = blob.z - point.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance < nearest) { nearest = distance; best = index }
    }
    if (best === -1) { this.chomp(); return }
    this.activePointer = pointerId
    this.selectedIndex = best
    this.start.x = point.x
    this.start.z = point.z
    this.current.x = point.x
    this.current.z = point.z
    this.dragging = false
    this.entities.blobs[best].selected = true
    this.aim(this.start.x, this.start.z, this.current.x, this.current.z)
  }

  private move(x: number, y: number, pointerId: number): void {
    if (pointerId !== this.activePointer || this.selectedIndex < 0) return
    const point = this.toArena(x, y)
    this.current.x = point.x
    this.current.z = point.z
    this.aim(this.start.x, this.start.z, this.current.x, this.current.z)
    const dx = this.start.x - point.x
    const dz = this.start.z - point.z
    this.dragging = Math.sqrt(dx * dx + dz * dz) > BALANCE.pointerDeadzone
  }

  private up(x: number, y: number, pointerId: number): void {
    if ((pointerId !== this.activePointer && pointerId !== -1) || this.selectedIndex < 0) return
    const point = this.toArena(x, y)
    const dx = this.start.x - point.x
    const dz = this.start.z - point.z
    this.entities.blobs[this.selectedIndex].selected = false
    if (this.dragging) this.fling(this.entities.blobs[this.selectedIndex].slot, dx, dz)
    else this.chomp()
    this.clearAim()
    this.activePointer = -1
    this.selectedIndex = -1
    this.dragging = false
  }
}
