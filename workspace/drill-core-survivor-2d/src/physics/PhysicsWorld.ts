import Matter from 'matter-js';
import { eventBus } from '../core/EventBus';

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  public engine: Matter.Engine;
  public world: Matter.World;
  private readonly fixedDeltaTime: number = 1000 / 60; // 16.666 ms

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  constructor() {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
      enableSleeping: false,
      positionIterations: 6,
      velocityIterations: 4,
    });
    this.world = this.engine.world;

    this.setupCollisionEvents();
  }

  private setupCollisionEvents(): void {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        eventBus.emit('physics:collision_start', pair);
      }
    });
  }

  public update(dtMs: number): void {
    // Fixed timestep step
    const clampedDt = Math.min(dtMs, 100);
    Matter.Engine.update(this.engine, this.fixedDeltaTime);
  }

  public addBody(body: Matter.Body): void {
    Matter.Composite.add(this.world, body);
  }

  public removeBody(body: Matter.Body): void {
    Matter.Composite.remove(this.world, body);
  }

  public clear(): void {
    Matter.Composite.clear(this.world, false);
  }

  public queryRadius(x: number, y: number, radius: number, categories?: number): Matter.Body[] {
    const bodies = Matter.Composite.allBodies(this.world);
    const result: Matter.Body[] = [];
    const rSq = radius * radius;

    for (const b of bodies) {
      if (categories !== undefined && (b.collisionFilter.category! & categories) === 0) {
        continue;
      }
      const dx = b.position.x - x;
      const dy = b.position.y - y;
      if (dx * dx + dy * dy <= rSq) {
        result.push(b);
      }
    }
    return result;
  }

  public applyRadialExplosion(x: number, y: number, radius: number, forceMagnitude: number): void {
    const bodies = this.queryRadius(x, y, radius);
    for (const b of bodies) {
      if (b.isStatic) continue;
      const dx = b.position.x - x;
      const dy = b.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const factor = Math.max(0, 1 - dist / radius);
      const fx = (dx / dist) * forceMagnitude * factor;
      const fy = (dy / dist) * forceMagnitude * factor;
      Matter.Body.applyForce(b, b.position, { x: fx, y: fy });
    }
  }
}

export const physicsWorld = PhysicsWorld.getInstance();
