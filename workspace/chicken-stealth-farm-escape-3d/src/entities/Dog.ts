// src/entities/Dog.ts
import * as THREE from 'three';
import { ProceduralModels, DogRig } from '@/rendering/ProceduralModels';
import { VisionConeMesh } from '@/rendering/VisionConeMesh';
import { eventBus } from '@/core/EventBus';
import { sceneManager } from '@/rendering/SceneManager';

export interface Waypoint {
  x: number;
  z: number;
  waitTime?: number; // seconds to pause at waypoint
}

export type DogAIState = 'patrol' | 'suspicious' | 'alert' | 'search';

export class Dog {
  public id: string;
  public mesh: THREE.Group;
  private rig: DogRig;
  public visionCone: VisionConeMesh;

  private waypoints: Waypoint[];
  private currentWaypointIndex: number = 0;
  private isFastHound: boolean;

  public state: DogAIState = 'patrol';
  private patrolSpeed: number = 1.8;
  private pursuitSpeed: number = 3.6;

  private currentFacingAngle: number = 0;
  private targetFacingAngle: number = 0;

  private waitTimer: number = 0;
  private searchTimer: number = 0;
  private alertTimer: number = 0;
  private animPhase: number = 0;

  private lastSeenTargetPos: { x: number; z: number } | null = null;

  constructor(
    id: string,
    waypoints: Waypoint[],
    isFastHound: boolean = false,
    viewDistance: number = 6.5
  ) {
    this.id = id;
    this.waypoints = waypoints;
    this.isFastHound = isFastHound;
    if (this.isFastHound) {
      this.patrolSpeed = 2.4;
      this.pursuitSpeed = 4.2;
    }

    this.rig = ProceduralModels.createDog(isFastHound);
    this.mesh = this.rig.root;

    // Initial position
    const start = waypoints[0] || { x: 0, z: 0 };
    this.mesh.position.set(start.x, 0, start.z);

    // Attach dynamic vision cone
    this.visionCone = new VisionConeMesh(65, isFastHound ? viewDistance + 1.0 : viewDistance);
    this.mesh.add(this.visionCone.mesh);

    if (waypoints.length > 1) {
      const next = waypoints[1];
      this.currentFacingAngle = Math.atan2(next.x - start.x, next.z - start.z);
      this.targetFacingAngle = this.currentFacingAngle;
      this.mesh.rotation.y = this.currentFacingAngle;
    }
  }

  public getPosition(): { x: number; y: number; z: number } {
    return {
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      z: this.mesh.position.z
    };
  }

  public getFacingAngle(): number {
    return this.currentFacingAngle;
  }

  public getViewDistance(): number {
    return this.isFastHound ? 7.5 : 6.5;
  }

  public getFovRad(): number {
    return (65 * Math.PI) / 180;
  }

  public triggerAlert(targetX: number, targetZ: number): void {
    if (this.state !== 'alert') {
      this.state = 'alert';
      this.lastSeenTargetPos = { x: targetX, z: targetZ };
      this.alertTimer = 4.0; // Stay in alert pursuit

      // Visual & Audio triggers
      this.rig.alertBillboard.visible = true;
      (this.rig.alertIcon as unknown as THREE.Group).visible = true;
      (this.rig.suspiciousIcon as unknown as THREE.Group).visible = false;
      this.visionCone.setVisionState('alert');

      eventBus.emit('audio:playSfx', { name: 'alert', volume: 0.9 });
      eventBus.emit('audio:playSfx', { name: 'bark', volume: 0.8 });
      eventBus.emit('audio:setBgm', { track: 'pursuit' });
      sceneManager.triggerScreenShake(0.35, 0.4);

      eventBus.emit('dog:alert', {
        dogId: this.id,
        state: 'alert',
        position: { x: this.mesh.position.x, z: this.mesh.position.z }
      });
    } else {
      this.lastSeenTargetPos = { x: targetX, z: targetZ };
      this.alertTimer = 4.0;
    }
  }

  public triggerSuspicious(targetX: number, targetZ: number): void {
    if (this.state === 'alert') return;

    this.state = 'suspicious';
    this.lastSeenTargetPos = { x: targetX, z: targetZ };
    this.waitTimer = 1.8;

    this.rig.alertBillboard.visible = true;
    (this.rig.alertIcon as unknown as THREE.Group).visible = false;
    (this.rig.suspiciousIcon as unknown as THREE.Group).visible = true;
    this.visionCone.setVisionState('suspicious');

    eventBus.emit('audio:playSfx', { name: 'suspicious', volume: 0.6 });

    // Turn towards suspicious spot
    const dx = targetX - this.mesh.position.x;
    const dz = targetZ - this.mesh.position.z;
    this.targetFacingAngle = Math.atan2(dx, dz);
  }

  public resetToPatrol(): void {
    this.state = 'patrol';
    this.waitTimer = 0;
    this.searchTimer = 0;
    this.lastSeenTargetPos = null;

    this.rig.alertBillboard.visible = false;
    this.visionCone.setVisionState('patrol');
    eventBus.emit('audio:setBgm', { track: 'stealth' });
  }

