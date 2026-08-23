import RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicsWorld } from '../physics/PhysicsWorld.ts'
import { GROUP_CABLE, GROUP_DECOR, GROUP_GUEST, GROUP_STUNTMAN, GROUP_WORLD, groupOf } from '../physics/PhysicsWorld.ts'
import { BALANCE } from '../config/balance.ts'

export interface Chandelier {
  body: RAPIER.RigidBody
  cableCollider: RAPIER.Collider
  joint: RAPIER.ImpulseJoint | null
  anchor: { x: number; y: number; z: number }
  snapped: boolean
}

export interface GlassItem {
  body: RAPIER.RigidBody
  broken: boolean
}

export interface TableItem {
  body: RAPIER.RigidBody
  toppled: boolean
}

export type GuestState = 'calm' | 'fleeing' | 'ragdoll' | 'counted'

export interface GuestItem {
  body: RAPIER.RigidBody
  state: GuestState
  homeX: number
  homeZ: number
  wanderPhase: number
}

export interface CakeTier {
  body: RAPIER.RigidBody
  smashed: boolean
}

/**
 * Банкетный зал: статичный мир (пол, стены, колонны), люстры на разрывных
 * подвесах, пятиъярусный торт, пирамиды бокалов, VIP-столы и массовка.
 * Рестарт уровня телепортирует тела в исходное состояние вместо пересборки мира.
 */
export class BanquetHall {
  readonly chandeliers: Chandelier[] = []
  readonly glasses: GlassItem[] = []
  readonly tables: TableItem[] = []
  readonly guests: GuestItem[] = []
  readonly tiers: CakeTier[] = []

  private readonly staticBodies: RAPIER.RigidBody[] = []
  private readonly savedTransforms: Array<{
    body: RAPIER.RigidBody
    t: { x: number; y: number; z: number }
    r: RAPIER.Quaternion
  }> = []

  constructor(private readonly physics: PhysicsWorld) {}

