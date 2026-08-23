import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { ProceduralModels } from '../rendering/ProceduralModels'
import { physicsWorld, COLLISION_GROUPS } from '../physics/PhysicsWorld'
import { BALANCE } from '../config/Balance'
import { eventBus } from '../core/EventBus'
import { audioManager } from '../audio/AudioManager'

export class Player {
  public mesh: THREE.Group
  public body!: RAPIER.RigidBody
  public position = new THREE.Vector3(0, 0, 0)
  public heading = 0 // angle in radians

  public hp: number = BALANCE.player.maxHp
  public maxHp: number = BALANCE.player.maxHp
  public cash = 0
  public comboMultiplier = 1.0
  public comboCount = 0
  public comboTimer = 0

  public isDashing = false
  private dashTimer = 0
  private dashCooldown = 0
  private dashVelocity = new THREE.Vector3()

  public isKicking = false
  public kickChargeTime = 0
  public isChargingKick = false
  private kickCooldown = 0

  public heldWeapon: 'bat' | 'hammer' | 'pipe' | null = null
  public weaponDurability = 0

  constructor(scene: THREE.Scene) {
    this.mesh = ProceduralModels.createCharacterRig('player')
    scene.add(this.mesh)
    this.createPhysicsBody()
  }

  private createPhysicsBody(): void {
    if (!physicsWorld.isReady) return
    const R = physicsWorld.RAPIER
    const bodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(0, 1.0, 0)
      .lockRotations()
      .setLinearDamping(4.0)

    this.body = physicsWorld.world.createRigidBody(bodyDesc)
    const colliderDesc = R.ColliderDesc.capsule(0.5, 0.35)
      .setCollisionGroups(COLLISION_GROUPS.PLAYER)
      .setFriction(0.2)
    physicsWorld.world.createCollider(colliderDesc, this.body)
  }

  public reset(x = 0, z = 0): void {
    this.hp = this.maxHp
    this.comboMultiplier = 1.0
    this.comboCount = 0
    this.comboTimer = 0
    this.isDashing = false
    this.isKicking = false
    this.isChargingKick = false
    this.heldWeapon = null
    this.weaponDurability = 0

    if (this.body) {
      this.body.setTranslation({ x, y: 1.0, z }, true)
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
    this.position.set(x, 1.0, z)
    this.mesh.position.copy(this.position)

    eventBus.emit('HP_CHANGED', this.hp, this.maxHp)
    eventBus.emit('CASH_CHANGED', this.cash)
    eventBus.emit('COMBO_CHANGED', this.comboMultiplier, this.comboCount)
  }

  public update(dt: number, moveX: number, moveY: number): void {
    if (!this.body) return

    // Sync position from Rapier
    const t = this.body.translation()
    this.position.set(t.x, t.y, t.z)

    // Dash timer
    if (this.isDashing) {
      this.dashTimer -= dt
      if (this.dashTimer <= 0) {
        this.isDashing = false
      }
    }
    if (this.dashCooldown > 0) {
      this.dashCooldown -= dt
    }
    if (this.kickCooldown > 0) {
      this.kickCooldown -= dt
    }

    // Combo decay
    if (this.comboCount > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) {
        this.comboCount = 0
        this.comboMultiplier = 1.0
        eventBus.emit('COMBO_CHANGED', this.comboMultiplier, this.comboCount)
      }
    }

    // Movement calculation
    if (!this.isDashing && !this.isKicking) {
      const moveLen = Math.hypot(moveX, moveY)
      if (moveLen > 0.05) {
        // Calculate angle
        this.heading = Math.atan2(moveX, moveY)

        const speed = BALANCE.player.moveSpeed
        const vx = (moveX / moveLen) * speed
        const vz = (moveY / moveLen) * speed

        const currentVel = this.body.linvel()
        this.body.setLinvel({ x: vx, y: currentVel.y, z: vz }, true)

        // Limb swing animation
        const walkAnim = Math.sin(performance.now() * 0.012) * 0.4
        const leftLeg = this.mesh.getObjectByName('leftLeg')
        const rightLeg = this.mesh.getObjectByName('rightLeg')
        const leftArm = this.mesh.getObjectByName('leftArm')
        const rightArm = this.mesh.getObjectByName('rightArm')
        if (leftLeg) leftLeg.rotation.x = walkAnim
        if (rightLeg) rightLeg.rotation.x = -walkAnim
        if (leftArm) leftArm.rotation.x = -walkAnim
        if (rightArm) rightArm.rotation.x = walkAnim
      } else {
        const currentVel = this.body.linvel()
        this.body.setLinvel({ x: currentVel.x * 0.8, y: currentVel.y, z: currentVel.z * 0.8 }, true)
      }
    }

    // Mesh transform sync
    this.mesh.position.set(this.position.x, this.position.y - 0.9, this.position.z)
    this.mesh.rotation.y = this.heading
  }

