/**
 * Player Character Entity (Nightingale Stealth Ranger)
 */

import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { SpriteFactory } from '../rendering/MeshPool';
import { PhysicsWorld, CollisionCategory } from '../physics/PhysicsWorld';
import { HidingBushInstance, TorchInstance, SaltCircleInstance } from './Weapon';
import { eventBus } from '../core/EventBus';

export interface PlayerStats {
  hp: number;
  maxHp: number;
  speed: number;
  stamina: number;
  maxStamina: number;
  staminaRegen: number;
  salt: number;
  maxSalt: number;
  herbs: number;
  coins: number;
  attackPower: number;
  critChance: number;
  torchDurationBonus: number;
  stealthBonus: number;
}

export class Player {
  public sprite: PIXI.Sprite;
  public body: Matter.Body;
  public stats: PlayerStats;

  // Stealth state
  public isHidden = false;
  public concealment = 0; // 0 to 1
  public isSpotted = false;

  // Actions & Cooldowns
  public facingAngle = 0;
  public attackCooldown = 0;
  public dashCooldown = 0;
  public isDashing = false;
  private dashTimer = 0;
  public isInvulnerable = false;
  private invulnerableTimer = 0;

  constructor(x: number, y: number, physics: PhysicsWorld, parent: PIXI.Container) {
    this.stats = {
      hp: 100,
      maxHp: 100,
      speed: 165,
      stamina: 100,
      maxStamina: 100,
      staminaRegen: 25,
      salt: 5,
      maxSalt: 8,
      herbs: 0,
      coins: 0,
      attackPower: 32,
      critChance: 0.15,
      torchDurationBonus: 1.0,
      stealthBonus: 1.0,
    };

    this.sprite = new PIXI.Sprite(SpriteFactory.getTexture('player'));
    this.sprite.anchor.set(0.5, 0.7);
    parent.addChild(this.sprite);

    this.body = Matter.Bodies.circle(x, y, 16, {
      frictionAir: 0.15,
      restitution: 0.05,
      collisionFilter: {
        category: CollisionCategory.PLAYER,
        mask: CollisionCategory.ENEMY | CollisionCategory.OBSTACLE | CollisionCategory.BUSH | CollisionCategory.TORCH | CollisionCategory.COLLECTIBLE,
      },
    });
    physics.addBody(this.body);
  }

