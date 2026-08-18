// src/entities/Player.ts
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { physicsWorld } from '@/physics/PhysicsWorld';
import { ProceduralModels, ChickenRig } from '@/rendering/ProceduralModels';
import { particleSystem } from '@/rendering/ParticleSystem';
import { eventBus } from '@/core/EventBus';

export class Player {
  public mesh: THREE.Group;
  private rig: ChickenRig;
  private body: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;

  public isHiding: boolean = false;
  public isInvulnerable: boolean = false;
  public invulnerabilityTimer: number = 0;

  private baseSpeed: number = 4.2;
  private crawlSpeedRatio: number = 0.4;
  private currentSpeed: number = 0;

  private moveDirX: number = 0;
  private moveDirZ: number = 0;
  private targetFacingAngle: number = 0;
  private currentFacingAngle: number = 0;

  private stepTimer: number = 0;
  private walkAnimPhase: number = 0;

  private boxDropAnimTimer: number = 0;
  private boxScaleY: number = 1.0;

  constructor(startX: number, startZ: number, chickenSkin: string = 'classic', boxSkin: string = 'cardboard') {
    this.rig = ProceduralModels.createChicken(chickenSkin, boxSkin);
    this.mesh = this.rig.root;
    this.mesh.position.set(startX, 0, startZ);

    // Create Rapier body
    const physicsRes = physicsWorld.createPlayerBody(startX, startZ);
    if (physicsRes) {
      this.body = physicsRes.body;
      this.collider = physicsRes.collider;
    }
  }

  public setSkins(chickenSkin: string, boxSkin: string): void {
    const parent = this.mesh.parent;
    const pos = this.mesh.position.clone();
    const rot = this.mesh.rotation.y;

    if (parent) {
      parent.remove(this.mesh);
    }

    this.rig = ProceduralModels.createChicken(chickenSkin, boxSkin);
    this.mesh = this.rig.root;
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = rot;

    if (parent) {
      parent.add(this.mesh);
    }

    if (this.isHiding) {
      this.rig.body.visible = false;
      this.rig.boxMesh.visible = true;
    }
  }

