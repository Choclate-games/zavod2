import RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicsWorld } from '../physics/PhysicsWorld.ts'
import { GROUP_STUNTMAN, GROUP_WORLD, GROUP_DECOR, GROUP_GUEST, GROUP_CABLE, groupOf } from '../physics/PhysicsWorld.ts'
import { BALANCE } from '../config/balance.ts'

interface Part {
  body: RAPIER.RigidBody
  collider: RAPIER.Collider
}

/**
 * Рэгдолл каскадёра: одиннадцать тел, шарнирные суставы с демпфированием.
 * Тела создаются одним проходом и сшиваются вторым — так Rapier не теряет
 * ни один сустав при сборке. CCD включён на всех частях: снаряд быстрый,
 * без CCD он туннелирует сквозь тонкие тросы.
 */
export class Stuntman {
  readonly parts = new Map<string, Part>()
  private joints: RAPIER.ImpulseJoint[] = []
  private spawned = false
  private spawnOrigin = { x: 0, y: 0, z: 0 }

  constructor(
    private readonly physics: PhysicsWorld,
    x: number,
    y: number,
    z: number,
  ) {
    this.spawnOrigin = { x, y, z }
  }

  spawn(x: number, y: number, z: number): void {
    if (this.spawned) return
    this.spawned = true
    const world = this.physics.world
    const filter = groupOf(GROUP_STUNTMAN, GROUP_WORLD | GROUP_DECOR | GROUP_GUEST | GROUP_STUNTMAN | GROUP_CABLE)
    const makePart = (
      name: string,
      hx: number,
      hy: number,
      hz: number,
      px: number,
      py: number,
      pz: number,
      density: number,
    ): Part => {
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(px, py, pz)
        .setLinearDamping(0.05)
        .setAngularDamping(2.0)
        .setCcdEnabled(true)
      const body = world.createRigidBody(desc)
      const collider = world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz).setDensity(density).setCollisionGroups(filter),
        body,
      )
      const part: Part = { body, collider }
      this.parts.set(name, part)
      return part
    }

    // Поза «ласточка»: руки в стороны, тело вытянуто вдоль полёта (+Z).
    const half = 0.18
    makePart('pelvis', half, 0.12, 0.12, x, y, z, 1200)
    makePart('torso', half, 0.22, 0.13, x, y + 0.34, z, 1400)
    makePart('head', 0.11, 0.12, 0.11, x, y + 0.78, z, 1100)
    makePart('armUpperL', 0.07, 0.16, 0.07, x - 0.32, y + 0.5, z, 500)
    makePart('armUpperR', 0.07, 0.16, 0.07, x + 0.32, y + 0.5, z, 500)
    makePart('armLowerL', 0.06, 0.15, 0.06, x - 0.62, y + 0.5, z, 400)
    makePart('armLowerR', 0.06, 0.15, 0.06, x + 0.62, y + 0.5, z, 400)
    makePart('thighL', 0.08, 0.19, 0.09, x - 0.1, y - 0.36, z, 700)
    makePart('thighR', 0.08, 0.19, 0.09, x + 0.1, y - 0.36, z, 700)
    makePart('shinL', 0.07, 0.18, 0.08, x - 0.1, y - 0.76, z, 550)
    makePart('shinR', 0.07, 0.18, 0.08, x + 0.1, y - 0.76, z, 550)

    const link = (a: string, b: string, ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => {
      const pa = this.parts.get(a)?.body
      const pb = this.parts.get(b)?.body
      if (!pa || !pb) return
      const params = RAPIER.JointData.spherical({ x: ax, y: ay, z: az }, { x: bx, y: by, z: bz })
      const joint = world.createImpulseJoint(params, pa, pb, true)
      if (joint) this.joints.push(joint)
    }

    link('torso', 'pelvis', 0, -0.24, 0, 0, 0.14, 0)
    link('head', 'torso', 0, -0.14, 0, 0, 0.22, 0)
    link('armUpperL', 'torso', 0.1, 0.14, 0, -0.1, -0.02, 0)
    link('armUpperR', 'torso', -0.1, 0.14, 0, 0.1, -0.02, 0)
    link('armLowerL', 'armUpperL', 0, -0.14, 0, 0, 0.14, 0)
    link('armLowerR', 'armUpperR', 0, -0.14, 0, 0, 0.14, 0)
    link('thighL', 'pelvis', 0, 0.17, 0, -0.1, -0.1, 0)
    link('thighR', 'pelvis', 0, 0.17, 0, 0.1, -0.1, 0)
    link('shinL', 'thighL', 0, -0.17, 0, 0, 0.17, 0)
    link('shinR', 'thighR', 0, -0.17, 0, 0, 0.17, 0)

    // Общая масса ≈ BALANCE.launch.stuntmanMassKg достигается плотностями;
    // проверка суммы масс живёт в StructuralDestructionSystem.
  }

  torso(): RAPIER.RigidBody | null {
    return this.parts.get('torso')?.body ?? null
  }

  velocity(): Vec3Like {
    const v = this.torso()?.linvel()
    return { x: v?.x ?? 0, y: v?.y ?? 0, z: v?.z ?? 0 }
  }

  speed(): number {
    const v = this.velocity()
    return Math.hypot(v.x, v.y, v.z)
  }

  center(): Vec3Like {
    const p = this.torso()?.translation()
    return { x: p?.x ?? 0, y: p?.y ?? 0, z: p?.z ?? 0 }
  }

  /** Импульс катапульты: V = V_base * pull^exp, направление задаёт прицел. */
  launch(dirX: number, dirY: number, dirZ: number, pullFraction: number): number {
    const v =
      BALANCE.sling.baseLaunchVelocity * Math.pow(Math.min(1, Math.max(0, pullFraction)), BALANCE.sling.tensionExponent)
    this.setGravityScale(1)
    for (const part of this.parts.values()) {
      part.body.setLinvel({ x: dirX * v, y: dirY * v, z: dirZ * v }, true)
    }
    // Крутящий момент тела от асимметрии хвата: лёгкий винт корпуса.
    const torque = 6 * pullFraction
    this.parts.get('torso')?.body.applyTorqueImpulse({ x: 0, y: torque, z: 0 }, true)
    return v
  }

  /** До выстрела рэгдолл ждёт в ложе катапульты без гравитации. */
  holdAtCatapult(): void {
    this.setGravityScale(0)
    for (const part of this.parts.values()) {
      part.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      part.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
  }

  private setGravityScale(scale: number): void {
    for (const part of this.parts.values()) {
      part.body.setGravityScale(scale, true)
    }
  }

  /** Мгновенный рестарт: телепорт тел в исходную позу вместо пересборки мира. */
  resetToPose(): void {
    const base = this.spawnOrigin
    const offsets: Record<string, [number, number, number]> = {
      pelvis: [0, 0, 0],
      torso: [0, 0.34, 0],
      head: [0, 0.78, 0],
      armUpperL: [-0.32, 0.5, 0],
      armUpperR: [0.32, 0.5, 0],
      armLowerL: [-0.62, 0.5, 0],
      armLowerR: [0.62, 0.5, 0],
      thighL: [-0.1, -0.36, 0],
      thighR: [0.1, -0.36, 0],
      shinL: [-0.1, -0.76, 0],
      shinR: [0.1, -0.76, 0],
    }
    for (const [name, part] of this.parts.entries()) {
      const offset = offsets[name]
      if (!offset) continue
      part.body.setTranslation({ x: base.x + offset[0], y: base.y + offset[1], z: base.z + offset[2] }, true)
      part.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      part.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      part.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
    this.holdAtCatapult()
  }

  /** Аварийный толчок Stunt Kick / доворот в Slow-Mo. */
  kick(strength: number): void {
    const t = this.torso()
    if (!t) return
    const v = t.linvel()
    t.setLinvel({ x: v.x * 0.9, y: v.y + strength * 0.4, z: v.z * 0.9 + strength }, true)
  }

  dispose(): void {
    for (const joint of this.joints) {
      this.physics.world.removeImpulseJoint(joint, true)
    }
    this.joints.length = 0
    for (const part of this.parts.values()) {
      this.physics.disposeBody(part.body)
    }
    this.parts.clear()
    this.spawned = false
  }
}

export interface Vec3Like {
  x: number
  y: number
  z: number
}