  update(
    dt: number,
    inputX: number,
    inputY: number,
    bushes: HidingBushInstance[]
  ): void {
    // Cooldown timers
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.sprite.alpha = Math.sin(Date.now() / 50) > 0 ? 0.4 : 1.0;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
        this.sprite.alpha = 1.0;
      }
    }

    // Stamina regen
    if (this.stats.stamina < this.stats.maxStamina) {
      this.stats.stamina = Math.min(
        this.stats.maxStamina,
        this.stats.stamina + this.stats.staminaRegen * dt
      );
    }

    // Dash update
    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }

    // Locomotion
    const myX = this.body.position.x;
    const myY = this.body.position.y;

    const inputMag = Math.hypot(inputX, inputY);
    if (inputMag > 0.05) {
      const nx = inputX / inputMag;
      const ny = inputY / inputMag;
      this.facingAngle = Math.atan2(ny, nx);

      const moveSpeed = this.isDashing
        ? this.stats.speed * 2.5
        : this.isHidden
        ? this.stats.speed * 0.85
        : this.stats.speed;

      const vx = nx * (moveSpeed / 60);
      const vy = ny * (moveSpeed / 60);

      Matter.Body.setVelocity(this.body, {
        x: this.body.velocity.x * 0.75 + vx * 0.25,
        y: this.body.velocity.y * 0.75 + vy * 0.25,
      });

      this.sprite.scale.x = nx < 0 ? -1 : 1;
    }

    // Bush Concealment Check
    let insideBush = false;
    for (let i = 0; i < bushes.length; i++) {
      const b = bushes[i];
      const dist = Math.hypot(myX - b.x, myY - b.y);
      if (dist < b.radius + 8) {
        insideBush = true;
        break;
      }
    }

    if (insideBush) {
      this.concealment = Math.min(1.0, this.concealment + dt * 3.0);
      this.isHidden = this.concealment >= 0.7;
    } else {
      this.concealment = Math.max(0.0, this.concealment - dt * 4.0);
      this.isHidden = false;
    }

    // Emit stats
    eventBus.emit('player:stats', {
      hp: this.stats.hp,
      maxHp: this.stats.maxHp,
      salt: this.stats.salt,
      herbs: this.stats.herbs,
      coins: this.stats.coins,
      stamina: this.stats.stamina,
    });

    eventBus.emit('stealth:state', {
      isHidden: this.isHidden,
      concealment: this.concealment,
      isSpotted: this.isSpotted,
    });
  }

  dash(): boolean {
    if (this.dashCooldown > 0 || this.stats.stamina < 20) return false;

    this.stats.stamina -= 20;
    this.isDashing = true;
    this.dashTimer = 0.22;
    this.dashCooldown = 0.9;
    this.isInvulnerable = true;
    this.invulnerableTimer = 0.25;

    const nx = Math.cos(this.facingAngle);
    const ny = Math.sin(this.facingAngle);
    Matter.Body.setVelocity(this.body, {
      x: nx * (this.stats.speed * 2.8 / 60),
      y: ny * (this.stats.speed * 2.8 / 60),
    });

    eventBus.emit('action:dash', {
      x: this.body.position.x,
      y: this.body.position.y,
      dirX: nx,
      dirY: ny,
    });
    eventBus.emit('audio:sfx', { name: 'dash' });
    return true;
  }

  lightTorch(torches: TorchInstance[]): boolean {
    const myX = this.body.position.x;
    const myY = this.body.position.y;

    for (let i = 0; i < torches.length; i++) {
      const t = torches[i];
      const dist = Math.hypot(myX - t.x, myY - t.y);
      if (dist < 64 && !t.isLit) {
        t.light(45 * this.stats.torchDurationBonus);
        eventBus.emit('action:light_torch', { x: t.x, y: t.y, id: t.id });
        eventBus.emit('audio:sfx', { name: 'torch' });
        eventBus.emit('ui:fct', {
          text: '🔥 Факел зажжён!',
          x: t.x,
          y: t.y - 30,
          color: '#f2b134',
        });
        return true;
      }
    }
    return false;
  }

  drawSaltCircle(
    saltCircles: SaltCircleInstance[],
    createSaltCircleFn: (x: number, y: number) => SaltCircleInstance
  ): boolean {
    if (this.stats.salt <= 0) {
      eventBus.emit('ui:fct', {
        text: '🧂 Нет соли!',
        x: this.body.position.x,
        y: this.body.position.y - 20,
        color: '#ff8a80',
      });
      return false;
    }

    this.stats.salt -= 1;
    const myX = this.body.position.x;
    const myY = this.body.position.y;

    const circle = createSaltCircleFn(myX, myY);
    saltCircles.push(circle);

    eventBus.emit('action:draw_salt', {
      x: myX,
      y: myY,
      radius: circle.radius,
      id: circle.id,
    });
    eventBus.emit('audio:sfx', { name: 'salt' });
    eventBus.emit('ui:fct', {
      text: '✨ Защитный круг!',
      x: myX,
      y: myY - 30,
      color: '#ffffff',
    });
    return true;
  }

  takeDamage(amount: number): boolean {
    if (this.isInvulnerable) return false;

    this.stats.hp -= amount;
    this.isInvulnerable = true;
    this.invulnerableTimer = 0.5;

    eventBus.emit('audio:sfx', { name: 'hit' });

    if (this.stats.hp <= 0) {
      this.stats.hp = 0;
      return true; // Dead
    }
    return false;
  }

  revive(): void {
    this.stats.hp = Math.round(this.stats.maxHp * 0.5);
    this.isInvulnerable = true;
    this.invulnerableTimer = 3.0;
    this.sprite.alpha = 1.0;
  }

  destroy(physics: PhysicsWorld): void {
    physics.removeBody(this.body);
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }
}
