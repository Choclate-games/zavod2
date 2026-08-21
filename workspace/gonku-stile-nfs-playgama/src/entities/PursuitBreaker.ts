import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ProceduralModels } from '../rendering/ProceduralModels';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { EventBus } from '../core/EventBus';

export type BreakerType = 'billboard' | 'gas_station' | 'water_tower';
export type BreakerState = 'INTACT' | 'COLLAPSING' | 'DEBRIS_FIELD';

export class PursuitBreaker {
  readonly root: THREE.Group = new THREE.Group();
  readonly position: THREE.Vector3;
  readonly type: BreakerType;

  state: BreakerState = 'INTACT';
  private triggerBody: RAPIER.RigidBody | null = null;
  private collapseTimer = 0;
  private visualMeshes: THREE.Object3D[] = [];
  private topMesh: THREE.Object3D | null = null;

  constructor(
    type: BreakerType,
    position: THREE.Vector3,
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld
  ) {
    this.type = type;
    this.position = position.clone();
    this.root.position.copy(this.position);

    if (type === 'billboard') {
      const data = ProceduralModels.createBillboardBreaker();
      this.root.add(data.root);
      this.visualMeshes.push(...data.trusses);
      this.topMesh = data.board;
    } else if (type === 'gas_station') {
      const data = ProceduralModels.createGasStationBreaker();
      this.root.add(data.root);
      this.visualMeshes.push(...data.pillars);
      this.topMesh = data.canopy;
    } else {
      const data = ProceduralModels.createWaterTowerBreaker();
      this.root.add(data.root);
      this.visualMeshes.push(...data.legs);
      this.topMesh = data.tank;
    }

    scene.add(this.root);
    this.createPhysics();
  }

  private createPhysics(): void {
    // Structural trigger collider
    this.triggerBody = this.physics.createObstacle(
      new THREE.Vector3(this.position.x, this.position.y + 2.5, this.position.z),
      new THREE.Vector3(6.0, 5.0, 4.0),
      true
    );
  }

  checkCollision(playerPos: THREE.Vector3, speedKmH: number): boolean {
    if (this.state !== 'INTACT') return false;

    const dist = playerPos.distanceTo(this.position);
    if (dist < 4.8 && speedKmH >= 42.0) {
      this.triggerCollapse();
      return true;
    }
    return false;
  }

  triggerCollapse(): void {
    if (this.state !== 'INTACT') return;
    this.state = 'COLLAPSING';
    this.collapseTimer = 0.35;

    // 1. Remove initial static body
    if (this.triggerBody) {
      this.physics.removeRigidBody(this.triggerBody);
      this.triggerBody = null;
    }

    // 2. Audio & Screen FX
    SoundSynthesizer.get().playPursuitBreakerExplosion();
    ParticleSystem.get().emitExplosion(this.position, 35);
    ParticleSystem.get().emitShockwave(this.position, 14.0);
    ParticleSystem.get().spawnGears(this.position, 45);

    // 3. Emit event for Game / Camera / UI / Cops elimination
    EventBus.get().emit('pursuit_breaker:collapsed', {
      position: this.position,
      radius: 14.0,
      rewardGears: 45,
    });
  }

  update(dt: number): void {
    if (this.state === 'COLLAPSING') {
      this.collapseTimer -= dt;
      if (this.topMesh) {
        this.topMesh.position.y -= 14.0 * dt;
        this.topMesh.rotation.x += 1.5 * dt;
        this.topMesh.rotation.z += 1.2 * dt;
      }
      if (this.collapseTimer <= 0) {
        this.state = 'DEBRIS_FIELD';
        if (this.topMesh) {
          this.topMesh.position.y = 0.8;
        }
      }
    }
  }

  reset(): void {
    this.state = 'INTACT';
    this.collapseTimer = 0;
    if (this.topMesh) {
      this.topMesh.position.set(0, this.type === 'billboard' ? 7.5 : this.type === 'gas_station' ? 6.4 : 9.5, 0);
      this.topMesh.rotation.set(0, 0, 0);
    }
    if (!this.triggerBody) {
      this.createPhysics();
    }
  }
}
