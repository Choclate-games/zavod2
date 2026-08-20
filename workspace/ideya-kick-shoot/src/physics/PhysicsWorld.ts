import { Vector3D } from '../core/Types';
import { MathUtils } from './MathUtils';

export interface RigidBody {
  id: string;
  position: Vector3D;
  velocity: Vector3D;
  radius: number;
  height: number;
  mass: number;
  isStatic: boolean;
  isGrounded: boolean;
  drag: number;
  bounce: number;
  onWallCollision?: (impactSpeed: number, normal: Vector3D) => void;
  onBodyCollision?: (other: RigidBody, relativeSpeed: number) => void;
}

export interface ArenaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class PhysicsWorld {
  private bodies: Map<string, RigidBody> = new Map();
  private arenaBounds: ArenaBounds = { minX: -16, maxX: 16, minZ: -20, maxZ: 20 };
  private readonly gravity: number = -28.0;

  constructor() {}

  public setArenaBounds(bounds: ArenaBounds): void {
    this.arenaBounds = bounds;
  }

  public getArenaBounds(): ArenaBounds {
    return this.arenaBounds;
  }

  public addBody(body: RigidBody): void {
    this.bodies.set(body.id, body);
  }

  public removeBody(id: string): void {
    this.bodies.delete(id);
  }

  public clear(): void {
    this.bodies.clear();
  }

  public step(dt: number): void {
    const bodyList = Array.from(this.bodies.values());

    // 1. Integration step
    for (let i = 0; i < bodyList.length; i++) {
      const body = bodyList[i];
      if (body.isStatic) continue;

      // Apply Gravity if airborne
      if (body.position.y > 0 || body.velocity.y > 0) {
        body.velocity.y += this.gravity * dt;
        body.isGrounded = false;
      } else {
        body.position.y = 0;
        if (body.velocity.y < 0) body.velocity.y = 0;
        body.isGrounded = true;
      }

      // Linear Drag
      const currentDrag = body.isGrounded ? body.drag : body.drag * 0.35;
      body.velocity.x *= Math.max(0, 1 - currentDrag * dt);
      body.velocity.z *= Math.max(0, 1 - currentDrag * dt);

      // Integrate Position
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.position.z += body.velocity.z * dt;

      // Ground clamp
      if (body.position.y < 0) {
        body.position.y = 0;
        body.velocity.y = 0;
        body.isGrounded = true;
      }

      // Arena Wall Boundary Collisions
      this.resolveArenaCollisions(body);
    }

    // 2. Body-to-Body Collisions (Domino & Separations)
    for (let i = 0; i < bodyList.length; i++) {
      for (let j = i + 1; j < bodyList.length; j++) {
        this.resolveBodyCollision(bodyList[i], bodyList[j]);
      }
    }
  }

  private resolveArenaCollisions(body: RigidBody): void {
    const r = body.radius;
    let hitWall = false;
    let impactNormal: Vector3D = { x: 0, y: 0, z: 0 };
    const impactSpeed = Math.hypot(body.velocity.x, body.velocity.z);

    if (body.position.x - r < this.arenaBounds.minX) {
      body.position.x = this.arenaBounds.minX + r;
      body.velocity.x = -body.velocity.x * body.bounce;
      impactNormal = { x: 1, y: 0, z: 0 };
      hitWall = true;
    } else if (body.position.x + r > this.arenaBounds.maxX) {
      body.position.x = this.arenaBounds.maxX - r;
      body.velocity.x = -body.velocity.x * body.bounce;
      impactNormal = { x: -1, y: 0, z: 0 };
      hitWall = true;
    }

    if (body.position.z - r < this.arenaBounds.minZ) {
      body.position.z = this.arenaBounds.minZ + r;
      body.velocity.z = -body.velocity.z * body.bounce;
      impactNormal = { x: 0, y: 0, z: 1 };
      hitWall = true;
    } else if (body.position.z + r > this.arenaBounds.maxZ) {
      body.position.z = this.arenaBounds.maxZ - r;
      body.velocity.z = -body.velocity.z * body.bounce;
      impactNormal = { x: 0, y: 0, z: -1 };
      hitWall = true;
    }

    if (hitWall && impactSpeed > 2.0 && body.onWallCollision) {
      body.onWallCollision(impactSpeed, impactNormal);
    }
  }

  private resolveBodyCollision(a: RigidBody, b: RigidBody): void {
    if (a.isStatic && b.isStatic) return;

    const dx = b.position.x - a.position.x;
    const dz = b.position.z - a.position.z;
    const dist = Math.hypot(dx, dz);
    const minDist = a.radius + b.radius;

    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;
      const overlap = minDist - dist;

      // Position push separation
      if (!a.isStatic && !b.isStatic) {
        a.position.x -= nx * overlap * 0.5;
        a.position.z -= nz * overlap * 0.5;
        b.position.x += nx * overlap * 0.5;
        b.position.z += nz * overlap * 0.5;
      } else if (!a.isStatic && b.isStatic) {
        a.position.x -= nx * overlap;
        a.position.z -= nz * overlap;
      } else if (a.isStatic && !b.isStatic) {
        b.position.x += nx * overlap;
        b.position.z += nz * overlap;
      }

      // Relative velocity & domino impulse
      const rvx = b.velocity.x - a.velocity.x;
      const rvz = b.velocity.z - a.velocity.z;
      const relSpeed = Math.hypot(rvx, rvz);

      if (a.onBodyCollision) a.onBodyCollision(b, relSpeed);
      if (b.onBodyCollision) b.onBodyCollision(a, relSpeed);

      // Domino momentum transfer (65% transfer)
      const aSpeed = Math.hypot(a.velocity.x, a.velocity.z);
      const bSpeed = Math.hypot(b.velocity.x, b.velocity.z);

      if (aSpeed > 5.0 && bSpeed < aSpeed) {
        b.velocity.x += a.velocity.x * 0.65;
        b.velocity.z += a.velocity.z * 0.65;
        a.velocity.x *= 0.45;
        a.velocity.z *= 0.45;
      } else if (bSpeed > 5.0 && aSpeed < bSpeed) {
        a.velocity.x += b.velocity.x * 0.65;
        a.velocity.z += b.velocity.z * 0.65;
        b.velocity.x *= 0.45;
        b.velocity.z *= 0.45;
      }
    }
  }
}
