import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

const groups = (membership: number, filter: number): number => (membership << 16) | filter;

export const GROUP_GROUND = 0x0001;
export const GROUP_VEHICLE = 0x0002;
export const GROUP_WALL = 0x0004;
export const GROUP_SENSOR = 0x0008;

export const GROUND_GROUPS = groups(GROUP_GROUND, GROUP_VEHICLE);
export const VEHICLE_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_VEHICLE | GROUP_WALL | GROUP_SENSOR);
export const WALL_GROUPS = groups(GROUP_WALL, GROUP_VEHICLE);
export const WHEEL_RAY_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND);

export class PhysicsWorld {
  world: RAPIER.World | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await RAPIER.init();
    // Gravity: -14 m/s² for tight, punchy arcade grip
    this.world = new RAPIER.World({ x: 0, y: -14, z: 0 });
    this.world.timestep = 1 / 60;
    this.isInitialized = true;
  }

  createTerrain(vertices: Float32Array, indices: Uint32Array): RAPIER.RigidBody {
    if (!this.world) throw new Error('PhysicsWorld not initialized');
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices).setFriction(1.2).setCollisionGroups(GROUND_GROUPS),
      body
    );
    return body;
  }

  createWallCollider(halfX: number, halfY: number, halfZ: number, posX: number, posY: number, posZ: number): RAPIER.RigidBody {
    if (!this.world) throw new Error('PhysicsWorld not initialized');
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(posX, posY, posZ)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ).setRestitution(0.3).setFriction(0.4).setCollisionGroups(WALL_GROUPS),
      body
    );
    return body;
  }

  createChassis(position: THREE.Vector3): RAPIER.RigidBody {
    if (!this.world) throw new Error('PhysicsWorld not initialized');
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y + 0.35, position.z)
        .setLinearDamping(0.05)
        .setAngularDamping(0.85)
        .setCcdEnabled(true)
    );

    // Box collider for vehicle chassis (half extents: width 0.95m, height 0.35m, length 2.1m)
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.95, 0.35, 2.1)
        .setFriction(0.4)
        .setRestitution(0.2)
        .setCollisionGroups(VEHICLE_GROUPS),
      body
    );

    return body;
  }

  createVehicleController(chassis: RAPIER.RigidBody): RAPIER.DynamicRayCastVehicleController {
    if (!this.world) throw new Error('PhysicsWorld not initialized');
    return this.world.createVehicleController(chassis);
  }

  step(): void {
    if (!this.world) return;
    this.world.step();
  }
}

export const physicsWorld = new PhysicsWorld();
