// src/physics/PhysicsWorld.ts
import RAPIER from '@dimforge/rapier3d-compat';

export interface BoxObstacle {
  x: number;
  y: number;
  z: number;
  hx: number; // half extent X
  hy: number; // half extent Y
  hz: number; // half extent Z
}

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  private rapier: typeof RAPIER | null = null;
  private world: RAPIER.World | null = null;
  private isInitialized: boolean = false;

  private staticColliders: RAPIER.Collider[] = [];

  private constructor() {}

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await RAPIER.init();
    this.rapier = RAPIER;

    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    this.world = new RAPIER.World(gravity);
    this.isInitialized = true;
  }

  public getWorld(): RAPIER.World {
    if (!this.world) {
      throw new Error('[PhysicsWorld] World not initialized. Call initialize() first.');
    }
    return this.world;
  }

  public getRapier(): typeof RAPIER {
    if (!this.rapier) {
      throw new Error('[PhysicsWorld] Rapier not initialized.');
    }
    return this.rapier;
  }

  public step(fixedDelta: number): void {
    if (this.world) {
      this.world.timestep = fixedDelta;
      this.world.step();
    }
  }

  public clearStaticColliders(): void {
    if (!this.world) return;
    for (const collider of this.staticColliders) {
      this.world.removeCollider(collider, true);
    }
    this.staticColliders = [];
  }

  public addStaticBox(obstacle: BoxObstacle): RAPIER.Collider | null {
    if (!this.world || !this.rapier) return null;

    const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(obstacle.x, obstacle.y, obstacle.z);
    const body = this.world.createRigidBody(bodyDesc);

    const colliderDesc = this.rapier.ColliderDesc.cuboid(obstacle.hx, obstacle.hy, obstacle.hz);
    const collider = this.world.createCollider(colliderDesc, body);

    this.staticColliders.push(collider);
    return collider;
  }

  public createPlayerBody(startX: number, startZ: number): { body: RAPIER.RigidBody; collider: RAPIER.Collider } | null {
    if (!this.world || !this.rapier) return null;

    const bodyDesc = this.rapier.RigidBodyDesc.dynamic()
      .setTranslation(startX, 0.5, startZ)
      .lockRotations() // Don't tip over
      .setLinearDamping(4.0)
      .setCcdEnabled(true);

    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.capsule(0.25, 0.35)
      .setFriction(0.2)
      .setRestitution(0.0);

    const collider = this.world.createCollider(colliderDesc, body);
    return { body, collider };
  }

  /**
   * Raycast check against static obstacles for vision occlusion
   */
  public castRay(
    originX: number,
    originY: number,
    originZ: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    maxDistance: number
  ): { hit: boolean; distance: number; hitPoint?: { x: number; y: number; z: number } } {
    if (!this.world || !this.rapier) {
      return { hit: false, distance: maxDistance };
    }

    const ray = new this.rapier.Ray(
      new this.rapier.Vector3(originX, originY, originZ),
      new this.rapier.Vector3(dirX, dirY, dirZ)
    );

    const hit = this.world.castRay(
      ray,
      maxDistance,
      true, // solid
      undefined,
      undefined,
      undefined,
      undefined,
      (collider) => {
        // Only collide with static environment obstacles (fences, barns, hay bales)
        return collider.parent()?.isFixed() ?? false;
      }
    );

    if (hit) {
      const hitPoint = {
        x: originX + dirX * hit.timeOfImpact,
        y: originY + dirY * hit.timeOfImpact,
        z: originZ + dirZ * hit.timeOfImpact
      };
      return { hit: true, distance: hit.timeOfImpact, hitPoint };
    }

    return { hit: false, distance: maxDistance };
  }
}

export const physicsWorld = PhysicsWorld.getInstance();
