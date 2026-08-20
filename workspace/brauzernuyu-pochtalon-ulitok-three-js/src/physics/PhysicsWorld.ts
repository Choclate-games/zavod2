import RAPIER from '@dimforge/rapier3d-compat';

interface PhysicsBody {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

export interface PhysicsPosition {
  x: number;
  y: number;
  z: number;
}

export class PhysicsWorld {
  private world: RAPIER.World | null = null;
  private readonly bodies = new Map<number, PhysicsBody>();
  private nextHandle = 1;

  public async initialize(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.05, 24).setFriction(0.9), ground);
  }

  public createSnailBody(x: number, z: number): number {
    if (!this.world) throw new Error('Physics world is not initialized');
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0.32, z),
    );
    const collider = this.world.createCollider(RAPIER.ColliderDesc.ball(0.3).setFriction(0.8), body);
    const handle = this.nextHandle++;
    this.bodies.set(handle, { body, collider });
    return handle;
  }

  public moveKinematic(handle: number, x: number, z: number): void {
    const body = this.bodies.get(handle)?.body;
    body?.setNextKinematicTranslation({ x, y: 0.32, z });
  }

  public getPosition(handle: number, target: PhysicsPosition): void {
    const translation = this.bodies.get(handle)?.body.translation();
    if (!translation) return;
    target.x = translation.x;
    target.y = translation.y;
    target.z = translation.z;
  }

  public step(): void {
    this.world?.step();
  }

  public dispose(): void {
    this.bodies.clear();
    this.world = null;
  }
}