  private addStatic(hx: number, hy: number, hz: number, x: number, y: number, z: number, filter: number): void {
    const world = this.physics.world
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z))
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setCollisionGroups(filter),
      body,
    )
    this.staticBodies.push(body)
  }

  build(): void {
    const world = this.physics.world
    const staticFilter = groupOf(GROUP_WORLD, 0xffff)
    const decorFilter = groupOf(GROUP_DECOR, GROUP_WORLD | GROUP_STUNTMAN | GROUP_DECOR | GROUP_GUEST)
    const guestFilter = groupOf(GROUP_GUEST, GROUP_WORLD | GROUP_STUNTMAN | GROUP_DECOR | GROUP_GUEST)

    // Пол и стены зала.
    this.addStatic(14, 0.5, 20, 0, -0.5, -4, staticFilter)
    this.addStatic(0.5, 6, 20, -14.5, 6, -4, staticFilter)
    this.addStatic(0.5, 6, 20, 14.5, 6, -4, staticFilter)
    this.addStatic(15, 6, 0.5, 0, 6, -24.5, staticFilter)
    this.addStatic(15, 6, 0.5, 0, 6, 16.5, staticFilter)

    // Колонны вдоль зала — препятствия для планирования.
    for (const sx of [-9, 9]) {
      for (const sz of [-16, -8, 2]) {
        this.addStatic(0.7, 6, 0.7, sx, 6, sz, staticFilter)
      }
    }
    // Люстры: тело-подвес на одном фиксированном джойнте к якорю потолка,
    // трос — сенсорный тонкий коллайдер от якоря до корпуса.
    const decorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0))
    this.staticBodies.push(decorBody)
    const chandelierSpots = [
      { x: 0, z: -12 },
      { x: -5, z: -4 },
      { x: 5, z: -4 },
    ]
    for (const spot of chandelierSpots) {
      const anchorY = 10
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spot.x, anchorY - 1.6, spot.z)
        .setLinearDamping(0.1)
        .setAngularDamping(0.6)
      const body = world.createRigidBody(bodyDesc)
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.9, 0.25, 0.9).setDensity(900).setCollisionGroups(decorFilter),
        body,
      )
      const jointParams = RAPIER.JointData.fixed(
        { x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: 0, w: 1 },
        { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 },
      )
      const joint = world.createImpulseJoint(jointParams, decorBody, body, true)
      const cableCollider = world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.06, 0.8, 0.06)
          .setTranslation(spot.x, anchorY - 0.8, spot.z)
          .setSensor(true)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
          .setCollisionGroups(groupOf(GROUP_CABLE, GROUP_STUNTMAN)),
        decorBody,
      )
      const chandelier: Chandelier = {
        body,
        cableCollider,
        joint,
        anchor: { x: spot.x, y: anchorY, z: spot.z },
        snapped: false,
      }
      this.chandeliers.push(chandelier)
      this.savedTransforms.push(snapshot(body))
    }
    // Пятиъярусный торт в центре дальней части зала.
    for (let tier = 0; tier < 5; tier++) {
      const size = 1.5 - tier * 0.24
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 0.45 + tier * 0.62, -18)
        .setAngularDamping(1.5)
      const body = world.createRigidBody(desc)
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(size / 2, 0.31, size / 2).setDensity(350).setFriction(0.9),
        body,
      )
      this.tiers.push({ body, smashed: false })
      this.savedTransforms.push(snapshot(body))
    }

    // Пирамида бокалов шампанского на соседнем столе.
    let glassIndex = 0
    for (let row = 0; row < 5; row++) {
      const count = 9 - row
      for (let i = 0; i < count; i++) {
        if (glassIndex >= 45) break
        const gx = -6 + i * 0.34 + row * 0.17
        const gz = -13.2
        const gy = 1.05 + row * 0.24
        const desc = RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(gx, gy, gz)
          .setAngularDamping(0.4)
          .setLinearDamping(0.2)
        const body = world.createRigidBody(desc)
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.11, 0.11, 0.11).setDensity(120).setFriction(0.8),
          body,
        )
        this.glasses.push({ body, broken: false })
        this.savedTransforms.push(snapshot(body))
        glassIndex++
      }
    }

    // VIP-столы со скатертями.
    const tableSpots = [
      { x: -6, z: -9 },
      { x: 6, z: -9 },
      { x: -6, z: -1 },
      { x: 6, z: -1 },
    ]
    for (const spot of tableSpots) {
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spot.x, 0.95, spot.z)
        .lockRotations()
        .setLinearDamping(2.0)
      const body = world.createRigidBody(desc)
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(1.6, 0.08, 0.9).setDensity(500).setFriction(1.0).setCollisionGroups(decorFilter),
        body,
      )
      this.tables.push({ body, toppled: false })
      this.savedTransforms.push(snapshot(body))
    }

    // Массовка: динамические тела с заблокированным вращением; при ударе
    // вращение разблокируется — гость превращается в физический рэгдолл.
    const maxGuests = Math.min(BALANCE.crowd.maxPanicNpcsPerLevel, 32)
    for (let i = 0; i < maxGuests; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const gx = side * (3 + ((i * 37) % 50) / 10)
      const gz = -17 + ((i * 53) % 140) / 10
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(gx, 0.75, gz)
        .lockRotations()
        .setLinearDamping(3.0)
      const body = world.createRigidBody(desc)
      world.createCollider(
        RAPIER.ColliderDesc.capsule(0.28, 0.22).setDensity(180).setCollisionGroups(guestFilter),
        body,
      )
      this.guests.push({
        body,
        state: 'calm',
        homeX: gx,
        homeZ: gz,
        wanderPhase: i * 1.37,
      })
      this.savedTransforms.push(snapshot(body))
    }
  }

  /** Разрыв троса: удаляем джойнт — дальше честная динамика падающего тела. */
  snapChandelier(index: number): boolean {
    const chandelier = this.chandeliers[index]
    if (!chandelier || chandelier.snapped || chandelier.joint === null) return false
    chandelier.snapped = true
    this.physics.world.removeImpulseJoint(chandelier.joint, true)
    chandelier.joint = null
    return true
  }

  unlockGuestRotation(guest: GuestItem): void {
    guest.body.lockRotations(false, true)
    guest.body.setAngularDamping(0.4)
  }

  /** Рестарт: телепорт всех тел в исходное состояние, сброс флагов. */
  reset(): void {
    for (const item of this.chandeliers) {
      if (item.snapped || item.joint === null) this.rebuildChandelierJoint(item)
    }
    for (const glass of this.glasses) glass.broken = false
    for (const table of this.tables) table.toppled = false
    for (const tier of this.tiers) tier.smashed = false
    for (const guest of this.guests) {
      guest.state = 'calm'
      guest.body.lockRotations(true, true)
      guest.body.setAngularDamping(0)
    }
    for (const item of this.savedTransforms) {
      item.body.setTranslation(item.t, true)
      item.body.setRotation(item.r, true)
      item.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      item.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
  }

  dispose(): void {
    const world = this.physics.world
    for (const chandelier of this.chandeliers) {
      if (chandelier.joint !== null) world.removeImpulseJoint(chandelier.joint, true)
      world.removeRigidBody(chandelier.body)
    }
    this.chandeliers.length = 0
    for (const collection of [this.glasses, this.tables, this.guests]) {
      for (const item of collection) world.removeRigidBody(item.body)
      collection.length = 0
    }
    for (const tier of this.tiers) world.removeRigidBody(tier.body)
    this.tiers.length = 0
    for (const body of this.staticBodies) world.removeRigidBody(body)
    this.staticBodies.length = 0
    this.savedTransforms.length = 0
  }

  private rebuildChandelierJoint(chandelier: Chandelier): void {
    const world = this.physics.world
    const anchorBody = this.staticBodies[0]
    if (!anchorBody) return
    const params = RAPIER.JointData.fixed(
      { x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: 0, w: 1 },
      { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 },
    )
    chandelier.joint = world.createImpulseJoint(params, anchorBody, chandelier.body, true)
    chandelier.snapped = false
  }
}

function snapshot(body: RAPIER.RigidBody): { body: RAPIER.RigidBody; t: { x: number; y: number; z: number }; r: RAPIER.Quaternion } {
  const p = body.translation()
  const r = body.rotation()
  return {
    body,
    t: { x: p.x, y: p.y, z: p.z },
    r: { x: r.x, y: r.y, z: r.z, w: r.w },
  }
}
