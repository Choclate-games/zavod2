import RAPIER from '@dimforge/rapier3d-compat'
import { FIXED_STEP } from '../core/GameLoop'

/**
 * Мир Rapier3D с фиксированным шагом. Группы столкновений заданы с обеих
 * сторон: лучи колёс видят только землю, кузова не проходят друг сквозь друга,
 * сенсоры чекпоинтов пересекаются только с шасси.
 */
export const GROUP_GROUND = 0x0001
export const GROUP_VEHICLE = 0x0002
export const GROUP_SENSOR = 0x0004

export const IG_GROUND = (GROUP_GROUND << 16) | 0xffff
export const IG_CHASSIS = (GROUP_VEHICLE << 16) | (GROUP_GROUND | GROUP_VEHICLE | GROUP_SENSOR)
export const IG_SENSOR = (GROUP_SENSOR << 16) | GROUP_VEHICLE
/** Фильтр лучей подвески: членство колеса, видит только землю. */
export const WHEEL_RAY_GROUPS = (GROUP_VEHICLE << 16) | GROUP_GROUND

export type IntersectionHandler = (a: number, b: number, started: boolean) => void

export class PhysicsWorld {
  readonly world: RAPIER.World
  private readonly queue: RAPIER.EventQueue
  private handlers = new Map<number, IntersectionHandler>()

  static async initEngine(): Promise<void> {
    await RAPIER.init()
  }

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    this.world.timestep = FIXED_STEP
    this.queue = new RAPIER.EventQueue(true)
  }

  registerSensor(handle: number, handler: IntersectionHandler): void {
    this.handlers.set(handle, handler)
  }

  step(): void {
    this.world.step(this.queue)
    this.queue.drainCollisionEvents((a, b, started) => {
      const ha = this.handlers.get(a)
      if (ha) ha(a, b, started)
      const hb = this.handlers.get(b)
      if (hb) hb(a, b, started)
    })
  }
}

export { RAPIER }