  public update(
    dt: number,
    playerPos: { x: number; y: number; z: number },
    isPlayerHiding: boolean,
    isPlayerMoving: boolean,
    isPlayerInvulnerable: boolean
  ): void {
    // Keep Alert Billboard facing camera
    if (this.rig.alertBillboard.visible) {
      this.rig.alertBillboard.quaternion.copy(sceneManager.camera.quaternion);
    }

    // AI FSM Logic
    switch (this.state) {
      case 'patrol':
        this.updatePatrol(dt);
        break;

      case 'suspicious':
        this.updateSuspicious(dt);
        break;

      case 'alert':
        this.updateAlert(dt, playerPos, isPlayerHiding, isPlayerMoving);
        break;

      case 'search':
        this.updateSearch(dt);
        break;
    }

    // Catch Check
    if (!isPlayerInvulnerable) {
      const distToPlayer = Math.hypot(
        playerPos.x - this.mesh.position.x,
        playerPos.z - this.mesh.position.z
      );
      if (distToPlayer < 0.65) {
        // Dog caught chicken!
        if (!isPlayerHiding || (isPlayerHiding && isPlayerMoving)) {
          eventBus.emit('player:caught', {
            dogPosition: { x: this.mesh.position.x, z: this.mesh.position.z }
          });
        }
      }
    }

    // Update vision cone vertices and raycasts
    const raySegments = sceneManager.governor.getRaycastSegments();
    this.visionCone.update(
      this.mesh.position.x,
      this.mesh.position.y,
      this.mesh.position.z,
      this.currentFacingAngle,
      raySegments
    );
  }

  private updatePatrol(dt: number): void {
    if (this.waypoints.length === 0) return;

    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      // Idle sniffing animation
      this.animPhase += dt * 4;
      this.rig.snout.position.y = -0.08 + Math.sin(this.animPhase) * 0.03;
      this.rig.tail.rotation.y = Math.sin(this.animPhase) * 0.3;
      return;
    }

    const targetWp = this.waypoints[this.currentWaypointIndex];
    const dx = targetWp.x - this.mesh.position.x;
    const dz = targetWp.z - this.mesh.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.25) {
      // Reached waypoint -> pause
      this.waitTimer = targetWp.waitTime || 1.2;
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      return;
    }

    // Move towards waypoint
    this.targetFacingAngle = Math.atan2(dx, dz);
    this.stepMovement(dt, dx / dist, dz / dist, this.patrolSpeed);
  }

  private updateSuspicious(dt: number): void {
    this.smoothRotate(dt, 8.0);
    this.waitTimer -= dt;

    // Head tilt animation
    this.animPhase += dt * 6;
    this.rig.head.rotation.z = Math.sin(this.animPhase) * 0.15;

    if (this.waitTimer <= 0) {
      this.resetToPatrol();
    }
  }

  private updateAlert(
    dt: number,
    playerPos: { x: number; y: number; z: number },
    isPlayerHiding: boolean,
    isPlayerMoving: boolean
  ): void {
    // If player stops moving under box, dog loses sight of chicken and searches last known position!
    if (isPlayerHiding && !isPlayerMoving) {
      this.state = 'search';
      this.searchTimer = 3.0;
      this.visionCone.setVisionState('suspicious');
      (this.rig.alertIcon as unknown as THREE.Group).visible = false;
      (this.rig.suspiciousIcon as unknown as THREE.Group).visible = true;
      return;
    }

    this.alertTimer -= dt;
    const targetX = playerPos.x;
    const targetZ = playerPos.z;
    this.lastSeenTargetPos = { x: targetX, z: targetZ };

    const dx = targetX - this.mesh.position.x;
    const dz = targetZ - this.mesh.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.15) {
      this.targetFacingAngle = Math.atan2(dx, dz);
      this.stepMovement(dt, dx / dist, dz / dist, this.pursuitSpeed);
    }
  }

  private updateSearch(dt: number): void {
    if (!this.lastSeenTargetPos) {
      this.resetToPatrol();
      return;
    }

    const dx = this.lastSeenTargetPos.x - this.mesh.position.x;
    const dz = this.lastSeenTargetPos.z - this.mesh.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.3) {
      // Run to last seen spot
      this.targetFacingAngle = Math.atan2(dx, dz);
      this.stepMovement(dt, dx / dist, dz / dist, this.patrolSpeed * 1.3);
    } else {
      // Look around left and right
      this.searchTimer -= dt;
      this.animPhase += dt * 3;
      this.targetFacingAngle = Math.sin(this.animPhase) * 1.2;
      this.smoothRotate(dt, 5.0);

      if (this.searchTimer <= 0) {
        this.resetToPatrol();
      }
    }
  }

  private stepMovement(dt: number, dirX: number, dirZ: number, speed: number): void {
    this.mesh.position.x += dirX * speed * dt;
    this.mesh.position.z += dirZ * speed * dt;

    this.smoothRotate(dt, speed > 2.5 ? 14.0 : 8.0);

    // 4-leg run animation
    this.animPhase += dt * (speed * 4.5);
    const legSwing = Math.sin(this.animPhase) * 0.55;

    this.rig.frontLeftLeg.rotation.x = legSwing;
    this.rig.frontRightLeg.rotation.x = -legSwing;
    this.rig.backLeftLeg.rotation.x = -legSwing;
    this.rig.backRightLeg.rotation.x = legSwing;

    // Body bounce & tail wag
    this.rig.body.position.y = 0.45 + Math.abs(Math.sin(this.animPhase)) * 0.06;
    this.rig.tail.rotation.y = Math.sin(this.animPhase * 2) * 0.5;
  }

  private smoothRotate(dt: number, turnSpeed: number): void {
    let diff = this.targetFacingAngle - this.currentFacingAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.currentFacingAngle += diff * Math.min(1.0, turnSpeed * dt);
    this.mesh.rotation.y = this.currentFacingAngle;
  }

  public dispose(): void {
    this.visionCone.dispose();
  }
}
