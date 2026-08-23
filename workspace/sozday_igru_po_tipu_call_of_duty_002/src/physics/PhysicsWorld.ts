import * as THREE from 'three';
import { GAME_BALANCE } from '../config/balance';

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
  tag?: string;
  isVaultable?: boolean;
}

export interface RaycastHitResult {
  hit: boolean;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider?: AABB;
}

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  private colliders: AABB[] = [];
  public readonly mapBounds = { minX: -36, maxX: 36, minZ: -36, maxZ: 36 };

  private constructor() {}

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public clear(): void {
    this.colliders = [];
  }

  public addBox(center: THREE.Vector3, size: THREE.Vector3, tag: string = 'obstacle', isVaultable: boolean = false): void {
    const half = size.clone().multiplyScalar(0.5);
    this.colliders.push({
      min: new THREE.Vector3().subVectors(center, half),
      max: new THREE.Vector3().addVectors(center, half),
      tag,
      isVaultable
    });
  }

  public getColliders(): AABB[] {
    return this.colliders;
  }

  /**
   * Resolves horizontal and vertical movement collisions for a character capsule/box
   */
  public moveCharacter(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    radius: number,
    height: number,
    dt: number
  ): { grounded: boolean; hitWall: boolean } {
    let grounded = false;
    let hitWall = false;

    // Apply horizontal motion first
    const wishX = velocity.x * dt;
    const wishZ = velocity.z * dt;
    const nextPos = position.clone();

    // Map bounds clamp
    nextPos.x = Math.max(this.mapBounds.minX + radius, Math.min(this.mapBounds.maxX - radius, nextPos.x + wishX));
    nextPos.z = Math.max(this.mapBounds.minZ + radius, Math.min(this.mapBounds.maxZ - radius, nextPos.z + wishZ));

    // Resolve AABB collisions in X and Z
    for (const box of this.colliders) {
      // Check vertical overlap
      if (nextPos.y + height < box.min.y || nextPos.y > box.max.y) {
        continue;
      }

      // Check expanded box (Minkowski sum with circle/radius)
      const minX = box.min.x - radius;
      const maxX = box.max.x + radius;
      const minZ = box.min.z - radius;
      const maxZ = box.max.z + radius;

      if (nextPos.x > minX && nextPos.x < maxX && nextPos.z > minZ && nextPos.z < maxZ) {
        hitWall = true;
        // Determine minimum penetration depth
        const depthLeft = nextPos.x - minX;
        const depthRight = maxX - nextPos.x;
        const depthBack = nextPos.z - minZ;
        const depthFront = maxZ - nextPos.z;

        const minDepth = Math.min(depthLeft, depthRight, depthBack, depthFront);
        if (minDepth === depthLeft) {
          nextPos.x = minX;
          velocity.x = 0;
        } else if (minDepth === depthRight) {
          nextPos.x = maxX;
          velocity.x = 0;
        } else if (minDepth === depthBack) {
          nextPos.z = minZ;
          velocity.z = 0;
        } else {
          nextPos.z = maxZ;
          velocity.z = 0;
        }
      }
    }

    // Apply vertical motion
    const wishY = velocity.y * dt;
    nextPos.y += wishY;

    // Check floor
    let groundHeight = 0.0;
    for (const box of this.colliders) {
      // If horizontally inside this box
      if (
        nextPos.x > box.min.x - radius * 0.7 &&
        nextPos.x < box.max.x + radius * 0.7 &&
        nextPos.z > box.min.z - radius * 0.7 &&
        nextPos.z < box.max.z + radius * 0.7
      ) {
        // If feet are above or near the top of the box
        if (position.y >= box.max.y - 0.2 && box.max.y > groundHeight) {
          groundHeight = box.max.y;
        }
      }
    }

    if (nextPos.y <= groundHeight) {
      nextPos.y = groundHeight;
      velocity.y = 0;
      grounded = true;
    } else {
      grounded = false;
    }

    position.copy(nextPos);
    return { grounded, hitWall };
  }

  /**
   * Raycast check against world colliders
   */
  public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = 100): RaycastHitResult {
    let closestHit: RaycastHitResult = {
      hit: false,
      point: new THREE.Vector3(),
      normal: new THREE.Vector3(0, 1, 0),
      distance: maxDistance
    };

    const dir = direction.clone().normalize();

    for (const box of this.colliders) {
      // Slab method for ray vs AABB
      let tmin = (box.min.x - origin.x) / (dir.x !== 0 ? dir.x : 1e-8);
      let tmax = (box.max.x - origin.x) / (dir.x !== 0 ? dir.x : 1e-8);
      let normal = new THREE.Vector3(-Math.sign(dir.x), 0, 0);

      if (tmin > tmax) {
        const temp = tmin; tmin = tmax; tmax = temp;
        normal.x = Math.sign(dir.x);
      }

      let tymin = (box.min.y - origin.y) / (dir.y !== 0 ? dir.y : 1e-8);
      let tymax = (box.max.y - origin.y) / (dir.y !== 0 ? dir.y : 1e-8);
      let normalY = new THREE.Vector3(0, -Math.sign(dir.y), 0);

      if (tymin > tymax) {
        const temp = tymin; tymin = tymax; tymax = temp;
        normalY.y = Math.sign(dir.y);
      }

      if (tmin > tymax || tymin > tmax) continue;

      if (tymin > tmin) {
        tmin = tymin;
        normal = normalY;
      }
      if (tymax < tmax) tmax = tymax;

      let tzmin = (box.min.z - origin.z) / (dir.z !== 0 ? dir.z : 1e-8);
      let tzmax = (box.max.z - origin.z) / (dir.z !== 0 ? dir.z : 1e-8);
      let normalZ = new THREE.Vector3(0, 0, -Math.sign(dir.z));

      if (tzmin > tzmax) {
        const temp = tzmin; tzmin = tzmax; tzmax = temp;
        normalZ.z = Math.sign(dir.z);
      }

      if (tmin > tzmax || tzmin > tmax) continue;

      if (tzmin > tmin) {
        tmin = tzmin;
        normal = normalZ;
      }

      if (tmin >= 0 && tmin < closestHit.distance) {
        closestHit.hit = true;
        closestHit.distance = tmin;
        closestHit.point.copy(origin).addScaledVector(dir, tmin);
        closestHit.normal.copy(normal);
        closestHit.collider = box;
      }
    }

    return closestHit;
  }

  /**
   * Check if there is a ledge in front of the player suitable for vaulting (up to 2.60m)
   */
  public checkLedge(origin: THREE.Vector3, forward: THREE.Vector3): { canVault: boolean; topY: number; targetPos: THREE.Vector3 } {
    const fwd = forward.clone().setY(0).normalize();
    const hitLow = this.raycast(origin.clone().setY(origin.y + 0.5), fwd, 1.3);

    if (hitLow.hit && hitLow.collider && hitLow.collider.isVaultable) {
      const topY = hitLow.collider.max.y;
      const heightDiff = topY - origin.y;

      if (heightDiff > 0.4 && heightDiff <= GAME_BALANCE.max_vault_obstacle_height) {
        const targetPos = hitLow.point.clone().addScaledVector(fwd, 0.8);
        targetPos.y = topY;
        return { canVault: true, topY, targetPos };
      }
    }

    return { canVault: false, topY: 0, targetPos: new THREE.Vector3() };
  }
}

export const physicsWorld = PhysicsWorld.getInstance();