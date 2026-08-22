import * as THREE from 'three';
import { BALANCE } from '../core/Balance';

export interface MapCollider {
  box: THREE.Box3;
  mesh?: THREE.Object3D;
  isWall: boolean;
  isPenetrable: boolean;
  material: 'concrete' | 'wood' | 'metal';
  thicknessMeters: number;
}

export interface RayHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider?: MapCollider;
  entityId?: string;
  hitboxType?: 'head' | 'chest' | 'stomach' | 'legs';
}

export interface SmokeZone {
  position: THREE.Vector3;
  radius: number;
  remainingTime: number;
}

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  private colliders: MapCollider[] = [];
  private smokeZones: SmokeZone[] = [];

  private constructor() {}

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public clear(): void {
    this.colliders = [];
    this.smokeZones = [];
  }

  public addCollider(collider: MapCollider): void {
    this.colliders.push(collider);
  }

  public addSmokeZone(pos: THREE.Vector3, radius = BALANCE.SMOKE.CLOUD_RADIUS_METERS, duration = BALANCE.SMOKE.DENSE_PHASE_DURATION_SEC): void {
    this.smokeZones.push({
      position: pos.clone(),
      radius,
      remainingTime: duration,
    });
  }

  public updateSmoke(dt: number): void {
    for (let i = this.smokeZones.length - 1; i >= 0; i--) {
      this.smokeZones[i].remainingTime -= dt;
      if (this.smokeZones[i].remainingTime <= 0) {
        this.smokeZones.splice(i, 1);
      }
    }
  }

  public isLineOfSightBlockedBySmoke(p1: THREE.Vector3, p2: THREE.Vector3): boolean {
    const segDir = new THREE.Vector3().subVectors(p2, p1);
    const segLen = segDir.length();
    if (segLen === 0) return false;
    segDir.normalize();

    for (const smoke of this.smokeZones) {
      // Distance from smoke center to segment p1-p2
      const toCenter = new THREE.Vector3().subVectors(smoke.position, p1);
      const proj = toCenter.dot(segDir);
      if (proj >= 0 && proj <= segLen) {
        const closestPoint = new THREE.Vector3().copy(p1).addScaledVector(segDir, proj);
        if (closestPoint.distanceTo(smoke.position) < smoke.radius * 0.9) {
          return true;
        }
      }
    }
    return false;
  }

  public checkPlayerCollision(pos: THREE.Vector3, radius = 0.45, height = 1.8): boolean {
    const playerBox = new THREE.Box3(
      new THREE.Vector3(pos.x - radius, pos.y, pos.z - radius),
      new THREE.Vector3(pos.x + radius, pos.y + height, pos.z + radius)
    );

    for (const col of this.colliders) {
      if (col.box.intersectsBox(playerBox)) {
        return true;
      }
    }
    return false;
  }

  public resolveMovement(currPos: THREE.Vector3, nextPos: THREE.Vector3, radius = 0.45, height = 1.8): THREE.Vector3 {
    const resolved = nextPos.clone();

    // Check full movement
    if (!this.checkPlayerCollision(resolved, radius, height)) {
      return resolved;
    }

    // Try sliding on X axis
    const testX = new THREE.Vector3(nextPos.x, currPos.y, currPos.z);
    if (!this.checkPlayerCollision(testX, radius, height)) {
      return testX;
    }

    // Try sliding on Z axis
    const testZ = new THREE.Vector3(currPos.x, currPos.y, nextPos.z);
    if (!this.checkPlayerCollision(testZ, radius, height)) {
      return testZ;
    }

    // Blocked
    return currPos.clone();
  }

  public raycastMap(origin: THREE.Vector3, direction: THREE.Vector3, maxDist = 100): RayHit | null {
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    let closestHit: RayHit | null = null;
    let minDist = maxDist;

    for (const col of this.colliders) {
      const hitPoint = new THREE.Vector3();
      if (ray.intersectBox(col.box, hitPoint)) {
        const dist = origin.distanceTo(hitPoint);
        if (dist < minDist) {
          minDist = dist;
          // Calculate normal from box center
          const center = new THREE.Vector3();
          col.box.getCenter(center);
          const normal = new THREE.Vector3().subVectors(hitPoint, center).normalize();

          closestHit = {
            point: hitPoint,
            normal,
            distance: dist,
            collider: col,
          };
        }
      }
    }

    return closestHit;
  }
}

export const physics = PhysicsWorld.getInstance();
