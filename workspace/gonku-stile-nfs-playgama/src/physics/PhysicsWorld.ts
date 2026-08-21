import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

const groups = (membership: number, filter: number): number => (membership << 16) | filter;

export const GROUP_GROUND   = 0x0001;
export const GROUP_VEHICLE  = 0x0002;
export const GROUP_ENEMY    = 0x0004;
export const GROUP_DEBRIS   = 0x0008;
export const GROUP_BREAKER  = 0x0010;
export const GROUP_SENSOR   = 0x0020;

export const GROUND_GROUPS  = groups(GROUP_GROUND, GROUP_VEHICLE | GROUP_ENEMY | GROUP_DEBRIS);
export const VEHICLE_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_VEHICLE | GROUP_ENEMY | GROUP_BREAKER | GROUP_DEBRIS);
export const WHEEL_RAY_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND);
export const ENEMY_GROUPS   = groups(GROUP_ENEMY, GROUP_GROUND | GROUP_VEHICLE | GROUP_ENEMY | GROUP_BREAKER | GROUP_DEBRIS);
export const BREAKER_GROUPS = groups(GROUP_BREAKER, GROUP_VEHICLE | GROUP_ENEMY);
export const DEBRIS_GROUPS  = groups(GROUP_DEBRIS, GROUP_GROUND | GROUP_VEHICLE | GROUP_ENEMY);

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  world: RAPIER.World | null = null;
  private isReady = false;

  static get(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  async initialize(): Promise<void> {
    if (this.isReady) return;
    await RAPIER.init();
    // Gravity y = -14 for dense grip & ground contact
    this.world = new RAPIER.World({ x: 0, y: -14, z: 0 });
    this.world.timestep = 1 / 60;
    this.isReady = true;
  }

  createGround(width = 400, length = 400): RAPIER.RigidBody {
    const world = this.world!;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, 0.5, length / 2)
        .setFriction(1.2)
        .setRestitution(0.05)
        .setCollisionGroups(GROUND_GROUPS),
      body
    );
    return body;
  }

  createChassis(position: THREE.Vector3, halfExtents = { x: 0.95, y: 0.45, z: 2.1 }): RAPIER.RigidBody {
    const world = this.world!;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.06)
        .setAngularDamping(0.85)
        .setCcdEnabled(true)
    );

    world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setFriction(0.6)
        .setRestitution(0.15)
        .setCollisionGroups(VEHICLE_GROUPS)
        .setDensity(1200),
      body
    );

    return body;
  }

  createVehicleController(chassis: RAPIER.RigidBody): RAPIER.DynamicRayCastVehicleController {
    return this.world!.createVehicleController(chassis);
  }

  createObstacle(pos: THREE.Vector3, size: THREE.Vector3, isStatic = true): RAPIER.RigidBody {
    const world = this.world!;
    const desc = isStatic ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
    desc.setTranslation(pos.x, pos.y, pos.z);
    const body = world.createRigidBody(desc);

    world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
        .setFriction(0.8)
        .setRestitution(0.2)
        .setCollisionGroups(isStatic ? GROUND_GROUPS : DEBRIS_GROUPS),
      body
    );
    return body;
  }

  createDebris(pos: THREE.Vector3, size: THREE.Vector3, mass = 50): RAPIER.RigidBody {
    const world = this.world!;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinearDamping(0.2)
        .setAngularDamping(0.5)
        .setCcdEnabled(true)
    );

    world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
        .setFriction(0.9)
        .setRestitution(0.3)
        .setDensity(mass)
        .setCollisionGroups(DEBRIS_GROUPS),
      body
    );
    return body;
  }

  removeRigidBody(body: RAPIER.RigidBody): void {
    if (this.world && body) {
      try {
        this.world.removeRigidBody(body);
      } catch {}
    }
  }

  step(): void {
    this.world?.step();
  }
}
