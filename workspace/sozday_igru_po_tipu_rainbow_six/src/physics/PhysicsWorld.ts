import RAPIER from "@dimforge/rapier3d-compat";
import { STATIC_GROUPS, DEBRIS_GROUPS } from "./CollisionGroups";

export class PhysicsWorld {
  public world!: RAPIER.World;
  private events!: RAPIER.EventQueue;
  private accumulator = 0;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -14, z: 0 });
    this.world.timestep = 1 / 60;
    this.events = new RAPIER.EventQueue(true);
    this.isInitialized = true;
  }

  update(scaledDt: number): void {
    if (!this.isInitialized) return;

    this.accumulator += Math.min(scaledDt, 0.1);
    let steps = 0;
    const fixedTime = this.world.timestep;

    while (this.accumulator >= fixedTime && steps < 4) {
      this.world.step(this.events);
      this.accumulator -= fixedTime;
      steps++;
    }

    if (steps === 4) {
      this.accumulator = 0;
    }
  }

  createStaticBox(
    x: number,
    y: number,
    z: number,
    hx: number,
    hy: number,
    hz: number,
    collisionGroups: number = STATIC_GROUPS
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setFriction(0.6)
      .setRestitution(0.1)
      .setCollisionGroups(collisionGroups);
    const collider = this.world.createCollider(colliderDesc, body);
    return { body, collider };
  }

  createDynamicDebris(
    x: number,
    y: number,
    z: number,
    hx: number,
    hy: number,
    hz: number,
    mass = 0.5,
    collisionGroups: number = DEBRIS_GROUPS
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinearDamping(0.8)
      .setAngularDamping(1.2)
      .setCcdEnabled(false);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setDensity(mass / (hx * hy * hz * 8))
      .setFriction(0.7)
      .setRestitution(0.2)
      .setCollisionGroups(collisionGroups);
    const collider = this.world.createCollider(colliderDesc, body);
    return { body, collider };
  }

  createCharacterController(offset = 0.05): RAPIER.KinematicCharacterController {
    const controller = this.world.createCharacterController(offset);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((38 * Math.PI) / 180);
    controller.enableAutostep(0.35, 0.2, true);
    controller.enableSnapToGround(0.4);
    controller.setApplyImpulsesToDynamicBodies(true);
    return controller;
  }

  castRay(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    maxToi: number,
    groups: number,
    excludedBody?: RAPIER.RigidBody
  ): { hit: boolean; toi: number; point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number }; collider?: RAPIER.Collider } {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxToi,
      true,
      undefined,
      groups,
      undefined,
      excludedBody
    );

    if (hit) {
      const hitPoint = ray.pointAt(hit.timeOfImpact);
      return {
        hit: true,
        toi: hit.timeOfImpact,
        point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
        normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
        collider: hit.collider,
      };
    }

    return {
      hit: false,
      toi: maxToi,
      point: { x: origin.x + dir.x * maxToi, y: origin.y + dir.y * maxToi, z: origin.z + dir.z * maxToi },
      normal: { x: 0, y: 1, z: 0 },
    };
  }

  removeRigidBody(body?: RAPIER.RigidBody): void {
    if (body) {
      try {
        this.world.removeRigidBody(body);
      } catch {}
    }
  }

  drainEvents(callback: (h1: number, h2: number, started: boolean) => void): void {
    if (this.events) {
      this.events.drainCollisionEvents(callback);
    }
  }
}
