import RAPIER from '@dimforge/rapier3d-compat';
import { ARENA } from '../config/GameConfig';

/**
 * Physics Simulation Layer. Wraps a Rapier3D world with a fixed 60 Hz step and
 * the collision groups for the descent shaft. The world is created once and the
 * same bodies are reused across runs (teleport, not rebuild) to avoid leaks.
 */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  private accumulator = 0;
  private readonly fixedDt = 1 / 60;

  private constructor(world: RAPIER.World) {
    this.world = world;
  }

  /** Initialize the wasm runtime and build the arena. Must be awaited once. */
  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    world.timestep = 1 / 60;
    const inst = new PhysicsWorld(world);
    inst.buildArena();
    return inst;
  }

  private buildArena(): void {
    const t = ARENA.wallThickness;
    const hx = ARENA.halfX;
    const hz = ARENA.halfZ;
    const topY = ARENA.surfaceY + 1.5 + t / 2;
    const botY = ARENA.depthY - t / 2;
    const height = topY - botY;
    const midY = (topY + botY) / 2;

    // Rapier colliders are relative to their parent body, so we build one static
    // body per wall face with the correct local translation.
    const walls: Array<[number, number, number, number, number, number]> = [
      [hx + t / 2, height / 2, hz + t / 2, -hx - t / 2, midY, 0], // left
      [hx + t / 2, height / 2, hz + t / 2, hx + t / 2, midY, 0], // right
      [hx + t / 2, height / 2, hz + t / 2, 0, midY, -hz - t / 2], // back
      [hx + t / 2, height / 2, hz + t / 2, 0, midY, hz + t / 2], // front
      [hx + t / 2, t / 2, hz + t / 2, 0, topY, 0], // ceiling
      [hx + t / 2, t / 2, hz + t / 2, 0, botY, 0], // floor
    ];
    for (const [w, h, d, x, y, z] of walls) {
      const wb = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(w, h, d).setRestitution(0.1).setFriction(0.3),
        wb,
      );
    }
  }

  createDynamicBody(opts: {
    x: number; y: number; z: number;
    linearDamping: number;
    angularDamping: number;
    ccd?: boolean;
  }): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(opts.x, opts.y, opts.z)
      .setLinearDamping(opts.linearDamping)
      .setAngularDamping(opts.angularDamping);
    if (opts.ccd) desc.setCcdEnabled(true);
    return this.world.createRigidBody(desc);
  }

  attachBall(body: RAPIER.RigidBody, radius: number, restitution = 0.2, friction = 0.4): RAPIER.Collider {
    return this.world.createCollider(
      RAPIER.ColliderDesc.ball(radius).setRestitution(restitution).setFriction(friction).setDensity(1),
      body,
    );
  }

  attachCuboid(body: RAPIER.RigidBody, hx: number, hy: number, hz: number, restitution = 0.2): RAPIER.Collider {
    return this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setRestitution(restitution).setFriction(0.4),
      body,
    );
  }

  removeBody(body: RAPIER.RigidBody): void {
    this.world.removeRigidBody(body);
  }

  /** Advance physics with a frame delta accumulator (fixed step). */
  step(dt: number): void {
    this.accumulator += Math.min(dt, 0.1);
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < 6) {
      this.world.step();
      this.accumulator -= this.fixedDt;
      steps++;
    }
    if (this.accumulator > this.fixedDt * 6) this.accumulator = 0;
  }
}
