import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { ProceduralModels } from '../rendering/ProceduralModels'
import { physicsWorld, COLLISION_GROUPS } from '../physics/PhysicsWorld'
import { BALANCE } from '../config/Balance'
import { particleSystem } from '../rendering/ParticleSystem'
import { audioManager } from '../audio/AudioManager'
import { eventBus } from '../core/EventBus'

export type PropType = 'crate' | 'barrel'

export class Prop {
  public mesh: THREE.Mesh
  public body!: RAPIER.RigidBody
  public type: PropType
  public hp = 100
  public active = true

  constructor(scene: THREE.Scene, type: PropType, x: number, z: number) {
    this.type = type
    if (type === 'crate') {
      this.mesh = ProceduralModels.createCrateMesh()
    } else {
      this.mesh = ProceduralModels.createBarrelMesh()
    }
    scene.add(this.mesh)
    this.createPhysicsBody(x, z)
  }

  private createPhysicsBody(x: number, z: number): void {
    if (!physicsWorld.isReady) return
    const R = physicsWorld.RAPIER

    const bodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(x, this.type === 'crate' ? 0.5 : 0.6, z)
      .setLinearDamping(2.0)
      .setAngularDamping(2.5)

    this.body = physicsWorld.world.createRigidBody(bodyDesc)

    const colliderDesc =
      this.type === 'crate'
        ? R.ColliderDesc.cuboid(0.5, 0.5, 0.5)
        : R.ColliderDesc.cylinder(0.6, 0.45)

    colliderDesc.setCollisionGroups(COLLISION_GROUPS.PROP)
      .setFriction(0.5)
      .setRestitution(0.2)

    physicsWorld.world.createCollider(colliderDesc, this.body)
  }

  public takeImpact(force: number, onExplodeArea?: (origin: THREE.Vector3, radius: number, dmg: number) => void): void {
    if (!this.active || !this.body) return

    if (force >= BALANCE.wall_splat_destruction.destructibleForceThreshold || force >= 300) {
      this.hp -= 50
    }

    if (this.hp <= 0) {
      this.destroyProp(onExplodeArea)
    }
  }

  public destroyProp(onExplodeArea?: (origin: THREE.Vector3, radius: number, dmg: number) => void): void {
    if (!this.active) return
    this.active = false

    const t = this.body ? this.body.translation() : { x: 0, y: 0, z: 0 }
    const origin = new THREE.Vector3(t.x, t.y, t.z)

    if (this.type === 'crate') {
      audioManager.play('wood_break')
      particleSystem.emitDebris(origin, BALANCE.wall_splat_destruction.shrapnelFragmentCount * 3)
      eventBus.emit('SCREEN_SHAKE', 0.2)
    } else {
      // Barrel explosion
      audioManager.play('barrel_explode')
      particleSystem.emitSparks(origin, 32, 0xff6b00)
      eventBus.emit('SCREEN_SHAKE', 0.5)
      if (onExplodeArea) {
        onExplodeArea(origin, BALANCE.prop_tactical_hurdle.explosiveBarrelRadius, BALANCE.prop_tactical_hurdle.barrelExplosionDamage)
      }
    }

    if (this.body) {
      physicsWorld.removeRigidBody(this.body)
    }
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh)
    }
  }

  public update(): void {
    if (!this.body || !this.active) return
    const t = this.body.translation()
    const r = this.body.rotation()
    this.mesh.position.set(t.x, t.y, t.z)
    this.mesh.quaternion.set(r.x, r.y, r.z, r.w)
  }
}