  public resetPosition(x: number, z: number): void {
    this.mesh.position.set(x, 0, z);
    if (this.body) {
      this.body.setTranslation({ x, y: 0.5, z }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.isHiding = false;
    this.rig.body.visible = true;
    this.rig.boxMesh.visible = false;
    this.currentSpeed = 0;
  }

  public setInvulnerable(duration: number = 3.0): void {
    this.isInvulnerable = true;
    this.invulnerabilityTimer = duration;
  }

  public toggleBox(): boolean {
    this.isHiding = !this.isHiding;
    this.boxDropAnimTimer = 0.15;

    if (this.isHiding) {
      // Hide under box
      this.rig.boxMesh.visible = true;
      this.rig.boxMesh.position.y = 1.2; // Falls from above
      this.rig.body.visible = false;

      eventBus.emit('audio:playSfx', { name: 'box_drop', volume: 0.9 });
      particleSystem.spawnBoxImpactPuff(this.mesh.position.x, 0, this.mesh.position.z);
    } else {
      // Pop out of box
      this.rig.boxMesh.visible = false;
      this.rig.body.visible = true;
      this.rig.body.scale.set(1, 1, 1);

      eventBus.emit('audio:playSfx', { name: 'box_pop', volume: 0.7 });
      particleSystem.spawnStepDust(this.mesh.position.x, 0, this.mesh.position.z);
    }

    eventBus.emit('player:boxToggle', { isHiding: this.isHiding });
    return this.isHiding;
  }

  public setInput(inputX: number, inputY: number): void {
    // Transform screen/keyboard 2D input (X: right, Y: up) to isometric camera coordinates (Yaw 45 deg)
    // In our isometric view: Camera is at (+X, +Y, +Z) looking at (0, 0, 0)
    // Moving screen-UP means (-X, -Z)
    // Moving screen-RIGHT means (+X, -Z)
    // Moving screen-DOWN means (+X, +Z)
    // Moving screen-LEFT means (-X, +Z)
    const isoX = (inputX - inputY) * 0.7071;
    const isoZ = (-inputX - inputY) * 0.7071;

    const len = Math.hypot(isoX, isoZ);
    if (len > 0.05) {
      this.moveDirX = isoX / len;
      this.moveDirZ = isoZ / len;
      this.targetFacingAngle = Math.atan2(this.moveDirX, this.moveDirZ);
      this.currentSpeed = Math.min(1.0, len);
    } else {
      this.moveDirX = 0;
      this.moveDirZ = 0;
      this.currentSpeed = 0;
    }
  }

  public update(dt: number): void {
    // Handle invulnerability flashing
    if (this.isInvulnerable) {
      this.invulnerabilityTimer -= dt;
      if (this.invulnerabilityTimer <= 0) {
        this.isInvulnerable = false;
        this.mesh.visible = true;
      } else {
        // Flash visibility
        this.mesh.visible = Math.floor(this.invulnerabilityTimer * 12) % 2 === 0;
      }
    }

    // Box falling squash animation
    if (this.boxDropAnimTimer > 0) {
      this.boxDropAnimTimer -= dt;
      const t = Math.max(0, this.boxDropAnimTimer) / 0.15;
      this.rig.boxMesh.position.y = 0.42 + t * 0.8;
      this.boxScaleY = 1.0 - Math.sin(t * Math.PI) * 0.2;
      this.rig.boxMesh.scale.set(1.0, this.boxScaleY, 1.0);
    }

    // Speed calculation
    const speedMultiplier = this.isHiding ? this.crawlSpeedRatio : 1.0;
    const targetVelX = this.moveDirX * this.baseSpeed * speedMultiplier * this.currentSpeed;
    const targetVelZ = this.moveDirZ * this.baseSpeed * speedMultiplier * this.currentSpeed;

    // Apply velocity to Rapier dynamic body
    if (this.body) {
      const curVel = this.body.linvel();
      this.body.setLinvel({ x: targetVelX, y: curVel.y, z: targetVelZ }, true);

      const trans = this.body.translation();
      this.mesh.position.set(trans.x, 0, trans.z);
    } else {
      // Fallback movement
      this.mesh.position.x += targetVelX * dt;
      this.mesh.position.z += targetVelZ * dt;
    }

    // Smooth rotation towards movement direction
    if (this.currentSpeed > 0.05) {
      let diff = this.targetFacingAngle - this.currentFacingAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.currentFacingAngle += diff * Math.min(1.0, 15 * dt);
      this.mesh.rotation.y = this.currentFacingAngle;

      // Walk & Waddle Animation
      this.walkAnimPhase += dt * (this.isHiding ? 8 : 16);
      const legAngle = Math.sin(this.walkAnimPhase) * 0.45;
      this.rig.leftLeg.rotation.x = legAngle;
      this.rig.rightLeg.rotation.x = -legAngle;

      // Body bobbing and wing fluttering
      const bob = Math.abs(Math.sin(this.walkAnimPhase)) * 0.08;
      this.rig.body.position.y = 0.45 + bob;
      this.rig.comb.rotation.z = Math.sin(this.walkAnimPhase) * 0.15;
      this.rig.leftWing.rotation.z = -0.15 + Math.sin(this.walkAnimPhase) * 0.2;
      this.rig.rightWing.rotation.z = 0.15 - Math.sin(this.walkAnimPhase) * 0.2;

      // Box waddle
      if (this.isHiding) {
        this.rig.boxMesh.rotation.z = Math.sin(this.walkAnimPhase) * 0.08;
      }

      // Footstep SFX and dust
      this.stepTimer += dt;
      if (this.stepTimer > (this.isHiding ? 0.35 : 0.2)) {
        this.stepTimer = 0;
        if (!this.isHiding) {
          eventBus.emit('audio:playSfx', { name: 'step', volume: 0.3 });
          particleSystem.spawnStepDust(this.mesh.position.x, 0, this.mesh.position.z);
        }
      }
    } else {
      // Idle pose
      this.rig.leftLeg.rotation.x = 0;
      this.rig.rightLeg.rotation.x = 0;
      this.rig.body.position.y = 0.45;
      this.rig.comb.rotation.z = 0;
      this.rig.boxMesh.rotation.z = 0;
    }

    eventBus.emit('player:move', {
      x: this.mesh.position.x,
      z: this.mesh.position.z,
      isMoving: this.currentSpeed > 0.05,
      speed: this.currentSpeed * speedMultiplier
    });
  }

  public getPosition(): { x: number; y: number; z: number } {
    return {
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      z: this.mesh.position.z
    };
  }

  public getVelocityMagnitude(): number {
    return this.currentSpeed * (this.isHiding ? this.crawlSpeedRatio : 1.0);
  }

  public destroy(): void {
    if (this.body && this.collider) {
      physicsWorld.getWorld().removeCollider(this.collider, true);
      physicsWorld.getWorld().removeRigidBody(this.body);
    }
  }
}
