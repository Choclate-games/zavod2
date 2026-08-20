import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

const groups = (membership: number, filter: number): number => (membership << 16) | filter;

export const GROUP_GROUND = 0x0001;
export const GROUP_VEHICLE = 0x0002;
export const GROUP_CARGO = 0x0004;

export const GROUND_GROUPS = groups(GROUP_GROUND, GROUP_VEHICLE | GROUP_CARGO);
export const VEHICLE_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_CARGO);
export const CARGO_GROUPS = groups(GROUP_CARGO, GROUP_GROUND | GROUP_VEHICLE | GROUP_CARGO);
/** Wheel ray-casts must see the ground and nothing else — not the cargo, not the truck itself. */
export const WHEEL_RAY_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND);

interface BodyBinding {
  body: RAPIER.RigidBody;
  object: THREE.Object3D;
  /** When true, this binding is excluded from interpolate() — the caller handles it (e.g. TruckController). */
  skipInterp?: boolean;
  // Prev/curr snapshots for sub-step interpolation (populated by step())
  prevX: number; prevY: number; prevZ: number;
  prevQx: number; prevQy: number; prevQz: number; prevQw: number;
  currX: number; currY: number; currZ: number;
  currQx: number; currQy: number; currQz: number; currQw: number;
}

export class PhysicsWorld {
  world: RAPIER.World | null = null;
  private readonly bindings: BodyBinding[] = [];

