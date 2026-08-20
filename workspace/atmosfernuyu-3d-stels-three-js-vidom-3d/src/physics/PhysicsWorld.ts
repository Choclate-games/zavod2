import * as THREE from 'three';

export enum CollisionLayer {
  NONE = 0,
  PLAYER = 1 << 0,
  ENEMY = 1 << 1,
  WEAPON = 1 << 2,
  LOOT = 1 << 3,
  OBSTACLE = 1 << 4,
  ALL = ~0,
}

export interface RigidBodyDesc {
  radius?: number;
  halfExtents?: THREE.Vector3;
  mass?: number;
  drag?: number;
  layer?: CollisionLayer;
  mask?: CollisionLayer;
  isSensor?: boolean;
}

export class RigidBody {
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public angularVelocity = new THREE.Vector3();
  public rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  public radius = 0.5;
  public halfExtents: THREE.Vector3 | null = null;
  public mass = 1.0;
  public invMass = 1.0;
  public drag = 0.92;
  public restitution = 0.3;
  public layer: CollisionLayer = CollisionLayer.ALL;
  public mask: CollisionLayer = CollisionLayer.ALL;
  public isSensor = false;
  public isStatic = false;
  public isActive = true;
  public userData: any = null;

  constructor(desc: RigidBodyDesc = {}) {
    if (desc.radius !== undefined) this.radius = desc.radius;
    if (desc.halfExtents) this.halfExtents = desc.halfExtents.clone();
    if (desc.mass !== undefined) {
      this.mass = desc.mass;
      this.invMass = desc.mass > 0 ? 1 / desc.mass : 0;
      this.isStatic = desc.mass === 0;
    }
    if (desc.drag !== undefined) this.drag = desc.drag;
    if (desc.layer !== undefined) this.layer = desc.layer;
    if (desc.mask !== undefined) this.mask = desc.mask;
    if (desc.isSensor !== undefined) this.isSensor = desc.isSensor;
  }

  applyImpulse(impulse: THREE.Vector3): void {
    if (this.isStatic) return;
    this.velocity.addScaledVector(impulse, this.invMass);
  }

  teleport(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
  }
}

export class PhysicsWorld {
  private bodies: RigidBody[] = [];
  public gravity = new THREE.Vector3(0, -9.81, 0);

  addBody(body: RigidBody): void {
    if (!this.bodies.includes(body)) {
      this.bodies.push(body);
    }
  }

  removeBody(body: RigidBody): void {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) {
      this.bodies.splice(idx, 1);
    }
  }

  step(dt: number): void {
    // 1. Integrate velocities & apply ground plane constraints
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (!b.isActive || b.isStatic) continue;

      // Integrate
      b.position.addScaledVector(b.velocity, dt);
      b.velocity.multiplyScalar(Math.pow(b.drag, dt * 60));

      // Simple ground clamp (Y >= radius)
      if (b.position.y < b.radius) {
        b.position.y = b.radius;
        if (b.velocity.y < 0) b.velocity.y = -b.velocity.y * b.restitution;
      }

      // Arena boundary clamp [-28, 28]
      const BOUND = 28;
      if (Math.abs(b.position.x) > BOUND) {
        b.position.x = Math.sign(b.position.x) * BOUND;
        b.velocity.x *= -0.5;
      }
      if (Math.abs(b.position.z) > BOUND) {
        b.position.z = Math.sign(b.position.z) * BOUND;
        b.velocity.z *= -0.5;
      }
    }

    // 2. Solve sphere vs sphere / box collisions
    for (let i = 0; i < this.bodies.length; i++) {
      const a = this.bodies[i];
      if (!a.isActive) continue;

      for (let j = i + 1; j < this.bodies.length; j++) {
        const b = this.bodies[j];
        if (!b.isActive) continue;

        if (!(a.layer & b.mask) || !(b.layer & a.mask)) continue;

        this.resolveCollision(a, b);
      }
    }
  }

  private resolveCollision(a: RigidBody, b: RigidBody): void {
    const dx = b.position.x - a.position.x;
    const dz = b.position.z - a.position.z;
    const distSq = dx * dx + dz * dz;
    const minDist = a.radius + b.radius;

    if (distSq < minDist * minDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      const nx = dx / dist;
      const nz = dz / dist;

      if (!a.isSensor && !b.isSensor) {
        const totalMass = a.invMass + b.invMass;
        if (totalMass > 0) {
          const pushA = (a.invMass / totalMass) * overlap;
          const pushB = (b.invMass / totalMass) * overlap;

          if (!a.isStatic) {
            a.position.x -= nx * pushA;
            a.position.z -= nz * pushA;
          }
          if (!b.isStatic) {
            b.position.x += nx * pushB;
            b.position.z += nz * pushB;
          }

          // Relative velocity impulse
          const rvx = b.velocity.x - a.velocity.x;
          const rvz = b.velocity.z - a.velocity.z;
          const velAlongNormal = rvx * nx + rvz * nz;

          if (velAlongNormal < 0) {
            const e = Math.min(a.restitution, b.restitution);
            const impulse = -(1 + e) * velAlongNormal / totalMass;
            if (!a.isStatic) {
              a.velocity.x -= nx * impulse * a.invMass;
              a.velocity.z -= nz * impulse * a.invMass;
            }
            if (!b.isStatic) {
              b.velocity.x += nx * impulse * b.invMass;
              b.velocity.z += nz * impulse * b.invMass;
            }
          }
        }
      }
    }
  }

  clear(): void {
    this.bodies = [];
  }
}
