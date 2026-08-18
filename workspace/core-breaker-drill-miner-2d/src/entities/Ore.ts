import * as Matter from 'matter-js';
import { Game } from '../core/Game.ts';

export type OreType = 'coal' | 'copper' | 'titanium' | 'plasma' | 'diamond';

interface OreConfig {
  value: number;
  color: number;
  radius: number;
}

const CONFIGS: Record<OreType, OreConfig> = {
  coal: { value: 1, color: 0x333333, radius: 4 },
  copper: { value: 3, color: 0xb87333, radius: 5 },
  titanium: { value: 8, color: 0xaaaaaa, radius: 5 },
  plasma: { value: 15, color: 0xff55ff, radius: 6 },
  diamond: { value: 50, color: 0x55ffff, radius: 7 }
};

export class Ore {
  private readonly game: Game;
  private readonly type: OreType;
  private readonly config: OreConfig;
  private body: Matter.Body;
  private alive = true;
  private magnetRange = 120;

  constructor(game: Game, type: OreType, x: number, y: number) {
    this.game = game;
    this.type = type;
    this.config = CONFIGS[type];
    this.body = Matter.Bodies.circle(x, y, this.config.radius, {
      isSensor: true,
      restitution: 0.2,
      frictionAir: 0.05,
      label: 'ore'
    });
    this.body.plugin = { onCollision: (other: Matter.Body) => this.onCollision(other) };
    this.game.physics.addBody(this.body);
  }

  update(_dt: number): void {
    if (!this.alive) return;
    const playerPos = this.game.player.getPosition();
    const dx = playerPos.x - this.body.position.x;
    const dy = playerPos.y - this.body.position.y;
    const dist = Math.hypot(dx, dy);

    if (dist < this.magnetRange && dist > 8) {
      const speed = 180;
      Matter.Body.setVelocity(this.body, { x: (dx / dist) * speed, y: (dy / dist) * speed });
    }
  }

  isAlive(): boolean {
    return this.alive;
  }

  getPosition(): { x: number; y: number } {
    return this.body.position;
  }

  getType(): OreType {
    return this.type;
  }

  getBody(): Matter.Body {
    return this.body;
  }

  getColor(): number {
    return this.config.color;
  }

  getRadius(): number {
    return this.config.radius;
  }

  collect(): void {
    if (!this.alive) return;
    this.alive = false;
    this.game.physics.removeBody(this.body);
    this.game.addOre(this.config.value);
  }

  private onCollision(other: Matter.Body): void {
    if (!this.alive) return;
    if (other.label === 'player') {
      this.collect();
    }
  }
}
