import * as Matter from 'matter-js';
import { Game } from '../core/Game.ts';
import { eventBus } from '../core/EventBus.ts';

const MAX_HP = 1500;

export class Boss {
  private readonly game: Game;
  private body: Matter.Body;
  private hp = MAX_HP;
  private maxHp = MAX_HP;
  private radius = 48;
  private phase = 1;
  private attackCooldown = 0;
  private spawnCooldown = 0;
  private alive = true;

  constructor(game: Game, x: number, y: number) {
    this.game = game;
    this.body = Matter.Bodies.rectangle(x, y, this.radius * 2, this.radius * 2, {
      restitution: 0.1,
      friction: 0.05,
      frictionAir: 0.08,
      density: 0.02,
      label: 'boss'
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
    const speed = this.phase === 1 ? 55 : 85;

    if (dist > 30) {
      Matter.Body.setVelocity(this.body, { x: (dx / dist) * speed, y: (dy / dist) * speed });
    }

    this.attackCooldown -= dt;
    this.spawnCooldown -= dt;

    if (this.attackCooldown <= 0 && dist < 120) {
      this.game.player.takeDamage(20);
      this.attackCooldown = 1.5;
      eventBus.emit('camera:shake', 10);
    }

    if (this.spawnCooldown <= 0) {
      eventBus.emit('boss:spawn-minion', { x: this.body.position.x, y: this.body.position.y });
      this.spawnCooldown = 6;
    }

    const ratio = this.hp / this.maxHp;
    if (ratio < 0.5 && this.phase === 1) {
      this.phase = 2;
      this.attackCooldown = 0;
    }
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

  getPosition(): { x: number; y: number } {
    return this.body.position;
  }

  getHpRatio(): number {
    return this.hp / this.maxHp;
  }

  getRadius(): number {
    return this.radius;
  }

  getPhase(): number {
    return this.phase;
  }

  getBody(): Matter.Body {
    return this.body;
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.game.physics.removeBody(this.body);
  }

  private onCollision(other: Matter.Body): void {
    if (!this.alive) return;
    if (other.label === 'player' && this.attackCooldown <= 0) {
      this.game.player.takeDamage(20);
      this.attackCooldown = 1.5;
    }
  }

  private die(): void {
    this.alive = false;
    this.game.physics.removeBody(this.body);
    eventBus.emit('boss:defeated');
  }
}
