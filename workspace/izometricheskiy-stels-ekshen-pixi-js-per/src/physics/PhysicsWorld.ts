/**
 * Matter.js 2D Physics World Coordinator
 */

import Matter from 'matter-js';

export const CollisionCategory = {
  DEFAULT: 0x0001,
  PLAYER: 0x0002,
  ENEMY: 0x0004,
  OBSTACLE: 0x0008,
  BUSH: 0x0010,
  TORCH: 0x0020,
  SALT_CIRCLE: 0x0040,
  COLLECTIBLE: 0x0080,
  ATTACK_HITBOX: 0x0100,
} as const;

export class PhysicsWorld {
  public engine: Matter.Engine;
  public world: Matter.World;
  private accumulator = 0;
  private readonly fixedStep = 1000 / 60; // 16.66ms

  constructor() {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 }, // Top-down / isometric planar physics
      enableSleeping: false,
    });
    this.world = this.engine.world;
  }

  update(dtMs: number): void {
    // Clamp max delta time to 100ms to prevent tunnel/wall clipping
    const clampedDt = Math.min(100, dtMs);
    this.accumulator += clampedDt;

    while (this.accumulator >= this.fixedStep) {
      Matter.Engine.update(this.engine, this.fixedStep);
      this.accumulator -= this.fixedStep;
    }
  }

  resetAccumulator(): void {
    this.accumulator = 0;
  }

  addBody(body: Matter.Body): void {
    Matter.Composite.add(this.world, body);
  }

  removeBody(body: Matter.Body): void {
    Matter.Composite.remove(this.world, body);
  }

  clear(): void {
    Matter.Composite.clear(this.world, false);
  }

  /**
   * Raycast line of sight check against obstacles
   */
  hasLineOfSight(startX: number, startY: number, endX: number, endY: number, obstacles: Matter.Body[]): boolean {
    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;

    const steps = Math.ceil(dist / 16);
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 1; i < steps; i++) {
      const px = startX + stepX * i;
      const py = startY + stepY * i;
      for (let j = 0; j < obstacles.length; j++) {
        if (Matter.Bounds.contains(obstacles[j].bounds, { x: px, y: py })) {
          if (Matter.Vertices.contains(obstacles[j].vertices, { x: px, y: py })) {
            return false;
          }
        }
      }
    }

    return true;
  }
}
