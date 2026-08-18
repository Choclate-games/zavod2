import * as Matter from 'matter-js';

export type PhysicsBody = Matter.Body;
export type CollisionPair = Matter.Pair;

export class PhysicsWorld {
  readonly engine: Matter.Engine;
  readonly world: Matter.World;
  private runner: Matter.Runner | null = null;

  constructor() {
    this.engine = Matter.Engine.create({
      enableSleeping: true,
      positionIterations: 6,
      velocityIterations: 4
    });
    this.world = this.engine.world;
    this.engine.gravity.y = 0;
    Matter.Events.on(this.engine, 'collisionStart', (e) => this.onCollisionStart(e));
  }

  private onCollisionStart(event: Matter.IEventCollision<Matter.Engine>): void {
    for (const pair of event.pairs) {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      this.dispatchPair(bodyA, bodyB, pair);
      this.dispatchPair(bodyB, bodyA, pair);
    }
  }

  private dispatchPair(body: PhysicsBody, other: PhysicsBody, pair: CollisionPair): void {
    const handler = body.plugin?.onCollision;
    if (typeof handler === 'function') {
      handler(other, pair);
    }
  }

  step(dt: number): void {
    Matter.Engine.update(this.engine, dt * 1000);
  }

  addBody(body: PhysicsBody): void {
    Matter.Composite.add(this.world, body);
  }

  removeBody(body: PhysicsBody): void {
    Matter.Composite.remove(this.world, body);
  }

  addConstraint(constraint: Matter.Constraint): void {
    Matter.Composite.add(this.world, constraint);
  }

  removeConstraint(constraint: Matter.Constraint): void {
    Matter.Composite.remove(this.world, constraint);
  }

  raycast(start: { x: number; y: number }, end: { x: number; y: number }): { body: Matter.Body; point: Matter.Vector; normal: Matter.Vector }[] {
    return Matter.Query.ray(this.world.bodies, start, end) as unknown as { body: Matter.Body; point: Matter.Vector; normal: Matter.Vector }[];
  }

  queryRadius(position: { x: number; y: number }, radius: number): PhysicsBody[] {
    return Matter.Query.region(this.world.bodies, {
      min: { x: position.x - radius, y: position.y - radius },
      max: { x: position.x + radius, y: position.y + radius }
    });
  }

  setGravity(y: number): void {
    this.engine.gravity.y = y;
  }

  destroy(): void {
    if (this.runner) {
      Matter.Runner.stop(this.runner);
      this.runner = null;
    }
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
  }
}