  async initialize(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -14, z: 0 });
    this.world.timestep = 1 / 60;
  }

  private terrainBody: RAPIER.RigidBody | null = null;
  private obstacleBodies: RAPIER.RigidBody[] = [];

  createTerrain(vertices: Float32Array, indices: Uint32Array): void {
    const world = this.requireWorld();
    if (this.terrainBody) {
      world.removeRigidBody(this.terrainBody);
      this.terrainBody = null;
    }
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices).setFriction(1).setCollisionGroups(GROUND_GROUPS),
      body,
    );
    this.terrainBody = body;
  }

  clearObstacles(): void {
    const world = this.requireWorld();
    for (const body of this.obstacleBodies) {
      world.removeRigidBody(body);
    }
    this.obstacleBodies = [];
  }

  createObstacle(position: THREE.Vector3, radius: number): void {
    const world = this.requireWorld();
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(radius).setFriction(0.8).setRestitution(0.05).setCollisionGroups(GROUND_GROUPS),
      body,
    );
    this.obstacleBodies.push(body);
  }

  createTreeCollider(position: THREE.Vector3, radius: number, halfHeight: number): void {
    const world = this.requireWorld();
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y + halfHeight, position.z),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfHeight, radius).setFriction(0.9).setRestitution(0.05).setCollisionGroups(GROUND_GROUPS),
      body,
    );
    this.obstacleBodies.push(body);
  }




  createChassis(object: THREE.Object3D, position: THREE.Vector3): RAPIER.RigidBody {
    const world = this.requireWorld();
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.08)
        .setAngularDamping(0.9)
        .setCcdEnabled(true),
    );
    // TruckController.render(alpha) handles chassis interpolation itself.
    this.bindings.push({
      body, object, skipInterp: true,
      prevX: position.x, prevY: position.y, prevZ: position.z,
      prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1,
      currX: position.x, currY: position.y, currZ: position.z,
      currQx: 0, currQy: 0, currQz: 0, currQw: 1,
    });
    return body;
  }

  addBoxCollider(body: RAPIER.RigidBody, half: THREE.Vector3, offset: THREE.Vector3, mass: number): void {
    this.requireWorld().createCollider(
      RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setTranslation(offset.x, offset.y, offset.z)
        .setMass(mass)
        .setFriction(0.6)
        .setRestitution(0.02)
        .setCollisionGroups(VEHICLE_GROUPS),
      body,
    );
  }

  removeBody(body: RAPIER.RigidBody): void {
    const world = this.requireWorld();
    const idx = this.bindings.findIndex((b) => b.body === body);
    if (idx !== -1) this.bindings.splice(idx, 1);
    try {
      world.removeRigidBody(body);
    } catch {
      // Body may already be removed
    }
  }

  createCargoBox(
    object: THREE.Object3D,
    position: THREE.Vector3,
    half: THREE.Vector3,
    mass: number,
    friction = 0.85,
    restitution = 0.01,
  ): RAPIER.RigidBody {
    const world = this.requireWorld();
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.12)
        .setAngularDamping(0.5)
        .setCcdEnabled(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setMass(mass)
        .setFriction(friction)
        .setRestitution(restitution)
        .setCollisionGroups(CARGO_GROUPS),
      body,
    );
    this.bindings.push({
      body, object,
      prevX: position.x, prevY: position.y, prevZ: position.z,
      prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1,
      currX: position.x, currY: position.y, currZ: position.z,
      currQx: 0, currQy: 0, currQz: 0, currQw: 1,
    });
    return body;
  }
  createCargoLog(
    object: THREE.Object3D,
    position: THREE.Vector3,
    radius: number,
    halfHeight: number,
    mass: number,
    friction = 0.75,
    restitution = 0.01,
  ): RAPIER.RigidBody {
    const world = this.requireWorld();
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.12)
        .setAngularDamping(0.6)
        .setCcdEnabled(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfHeight, radius)
        .setRotation({ x: Math.sin(Math.PI / 4), y: 0, z: 0, w: Math.cos(Math.PI / 4) })
        .setMass(mass)
        .setFriction(friction)
        .setRestitution(restitution)
        .setCollisionGroups(CARGO_GROUPS),
      body,
    );
    this.bindings.push({
      body, object,
      prevX: position.x, prevY: position.y, prevZ: position.z,
      prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1,
      currX: position.x, currY: position.y, currZ: position.z,
      currQx: 0, currQy: 0, currQz: 0, currQw: 1,
    });
    return body;
  }

  /** Upright standing barrel / drum cylinder */
  createCargoBarrel(
    object: THREE.Object3D,
    position: THREE.Vector3,
    radius: number,
    halfHeight: number,
    mass: number,
    friction = 0.65,
    restitution = 0.03,
  ): RAPIER.RigidBody {
    const world = this.requireWorld();
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.12)
        .setAngularDamping(0.55)
        .setCcdEnabled(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfHeight, radius)
        .setMass(mass)
        .setFriction(friction)
        .setRestitution(restitution)
        .setCollisionGroups(CARGO_GROUPS),
      body,
    );
    this.bindings.push({
      body, object,
      prevX: position.x, prevY: position.y, prevZ: position.z,
      prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1,
      currX: position.x, currY: position.y, currZ: position.z,
      currQx: 0, currQy: 0, currQz: 0, currQw: 1,
    });
    return body;
  }

  createVehicle(chassis: RAPIER.RigidBody): RAPIER.DynamicRayCastVehicleController {
    return this.requireWorld().createVehicleController(chassis);
  }

  /** Teleport a body without leaving stale momentum behind — the only correct way to respawn. */
  placeBody(body: RAPIER.RigidBody, position: THREE.Vector3, yaw = 0): void {
    body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.resetForces(true);
    body.resetTorques(true);
    body.wakeUp();
    // Sync interpolation snapshots to the new position so there's no lerp artefact on the next frame.
    const binding = this.bindings.find((b) => b.body === body);
    if (binding) {
      const qy = Math.sin(yaw / 2), qw = Math.cos(yaw / 2);
      binding.prevX = binding.currX = position.x;
      binding.prevY = binding.currY = position.y;
      binding.prevZ = binding.currZ = position.z;
      binding.prevQx = binding.currQx = 0;
      binding.prevQy = binding.currQy = qy;
      binding.prevQz = binding.currQz = 0;
      binding.prevQw = binding.currQw = qw;
    }
  }

  step(): void {
    // 1. Save previous positions BEFORE the physics tick (for render interpolation).
    for (const b of this.bindings) {
      b.prevX = b.currX; b.prevY = b.currY; b.prevZ = b.currZ;
      b.prevQx = b.currQx; b.prevQy = b.currQy; b.prevQz = b.currQz; b.prevQw = b.currQw;
    }

    // 2. Advance physics.
    this.requireWorld().step();

    // 3. Read new state into snapshots and update Three.js objects (so the scene graph
    //    stays in sync for game logic that reads mesh positions after step()).
    for (const b of this.bindings) {
      const p = b.body.translation();
      const r = b.body.rotation();
      b.currX = p.x; b.currY = p.y; b.currZ = p.z;
      b.currQx = r.x; b.currQy = r.y; b.currQz = r.z; b.currQw = r.w;
      // Write the current (non-interpolated) state to the object — will be overwritten
      // by interpolate(alpha) in the render pass for smoother visuals.
      b.object.position.set(p.x, p.y, p.z);
      b.object.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /**
   * Call once per render frame (after all fixedUpdate steps, before renderer.render).
   * Blends each bound Three.js object between its prev and curr physics positions using
   * the fractional sub-step alpha, producing smooth motion at any frame rate.
   * Objects with skipInterp=true are skipped (they handle their own interpolation).
   */
  interpolate(alpha: number): void {
    const invA = 1 - alpha;
    for (const b of this.bindings) {
      if (b.skipInterp) continue;
      b.object.position.set(
        b.prevX * invA + b.currX * alpha,
        b.prevY * invA + b.currY * alpha,
        b.prevZ * invA + b.currZ * alpha,
      );
      // Slerp quaternion: use dot-product to pick shortest arc
      let dot = b.prevQx * b.currQx + b.prevQy * b.currQy + b.prevQz * b.currQz + b.prevQw * b.currQw;
      let cx = b.currQx, cy = b.currQy, cz = b.currQz, cw = b.currQw;
      if (dot < 0) { cx = -cx; cy = -cy; cz = -cz; cw = -cw; dot = -dot; }
      if (dot > 0.9995) {
        // Quaternions nearly identical — just lerp
        b.object.quaternion.set(
          b.prevQx * invA + cx * alpha,
          b.prevQy * invA + cy * alpha,
          b.prevQz * invA + cz * alpha,
          b.prevQw * invA + cw * alpha,
        ).normalize();
      } else {
        const theta0 = Math.acos(dot);
        const theta = theta0 * alpha;
        const sinT = Math.sin(theta);
        const sinT0 = Math.sin(theta0);
        const s0 = Math.cos(theta) - dot * sinT / sinT0;
        const s1 = sinT / sinT0;
        b.object.quaternion.set(
          b.prevQx * s0 + cx * s1,
          b.prevQy * s0 + cy * s1,
          b.prevQz * s0 + cz * s1,
          b.prevQw * s0 + cw * s1,
        );
      }
    }
  }

  private requireWorld(): RAPIER.World {
    if (!this.world) throw new Error('Physics world is not initialized');
    return this.world;
  }
}
