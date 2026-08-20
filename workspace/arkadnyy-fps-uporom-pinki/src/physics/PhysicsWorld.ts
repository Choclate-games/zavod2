import * as THREE from 'three';

export interface CollisionBox {
  id: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
  isTrigger?: boolean;
  type: 'WALL' | 'DOOR' | 'OBSTACLE' | 'BOUNDARY';
  normal?: THREE.Vector3;
}

export interface PhysicsBody {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  height: number;
  mass: number;
  isStatic: boolean;
  isGrounded: boolean;
  useGravity: boolean;
  drag: number;
  restitution: number;
  onCollide?: (other: CollisionBox | PhysicsBody, normal: THREE.Vector3, impactSpeed: number) => void;
}

export interface RaycastHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  box: CollisionBox;
}

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  private staticColliders: CollisionBox[] = [];
  private dynamicBodies: PhysicsBody[] = [];
  private readonly GRAVITY = -24.0; // Snappy arcade gravity

  // Pre-allocated scratch objects to prevent allocations in tick
  private scratchVec1 = new THREE.Vector3();
  private scratchVec2 = new THREE.Vector3();
  private scratchVec3 = new THREE.Vector3();

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public clear(): void {
    this.staticColliders = [];
    this.dynamicBodies = [];
  }

  public addStaticBox(id: string, min: THREE.Vector3, max: THREE.Vector3, type: 'WALL' | 'DOOR' | 'OBSTACLE' | 'BOUNDARY' = 'WALL'): CollisionBox {
    const box: CollisionBox = {
      id,
      min: min.clone(),
      max: max.clone(),
      type,
    };
    this.staticColliders.push(box);
    return box;
  }

  public removeStaticBox(id: string): void {
    this.staticColliders = this.staticColliders.filter((b) => b.id !== id);
  }

  public addBody(body: PhysicsBody): void {
    if (!this.dynamicBodies.includes(body)) {
      this.dynamicBodies.push(body);
    }
  }

  public removeBody(id: string): void {
    this.dynamicBodies = this.dynamicBodies.filter((b) => b.id !== id);
  }

  public step(dt: number): void {
    for (let i = 0; i < this.dynamicBodies.length; i++) {
      const body = this.dynamicBodies[i];
      if (body.isStatic) continue;

      // Apply Gravity
      if (body.useGravity && !body.isGrounded) {
        body.velocity.y += this.GRAVITY * dt;
      }

      // Apply Linear Drag
      body.velocity.x *= Math.max(0, 1 - body.drag * dt);
      body.velocity.z *= Math.max(0, 1 - body.drag * dt);

      // Integrate motion with sub-steps for high velocity
      const speed = body.velocity.length();
      const numSteps = speed > 15 ? 3 : 1;
      const subDt = dt / numSteps;

      for (let step = 0; step < numSteps; step++) {
        // Move along X
        body.position.x += body.velocity.x * subDt;
        this.resolveStaticCollisions(body, 'x');

        // Move along Y
        body.position.y += body.velocity.y * subDt;
        this.resolveStaticCollisions(body, 'y');

        // Move along Z
        body.position.z += body.velocity.z * subDt;
        this.resolveStaticCollisions(body, 'z');
      }

      // Ground plane check (y = 0 minimum)
      if (body.position.y < 0) {
        body.position.y = 0;
        body.isGrounded = true;
        if (body.velocity.y < 0) {
          body.velocity.y = 0;
        }
      }
    }
  }

  private resolveStaticCollisions(body: PhysicsBody, axis: 'x' | 'y' | 'z'): void {
    const minX = body.position.x - body.radius;
    const maxX = body.position.x + body.radius;
    const minY = body.position.y;
    const maxY = body.position.y + body.height;
    const minZ = body.position.z - body.radius;
    const maxZ = body.position.z + body.radius;

    for (let i = 0; i < this.staticColliders.length; i++) {
      const box = this.staticColliders[i];
      if (box.isTrigger) continue;

      // AABB overlap check
      if (
        maxX > box.min.x &&
        minX < box.max.x &&
        maxY > box.min.y &&
        minY < box.max.y &&
        maxZ > box.min.z &&
        minZ < box.max.z
      ) {
        const impactSpeed = body.velocity.length();
        const normal = this.scratchVec1.set(0, 0, 0);

        if (axis === 'x') {
          if (body.velocity.x > 0) {
            body.position.x = box.min.x - body.radius;
            normal.x = -1;
          } else if (body.velocity.x < 0) {
            body.position.x = box.max.x + body.radius;
            normal.x = 1;
          }
          body.velocity.x = -body.velocity.x * body.restitution;
        } else if (axis === 'y') {
          if (body.velocity.y > 0) {
            body.position.y = box.min.y - body.height;
            normal.y = -1;
            body.velocity.y = 0;
          } else if (body.velocity.y < 0) {
            body.position.y = box.max.y;
            normal.y = 1;
            body.velocity.y = 0;
            body.isGrounded = true;
          }
        } else if (axis === 'z') {
          if (body.velocity.z > 0) {
            body.position.z = box.min.z - body.radius;
            normal.z = -1;
          } else if (body.velocity.z < 0) {
            body.position.z = box.max.z + body.radius;
            normal.z = 1;
          }
          body.velocity.z = -body.velocity.z * body.restitution;
        }

        if (body.onCollide) {
          body.onCollide(box, normal, impactSpeed);
        }
      }
    }
  }

  public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): RaycastHit | null {
    let closestHit: RaycastHit | null = null;
    let minDistance = maxDistance;

    const dirNorm = this.scratchVec2.copy(direction).normalize();

    for (let i = 0; i < this.staticColliders.length; i++) {
      const box = this.staticColliders[i];
      if (box.isTrigger) continue;

      const hit = this.intersectRayAABB(origin, dirNorm, box.min, box.max, minDistance);
      if (hit && hit.distance < minDistance) {
        minDistance = hit.distance;
        closestHit = {
          point: hit.point,
          normal: hit.normal,
          distance: hit.distance,
          box,
        };
      }
    }

    return closestHit;
  }

  private intersectRayAABB(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    min: THREE.Vector3,
    max: THREE.Vector3,
    maxDist: number
  ): { point: THREE.Vector3; normal: THREE.Vector3; distance: number } | null {
    let tmin = 0.0;
    let tmax = maxDist;
    let normalAxis = -1;
    let normalSign = 0;

    for (let i = 0; i < 3; i++) {
      const org = i === 0 ? origin.x : i === 1 ? origin.y : origin.z;
      const dir = i === 0 ? direction.x : i === 1 ? direction.y : direction.z;
      const bmin = i === 0 ? min.x : i === 1 ? min.y : min.z;
      const bmax = i === 0 ? max.x : i === 1 ? max.y : max.z;

      if (Math.abs(dir) < 1e-6) {
        if (org < bmin || org > bmax) return null;
      } else {
        const invD = 1.0 / dir;
        let t1 = (bmin - org) * invD;
        let t2 = (bmax - org) * invD;
        let sign = -1;

        if (t1 > t2) {
          const temp = t1;
          t1 = t2;
          t2 = temp;
          sign = 1;
        }

        if (t1 > tmin) {
          tmin = t1;
          normalAxis = i;
          normalSign = sign;
        }

        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }

    if (tmin < 0 || tmin > maxDist) return null;

    const point = origin.clone().addScaledVector(direction, tmin);
    const normal = new THREE.Vector3();
    if (normalAxis === 0) normal.set(normalSign, 0, 0);
    else if (normalAxis === 1) normal.set(0, normalSign, 0);
    else if (normalAxis === 2) normal.set(0, 0, normalSign);

    return { point, normal, distance: tmin };
  }

  /** Cone search for finding best kick target in front of player */
  public findConeTarget<T extends { position: THREE.Vector3 }>(
    origin: THREE.Vector3,
    forward: THREE.Vector3,
    maxDistance: number,
    coneAngleDeg: number,
    targets: T[]
  ): T | null {
    const halfAngleRad = (coneAngleDeg * 0.5 * Math.PI) / 180;
    const minCos = Math.cos(halfAngleRad);
    const forwardNorm = this.scratchVec2.copy(forward).normalize();

    let bestTarget: T | null = null;
    let closestDist = maxDistance;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const toTarget = this.scratchVec3.copy(target.position).sub(origin);
      const dist = toTarget.length();

      if (dist > maxDistance || dist < 0.1) continue;

      toTarget.normalize();
      const dot = forwardNorm.dot(toTarget);

      if (dot >= minCos) {
        if (dist < closestDist) {
          closestDist = dist;
          bestTarget = target;
        }
      }
    }

    return bestTarget;
  }
}