  public dash(dirX: number, dirY: number): void {
    if (this.dashCooldown > 0 || this.isDashing || !this.body) return
    this.isDashing = true
    this.dashTimer = BALANCE.player.dashDuration
    this.dashCooldown = BALANCE.player.dashCooldown

    const len = Math.hypot(dirX, dirY) || 1
    const dx = dirX / len
    const dy = dirY / len
    const dashSpeed = BALANCE.player.dashSpeed

    this.body.setLinvel({ x: dx * dashSpeed, y: 1.0, z: dy * dashSpeed }, true)
    audioManager.play('dash')
  }

  public startChargingKick(): void {
    if (this.kickCooldown > 0 || this.isKicking) return
    this.isChargingKick = true
    this.kickChargeTime = 0
  }

  public releaseKick(holdDuration: number): { isCharged: boolean; impulse: number; reach: number } | null {
    if (this.kickCooldown > 0 || this.isKicking) return null
    this.isChargingKick = false
    this.isKicking = true
    this.kickCooldown = BALANCE.spartan_launch_kick.recoveryDuration

    const isCharged = holdDuration >= BALANCE.spartan_launch_kick.chargeTimeThreshold
    const impulse = isCharged
      ? BALANCE.spartan_launch_kick.baseLaunchImpulse * BALANCE.spartan_launch_kick.chargedImpulseMultiplier
      : BALANCE.spartan_launch_kick.baseLaunchImpulse
    const reach = BALANCE.spartan_launch_kick.kickRangeReach

    // Kick leg animation
    const rightLeg = this.mesh.getObjectByName('rightLeg')
    if (rightLeg) {
      rightLeg.rotation.x = -Math.PI / 2.2
      setTimeout(() => {
        if (rightLeg) rightLeg.rotation.x = 0
        this.isKicking = false
      }, 180)
    } else {
      setTimeout(() => {
        this.isKicking = false
      }, 180)
    }

    if (isCharged) {
      audioManager.play('charged_kick')
      eventBus.emit('SCREEN_SHAKE', 0.45)
    } else {
      audioManager.play('kick')
      eventBus.emit('SCREEN_SHAKE', 0.25)
    }

    eventBus.emit('HITSTOP_TRIGGERED', BALANCE.spartan_launch_kick.hitstopDuration)
    return { isCharged, impulse, reach }
  }

  public takeDamage(dmg: number): void {
    if (this.isDashing) return // Invulnerable during dash roll
    this.hp = Math.max(0, this.hp - dmg)
    eventBus.emit('HP_CHANGED', this.hp, this.maxHp)
    eventBus.emit('SCREEN_SHAKE', 0.3)

    if (this.hp <= 0) {
      eventBus.emit('GAME_STATE_CHANGED', 'DEFEAT')
    }
  }

  public addCash(amount: number): void {
    this.cash += amount
    eventBus.emit('CASH_CHANGED', this.cash)
    audioManager.play('cash_pickup')
  }

  public registerHit(): void {
    this.comboCount++
    this.comboMultiplier = 1.0 + this.comboCount * (BALANCE.kinetic_body_bowling.comboCashMultiplier - 1.0)
    this.comboTimer = 3.5 // 3.5s to maintain combo
    eventBus.emit('COMBO_CHANGED', this.comboMultiplier, this.comboCount)
  }
}
