import RAPIER from '@dimforge/rapier3d-compat';
import { CONFIG } from '../core/Config';

const groups = (membership: number, filter: number): number => (membership << 16) | filter;

export const GROUP_GROUND = 0x0001;
export const GROUP_VEHICLE = 0x0002;
export const GROUP_CARGO = 0x0004;

export const GROUND_GROUPS = groups(GROUP_GROUND, GROUP_VEHICLE | GROUP_CARGO);
export const VEHICLE_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_VEHICLE | GROUP_CARGO);
export const WHEEL_RAY_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND);

export class PhysicsWorld {
  world: RAPIER.World | null = null;
  private isReady = false;
  private roadColliders: RAPIER.RigidBody[] = [];

  async initialize(): Promise<void> {
    if (this.isReady) return;
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: CONFIG.physics.gravityY, z: 0 });
    this.world.timestep = CONFIG.physics.fixedTimestep;
    this.isReady = true;
  }

  createChassis(pos: { x: number; y: number; z: number }, mass = 1300): RAPIER.RigidBody {
    if (!this.world) throw new Error('PhysicsWorld not initialized');
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(0.08)
      .setAngularDamping(0.90)
      .setCcdEnabled(true);

    const body = this.world.createRigidBody(rigidBodyDesc);

    // Collider box for body hits (width 1.7, height 0.5, length 3.9)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.85, 0.25, 1.95)
      .setDensity(mass / (1.7 * 0.5 * 3.9))
      .setCollisionGroups(VEHICLE_GROUPS)
      .setTranslation(0, 0.35, 0);

    this.world.createCollider(colliderDesc, body);
    return body;
  }

  createVehicle(chassis: RAPIER.RigidBody): RAPIER.DynamicRayCastVehicleController {
    if (!this.world) throw new Error('PhysicsWorld not initialized');
    return this.world.createVehicleController(chassis);
  }

  createRoadSegment(x: number, y: number, z: number, width: number, length: number): RAPIER.RigidBody {
    if (!this.world) throw new Error('PhysicsWorld not initialized');
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z)
    );
    const collider = RAPIER.ColliderDesc.cuboid(width / 2, 0.5, length / 2)
      .setFriction(1.0)
      .setCollisionGroups(GROUND_GROUPS);
    this.world.createCollider(collider, body);
    this.roadColliders.push(body);
    return body;
  }

  createTrimeshTerrain(vertices: Float32Array, indices: Uint32Array): RAPIER.RigidBody {
    if (!this.world) throw new Error('PhysicsWorld not initialized');
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices)
        .setFriction(1.0)
        .setCollisionGroups(GROUND_GROUPS),
      body
    );
    return body;
  }

  step(): void {
    if (!this.world) return;
    this.world.step();
  }
}

export const physicsWorld = new PhysicsWorld();
