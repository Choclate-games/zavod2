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
    this.bindings.push({ body, object });
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
    this.bindings.push({ body, object });
    return body;
  }

  /** Log or Pipe: a cylinder whose axis is rotated from local Y to local Z, matching the pre-rotated mesh geometry. */
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
    this.bindings.push({ body, object });
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
    this.bindings.push({ body, object });
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
  }

  step(): void {
    this.requireWorld().step();
    for (const binding of this.bindings) {
      const p = binding.body.translation();
      const r = binding.body.rotation();
      binding.object.position.set(p.x, p.y, p.z);
      binding.object.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  private requireWorld(): RAPIER.World {
    if (!this.world) throw new Error('Physics world is not initialized');
    return this.world;
  }
}
