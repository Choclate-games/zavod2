import * as Matter from 'matter-js';
import { Game } from '../core/Game.ts';
import { eventBus } from '../core/EventBus.ts';

export type EnemyType = 'grub' | 'scarab' | 'crystal';

interface EnemyConfig {
  radius: number;
  hp: number;
  speed: number;
  damage: number;
  color: number;
}

const CONFIGS: Record<EnemyType, EnemyConfig> = {
  grub: { radius: 12, hp: 30, speed: 60, damage: 8, color: 0x88aa55 },
  scarab: { radius: 16, hp: 60, speed: 90, damage: 12, color: 0xaa5555 },
  crystal: { radius: 20, hp: 120, speed: 40, damage: 18, color: 0x55aaff }
};

export class Enemy {
  private readonly game: Game;
  private readonly type: EnemyType;
  private readonly config: EnemyConfig;
  private body: Matter.Body;
  private hp: number;
  private alive = true;
  private attackCooldown = 0;

  constructor(game: Game, type: EnemyType, x: number, y: number) {
    this.game = game;
    this.type = type;
    this.config = CONFIGS[type];
    this.hp = this.config.hp;
    this.body = Matter.Bodies.circle(x, y, this.config.radius, {
      restitution: 0.4,
      friction: 0.05,
      frictionAir: 0.06,
      density: 0.003,
      label: 'enemy'
    });
    this.body.plugin = { onCollision: (other: Matter.Body) => this.onCollision(other) };
    this.game.physics.addBody(this.body);
  }

  update(dt: number): void {
    if (!this.alive) return;
    const playerPos = this.game.player.getPosition();
    const dx = playerPos.x - this.body.position.x;
    const dy = playerPos.y - this.body.position.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 10) {
      const speed = this.config.speed;
      Matter.Body.setVelocity(this.body, { x: (dx / dist) * speed, y: (dy / dist) * speed });
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.die();
    }
  }

  isAlive(): boolean {
    return this.alive;
  }

  getBody(): Matter.Body {
    return this.body;
  }

  getType(): EnemyType {
    return this.type;
  }

  getPosition(): { x: number; y: number } {
    return this.body.position;
  }

  getRadius(): number {
    return this.config.radius;
  }

  getColor(): number {
    return this.config.color;
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.game.physics.removeBody(this.body);
  }

  private onCollision(other: Matter.Body): void {
    if (!this.alive) return;
    if (other.label === 'player' && this.attackCooldown <= 0) {
      this.game.player.takeDamage(this.config.damage);
      this.attackCooldown = 0.8;
    }
  }

  private die(): void {
    this.alive = false;
    this.game.physics.removeBody(this.body);
    eventBus.emit('enemy:died', { x: this.body.position.x, y: this.body.position.y, type: this.type });
    this.game.combat.spawnOre(this.body.position.x, this.body.position.y, this.type === 'crystal' ? 5 : 1);
  }
}
