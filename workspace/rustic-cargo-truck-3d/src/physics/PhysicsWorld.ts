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

  /** Static ground built from the very same buffers as the visible mesh, so physics can never disagree with the picture. */
  createTerrain(vertices: Float32Array, indices: Uint32Array): void {
    const world = this.requireWorld();
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices).setFriction(1).setCollisionGroups(GROUND_GROUPS),
      body,
    );
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

  createCargoBox(object: THREE.Object3D, position: THREE.Vector3, half: THREE.Vector3, mass: number): RAPIER.RigidBody {
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
        .setFriction(0.85)
        .setRestitution(0.01)
        .setCollisionGroups(CARGO_GROUPS),
      body,
    );
    this.bindings.push({ body, object });
    return body;
  }

  /** Log: a cylinder whose axis is rotated from local Y to local Z, matching the pre-rotated mesh geometry. */
  createCargoLog(object: THREE.Object3D, position: THREE.Vector3, radius: number, halfHeight: number, mass: number): RAPIER.RigidBody {
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
        .setFriction(0.75)
        .setRestitution(0.01)
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
