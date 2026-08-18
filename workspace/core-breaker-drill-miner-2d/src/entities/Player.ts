import * as Matter from 'matter-js';
import { Game } from '../core/Game.ts';
import { eventBus } from '../core/EventBus.ts';

const MOVE_SPEED = 180;
const DASH_SPEED = 500;
const DASH_COOLDOWN = 1.2;
const MAX_HP = 100;

export class Player {
  private readonly game: Game;
  private body: Matter.Body;
  private hp = MAX_HP;
  private maxHp = MAX_HP;
  private dashCooldown = 0;
  private dashTime = 0;
  private angle = 0;
  private radius = 18;

  constructor(game: Game) {
    this.game = game;
    this.body = Matter.Bodies.circle(0, 0, this.radius, {
      restitution: 0.2,
      friction: 0.05,
      frictionAir: 0.04,
      density: 0.005,
      label: 'player'
    });
  }

  init(): void {
    this.game.physics.addBody(this.body);
  }

  reset(): void {
    this.hp = this.maxHp;
    this.dashCooldown = 0;
    this.dashTime = 0;
    Matter.Body.setPosition(this.body, { x: 0, y: 0 });
    Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.body, 0);
  }

  update(dt: number): void {
    const input = this.game.input.getSnapshot();
    const vx = input.moveX * MOVE_SPEED;
    const vy = input.moveY * MOVE_SPEED;

    if (this.dashTime > 0) {
      this.dashTime -= dt;
    } else {
      Matter.Body.setVelocity(this.body, { x: vx, y: vy });
    }

    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (input.dash && this.dashCooldown <= 0 && (input.moveX !== 0 || input.moveY !== 0)) {
      this.dash(input.moveX, input.moveY);
    }

    if (input.moveX !== 0 || input.moveY !== 0) {
      this.angle = Math.atan2(input.moveY, input.moveX);
    }

    if (input.primary) {
      this.game.terrain.drillAt(this.body.position.x + Math.cos(this.angle) * this.radius, this.body.position.y + Math.sin(this.angle) * this.radius, dt);
    }
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    eventBus.emit('camera:shake', 6);
    if (this.hp <= 0) {
      eventBus.emit('player:died');
    }
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  getPosition(): { x: number; y: number } {
    return this.body.position;
  }

  getAngle(): number {
    return this.angle;
  }

  getRadius(): number {
    return this.radius;
  }

  getHp(): number {
    return this.hp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getBody(): Matter.Body {
    return this.body;
  }

  private dash(dx: number, dy: number): void {
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    Matter.Body.setVelocity(this.body, { x: nx * DASH_SPEED, y: ny * DASH_SPEED });
    this.dashTime = 0.15;
    this.dashCooldown = DASH_COOLDOWN;
    eventBus.emit('camera:shake', 4);
  }
}
