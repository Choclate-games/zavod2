import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { ProceduralModels } from '../rendering/ProceduralModels'
import { physicsWorld, COLLISION_GROUPS } from '../physics/PhysicsWorld'
import { BALANCE } from '../config/Balance'
import { particleSystem } from '../rendering/ParticleSystem'
import { audioManager } from '../audio/AudioManager'
import { eventBus } from '../core/EventBus'

export type EnemyType = 'hooligan' | 'heavy' | 'flanker' | 'boss'
export type EnemyState = 'ALIVE' | 'FLYING_RAGDOLL' | 'STUNNED' | 'DEAD'

export class Enemy {
  public mesh: THREE.Group
  public body!: RAPIER.RigidBody
  public type: EnemyType
  public state: EnemyState = 'ALIVE'

  public hp: number
  public maxHp: number
  public mass: number
  public speed: number
  public damage: number
  public bounty: number

  private stunTimer = 0
  private attackCooldown = 0
  public active = true

  constructor(scene: THREE.Scene, type: EnemyType, spawnX: number, spawnZ: number) {
    this.type = type
    const cfg =
      type === 'boss'
        ? BALANCE.enemies.boss
        : type === 'heavy'
        ? BALANCE.enemies.heavy
        : type === 'flanker'
        ? BALANCE.enemies.flanker
        : BALANCE.enemies.hooligan

    this.hp = cfg.hp
    this.maxHp = cfg.hp
    this.mass = cfg.mass
    this.speed = cfg.speed
    this.damage = cfg.damage
    this.bounty = cfg.bounty

    this.mesh = ProceduralModels.createCharacterRig(type === 'flanker' ? 'hooligan' : type)
    scene.add(this.mesh)

    this.createPhysicsBody(spawnX, spawnZ)
  }

  private createPhysicsBody(x: number, z: number): void {
    if (!physicsWorld.isReady) return
    const R = physicsWorld.RAPIER
    const scale = this.type === 'boss' ? 1.6 : this.type === 'heavy' ? 1.25 : 1.0

    const bodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(x, 1.0 * scale, z)
      .setLinearDamping(1.5)
      .setAngularDamping(2.0)
      .setAdditionalMass(this.mass / 100)

    this.body = physicsWorld.world.createRigidBody(bodyDesc)
    const colliderDesc = R.ColliderDesc.capsule(0.5 * scale, 0.35 * scale)
      .setCollisionGroups(COLLISION_GROUPS.ENEMY)
      .setFriction(0.4)
      .setRestitution(0.3)

    physicsWorld.world.createCollider(colliderDesc, this.body)
  }

  public launchRagdoll(impulseX: number, impulseY: number, impulseZ: number): void {
    this.state = 'FLYING_RAGDOLL'
    if (this.body) {
      this.body.setLinvel({ x: impulseX, y: impulseY, z: impulseZ }, true)
      this.body.setAngvel(
        {
          x: (Math.random() - 0.5) * 15,
          y: (Math.random() - 0.5) * 10,
          z: (Math.random() - 0.5) * 15,
        },
        true,
      )
    }

    const t = this.body.translation()
    particleSystem.emitSparks(new THREE.Vector3(t.x, t.y, t.z), 16, 0xff6b00)
  }

  public hitWallSplat(): void {
    if (this.state !== 'FLYING_RAGDOLL') return
    this.hp -= BALANCE.wall_splat_destruction.wallSplatBonusDmg
    audioManager.play('ricochet')
    eventBus.emit('SCREEN_SHAKE', 0.35)

    const t = this.body.translation()
    particleSystem.emitSparks(new THREE.Vector3(t.x, t.y, t.z), 20, 0x00f0ff)

    if (this.hp <= 0) {
      this.die()
    } else {
      this.state = 'STUNNED'
      this.stunTimer = BALANCE.kinetic_body_bowling.knockdownStunDuration
    }
  }

  public takeDamage(amount: number): void {
    this.hp -= amount
    if (this.hp <= 0) {
      this.die()
    }
  }

  public die(): void {
    if (this.state === 'DEAD') return
    this.state = 'DEAD'
    this.active = false
    audioManager.play('ricochet')

    const t = this.body ? this.body.translation() : { x: 0, y: 0, z: 0 }
    particleSystem.emitSparks(new THREE.Vector3(t.x, t.y, t.z), 24, 0xffd700)
  }

  public update(dt: number, playerPos: THREE.Vector3, onAttackPlayer: (dmg: number) => void): void {
    if (!this.body || !this.active) return

    const t = this.body.translation()
    const currentVel = this.body.linvel()
    const speedSq = currentVel.x * currentVel.x + currentVel.z * currentVel.z

    if (this.state === 'FLYING_RAGDOLL') {
      // Check if settled to ground
      if (t.y <= 0.6 && speedSq < BALANCE.kinetic_body_bowling.minLethalSpeed * BALANCE.kinetic_body_bowling.minLethalSpeed) {
        if (this.hp <= 0) {
          this.die()
        } else {
          this.state = 'STUNNED'
          this.stunTimer = BALANCE.kinetic_body_bowling.knockdownStunDuration
        }
      }

      // Check arena wall collision (boundary is radius 12m)
      const distFromCenter = Math.hypot(t.x, t.z)
      if (distFromCenter >= 11.2) {
        this.hitWallSplat()
      }
    } else if (this.state === 'STUNNED') {
      this.stunTimer -= dt
      if (this.stunTimer <= 0) {
        this.state = 'ALIVE'
        // Reset rotation to standing upright
        this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      }
    } else if (this.state === 'ALIVE') {
      // AI movement towards player
      const dx = playerPos.x - t.x
      const dz = playerPos.z - t.z
      const dist = Math.hypot(dx, dz)

      if (dist > 1.2) {
        const nx = dx / dist
        const nz = dz / dist
        this.body.setLinvel({ x: nx * this.speed, y: currentVel.y, z: nz * this.speed }, true)

        const heading = Math.atan2(nx, nz)
        this.mesh.rotation.y = heading
      } else {
        // In melee range: attack player
        this.attackCooldown -= dt
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 1.0
          onAttackPlayer(this.damage)
        }
      }
    }

    // Sync mesh transform
    this.mesh.position.set(t.x, t.y - (this.type === 'boss' ? 1.4 : 0.8), t.z)
    const rot = this.body.rotation()
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
  }

  public destroy(): void {
    this.active = false
    if (this.body) {
      physicsWorld.removeRigidBody(this.body)
    }
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh)
    }
  }
}
