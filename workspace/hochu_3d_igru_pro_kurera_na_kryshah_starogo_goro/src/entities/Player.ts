import * as THREE from 'three'
import { audioManager } from '../audio/AudioManager'
import { BALANCE } from '../core/balance'
import { events } from '../core/EventBus'
import { ParticleSystem } from '../rendering/ParticleSystem'
import { ProceduralModels } from '../rendering/ProceduralModels'
import { FlowComboSystem } from '../systems/FlowComboSystem'
import { ParcelIntegritySystem } from '../systems/ParcelIntegritySystem'
import { RooftopProceduralGeneratorSystem } from '../systems/RooftopProceduralGeneratorSystem'

export type PlayerMovementState =
  | 'RUNNING'
  | 'JUMPING'
  | 'FALLING'
  | 'HOLD_GROUPING'
  | 'PERFECT_ROLL'
  | 'SLIDING'
  | 'LEDGE_CLIMB'
  | 'CABLE_SPRINT'
  | 'FALL_DEATH'

export class Player {
  public meshRoot: THREE.Group
  public position: THREE.Vector3 = new THREE.Vector3(0, 1.0, 0)
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, BALANCE.movement.baseVelocity)
  public state: PlayerMovementState = 'RUNNING'

  private rig: ReturnType<typeof ProceduralModels.buildCourierRig>
  private particleSystem: ParticleSystem
  private generator: RooftopProceduralGeneratorSystem
  private integritySystem: ParcelIntegritySystem
  private flowSystem: FlowComboSystem

  // Kinematic parameters
  private currentSpeed = BALANCE.movement.baseVelocity
  private targetSpeed = BALANCE.movement.baseVelocity
  private isGrounded = true
  private holdTimeInAir = 0
  private slideTimer = 0
  private rollTimer = 0
  private ledgeClimbTimer = 0
  private currentHitboxHeight = 1.85

  // Wind & Cable Balance
  private tiltAngle = 0
  private windForce = 0
  private windTimer = 0

  // Animation cycle
  private animTimer = 0

  constructor(
    scene: THREE.Scene,
    particleSystem: ParticleSystem,
    generator: RooftopProceduralGeneratorSystem,
    integritySystem: ParcelIntegritySystem,
    flowSystem: FlowComboSystem
  ) {
    this.particleSystem = particleSystem
    this.generator = generator
    this.integritySystem = integritySystem
    this.flowSystem = flowSystem

    this.rig = ProceduralModels.buildCourierRig()
    this.meshRoot = this.rig.root
    scene.add(this.meshRoot)

    this.reset()
  }

  public reset(): void {
    this.position.set(0, 1.0, 0)
    this.currentSpeed = BALANCE.movement.baseVelocity
    this.targetSpeed = BALANCE.movement.baseVelocity
    this.velocity.set(0, 0, this.currentSpeed)
    this.state = 'RUNNING'
    this.isGrounded = true
    this.holdTimeInAir = 0
    this.slideTimer = 0
    this.rollTimer = 0
    this.tiltAngle = 0
    this.windForce = 0
    this.currentHitboxHeight = 1.85
    this.meshRoot.position.copy(this.position)
    this.meshRoot.rotation.set(0, 0, 0)
  }

  // --- Input Handlers ---

  public handleJump(): void {
    if (this.state === 'FALL_DEATH') return

    // Check Ledge Grab first
    const ledgeCheck = this.generator.checkLedgeProximity(this.position)
    if (ledgeCheck.nearLedge && !this.isGrounded) {
      this.triggerLedgeVault()
      return
    }

    // Standard Jump or Slide-to-Super-Jump
    if (this.isGrounded || this.state === 'SLIDING') {
      const jumpBoost = this.state === 'SLIDING' ? 1.25 : 1.0
      this.velocity.y = BALANCE.movement.jumpVelocityY * jumpBoost
      this.isGrounded = false
      this.state = 'JUMPING'
      this.holdTimeInAir = 0
      this.currentHitboxHeight = 1.85
      audioManager.playJump()
      this.particleSystem.emitSparks(this.position.x, this.position.y, this.position.z, 6)
    }
  }

  public handleHoldStart(): void {
    if (this.state === 'FALL_DEATH') return
    if (!this.isGrounded) {
      this.state = 'HOLD_GROUPING'
      this.holdTimeInAir = 0.01
    }
  }

  public handleHoldEnd(): void {
    if (this.state === 'HOLD_GROUPING') {
      this.state = 'FALLING'
    }
  }

  public handleSlide(): void {
    if (this.state === 'FALL_DEATH') return
    if (this.isGrounded && this.state !== 'SLIDING') {
      this.state = 'SLIDING'
      this.slideTimer = BALANCE.slateSlide.minSlideDurationSec
      this.currentHitboxHeight = BALANCE.slateSlide.hitboxHeightMeters
      audioManager.playSlide()
      this.particleSystem.emitSparks(
        this.position.x,
        this.position.y - 0.3,
        this.position.z,
        14,
        0xffa447,
        1.5
      )
    }
  }

  public handleBalanceTilt(direction: -1 | 1): void {
    if (this.state === 'CABLE_SPRINT') {
      // Counter swipe against wind
      this.tiltAngle -= direction * 14.0
      this.flowSystem.registerPerfectAction('WIND_RECOVERY')
      audioManager.playWindGust()
      this.particleSystem.emitSparks(this.position.x, this.position.y, this.position.z, 5, 0x48a9a6)
    } else {
      // Small lateral dodge
      this.position.x = Math.max(-2.5, Math.min(2.5, this.position.x + direction * 0.8))
    }
  }

  // --- State Triggers ---

  private triggerLedgeVault(): void {
    this.state = 'LEDGE_CLIMB'
    this.ledgeClimbTimer = 0.22
    this.velocity.y = 4.2
    this.velocity.z = BALANCE.ledgeGrab.popUpVaultImpulse
    this.currentSpeed = Math.max(this.currentSpeed, BALANCE.ledgeGrab.popUpVaultImpulse)
    this.isGrounded = false
    this.flowSystem.registerPerfectAction('LEDGE_GRAB')
    audioManager.playLedgeGrab()
    this.particleSystem.emitSparks(this.position.x, this.position.y + 0.5, this.position.z, 16, 0x48a9a6)
  }

  private triggerPerfectRoll(): void {
    this.state = 'PERFECT_ROLL'
    this.rollTimer = 0.35
    this.currentSpeed += BALANCE.cushionRoll.velocityBoost
    this.targetSpeed = this.currentSpeed
    this.flowSystem.registerPerfectAction('PERFECT_ROLL')
    audioManager.playPerfectRoll()
    this.particleSystem.emitSparks(
      this.position.x,
      this.position.y,
      this.position.z,
      25,
      0xffd166,
      2.0
    )
  }

  private triggerHardCrash(impactVy: number): void {
    this.state = 'RUNNING'
    this.currentSpeed = Math.max(BALANCE.movement.minVelocity, this.currentSpeed * 0.5)
    this.flowSystem.resetFlowOnCrash()
    audioManager.playGlassCrack()
    const dmg = this.integritySystem.applyHardImpact(impactVy)
    events.emit('ACTION_FEEDBACK', 'CRASH')
    this.particleSystem.emitSteam(this.position.x, this.position.y + 0.8, this.position.z, 12, 1.2)
  }

  // --- Tick Update ---

  public update(dt: number): void {
    if (this.state === 'FALL_DEATH') return

    this.animTimer += dt

    // 1. Calculate Target Forward Speed from Flow Tier
    const tier = this.flowSystem.getTier()
    const baseTarget = BALANCE.movement.baseVelocity + (tier - 1) * BALANCE.movement.flowStepBoost
    this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, baseTarget, dt * 2.0)
    this.currentSpeed = Math.max(BALANCE.movement.minVelocity, Math.min(BALANCE.movement.maxVelocity, this.currentSpeed))
    this.velocity.z = this.currentSpeed

    // 2. Air / Holding time tracking
    if (!this.isGrounded) {
      if (this.state === 'HOLD_GROUPING') {
        this.holdTimeInAir += dt
      }
      this.velocity.y -= BALANCE.movement.gravity * dt
      if (this.velocity.y < -18.0) {
        this.velocity.y = -18.0
      }
    }

    // 3. Move Player
    this.position.x += this.velocity.x * dt
    this.position.y += this.velocity.y * dt
    this.position.z += this.velocity.z * dt

    // 4. Ground & Roof Collision check
    const ground = this.generator.getGroundHeightAt(this.position.x, this.position.z)

    if (ground.found) {
      // Check landing
      if (this.position.y <= ground.y + 0.05) {
        this.position.y = ground.y
        const impactVy = this.velocity.y
        this.velocity.y = 0

        if (!this.isGrounded) {
          // Landing occurred!
          this.isGrounded = true

          if (ground.surfaceType === 'cable') {
            this.state = 'CABLE_SPRINT'
            this.currentSpeed = BALANCE.cableBalance.cableSprintVelocity
          } else if (this.state === 'HOLD_GROUPING' && this.holdTimeInAir <= BALANCE.cushionRoll.perfectWindowSec + 0.15) {
            // Perfect Cushion Roll!
            this.triggerPerfectRoll()
          } else if (Math.abs(impactVy) > BALANCE.cushionRoll.safeFallVelocityCap) {
            // Hard impact damage!
            this.triggerHardCrash(impactVy)
          } else {
            this.state = 'RUNNING'
          }
        }

        // Apply slope gravity acceleration when sliding or running down
        if (ground.slopeDeg > 10) {
          const rad = (ground.slopeDeg * Math.PI) / 180
          const slopeBoost = BALANCE.slateSlide.slopeGravityAccel * Math.sin(rad) * dt
          this.currentSpeed = Math.min(BALANCE.movement.maxVelocity, this.currentSpeed + slopeBoost)
        }
      } else {
        this.isGrounded = false
        if (this.state !== 'HOLD_GROUPING' && this.state !== 'LEDGE_CLIMB') {
          this.state = 'FALLING'
        }
      }
    } else {
      // No roof below -> Falling into the street!
      this.isGrounded = false
      if (this.position.y < -8.0) {
        this.state = 'FALL_DEATH'
        events.emit('ACTION_FEEDBACK', 'CRASH')
      }
    }

    // 5. Obstacle collisions
    if (this.state !== 'SLIDING' && this.generator.checkObstacleCollision(this.position, this.currentHitboxHeight)) {
      this.triggerObstacleHit()
    }

    // 6. Timers update
    if (this.state === 'SLIDING') {
      this.slideTimer -= dt
      if (this.slideTimer <= 0) {
        this.state = this.isGrounded ? 'RUNNING' : 'FALLING'
        this.currentHitboxHeight = 1.85
      }
    }

    if (this.state === 'PERFECT_ROLL') {
      this.rollTimer -= dt
      if (this.rollTimer <= 0) {
        this.state = this.isGrounded ? 'RUNNING' : 'FALLING'
      }
    }

    if (this.state === 'LEDGE_CLIMB') {
      this.ledgeClimbTimer -= dt
      if (this.ledgeClimbTimer <= 0) {
        this.state = 'RUNNING'
        this.isGrounded = true
      }
    }

    // 7. Cable Balance & Wind
    if (this.state === 'CABLE_SPRINT') {
      this.windTimer += dt
      this.windForce = Math.sin(this.windTimer * 2.5) * BALANCE.cableBalance.crosswindGustForce
      this.tiltAngle += this.windForce * dt

      if (Math.abs(this.tiltAngle) > BALANCE.cableBalance.maxTiltAngleDeg) {
        // Blown off cable!
        this.state = 'FALL_DEATH'
        events.emit('ACTION_FEEDBACK', 'CRASH')
      }
    }

    // 8. Update Mesh Position and Rig Animations
    this.meshRoot.position.copy(this.position)
    this.updateAnimations(dt)
  }

  private triggerObstacleHit(): void {
    this.currentSpeed = Math.max(BALANCE.movement.minVelocity, this.currentSpeed * 0.4)
    this.flowSystem.resetFlowOnCrash()
    audioManager.playGlassCrack()
    this.integritySystem.applyObstacleDamage()
    this.particleSystem.emitSteam(this.position.x, this.position.y + 0.8, this.position.z, 15, 1.4)
  }

  private updateAnimations(dt: number): void {
    const { pelvis, spine, head, leftArm, rightArm, leftLeg, rightLeg, cape } = this.rig

    if (this.state === 'RUNNING' || this.state === 'CABLE_SPRINT') {
      const runFreq = this.currentSpeed * 0.85
      const swing = Math.sin(this.animTimer * runFreq) * 0.6

      leftLeg.rotation.x = swing
      rightLeg.rotation.x = -swing
      leftArm.rotation.x = -swing * 0.8
      rightArm.rotation.x = swing * 0.8

      pelvis.position.y = 0.85 + Math.abs(Math.sin(this.animTimer * runFreq)) * 0.08
      spine.rotation.x = 0.2 // Forward running lean
      head.rotation.x = -0.1

      // Billowing cape
      cape.rotation.x = 0.5 + Math.sin(this.animTimer * 12) * 0.2
      this.meshRoot.rotation.x = 0
      this.meshRoot.rotation.z = (this.tiltAngle * Math.PI) / 180
    } else if (this.state === 'SLIDING') {
      // Low sliding pose
      leftLeg.rotation.x = -1.4
      rightLeg.rotation.x = -1.4
      leftArm.rotation.x = 0.8
      rightArm.rotation.x = 0.8
      spine.rotation.x = -0.6
      pelvis.position.y = 0.35
      this.meshRoot.rotation.x = -0.3
    } else if (this.state === 'PERFECT_ROLL') {
      // 360 roll rotation
      this.meshRoot.rotation.x += dt * 18.0
      pelvis.position.y = 0.4
      leftLeg.rotation.x = -1.5
      rightLeg.rotation.x = -1.5
    } else if (this.state === 'JUMPING' || this.state === 'FALLING' || this.state === 'HOLD_GROUPING') {
      // Air pose
      const tuck = this.state === 'HOLD_GROUPING' ? -1.2 : -0.5
      leftLeg.rotation.x = tuck
      rightLeg.rotation.x = tuck * 0.8
      leftArm.rotation.x = 1.0
      rightArm.rotation.x = 1.0
      spine.rotation.x = 0.3
      cape.rotation.x = 0.8
      this.meshRoot.rotation.x = 0
    }
  }

  public getTiltAngle(): number {
    return this.tiltAngle
  }
}
