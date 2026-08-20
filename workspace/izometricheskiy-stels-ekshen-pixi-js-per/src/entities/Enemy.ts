/**
 * Enemy AI Entities: Wisps, Shadow Wolves & Leshy (Ancient Forest Boss)
 */

import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { SpriteFactory } from '../rendering/MeshPool';
import { PhysicsWorld, CollisionCategory } from '../physics/PhysicsWorld';
import { TorchInstance, SaltCircleInstance } from './Weapon';

export type EnemyType = 'wisp' | 'wolf' | 'leshy';
export type EnemyAIState = 'patrol' | 'investigate' | 'chase' | 'flee' | 'attack_cooldown';

export class Enemy {
  public id: string;
  public type: EnemyType;
  public hp: number;
  public maxHp: number;
  public speed: number;
  public damage: number;
  public state: EnemyAIState = 'patrol';

  public sprite: PIXI.Sprite;
  public body: Matter.Body;

  // AI & Pathfinding
  public patrolX: number;
  public patrolY: number;
  public targetX: number;
  public targetY: number;
  public visionRadius: number;
  public visionAngle = Math.PI * 0.75;
  public headingAngle = Math.random() * Math.PI * 2;
  
  private stateTimer = 0;
  private attackCooldown = 0;
  private animTimer = Math.random() * 10;
  public isDead = false;

  constructor(
    id: string,
    type: EnemyType,
    x: number,
    y: number,
    physics: PhysicsWorld,
    parent: PIXI.Container
  ) {
    this.id = id;
    this.type = type;
    this.patrolX = x;
    this.patrolY = y;
    this.targetX = x;
    this.targetY = y;

    switch (type) {
      case 'wisp':
        this.maxHp = 30;
        this.hp = 30;
        this.speed = 110;
        this.damage = 10;
        this.visionRadius = 220;
        break;
      case 'wolf':
        this.maxHp = 65;
        this.hp = 65;
        this.speed = 145;
        this.damage = 22;
        this.visionRadius = 180;
        break;
      case 'leshy':
        this.maxHp = 450;
        this.hp = 450;
        this.speed = 80;
        this.damage = 38;
        this.visionRadius = 280;
        break;
    }

    this.sprite = new PIXI.Sprite(SpriteFactory.getTexture(type));
    this.sprite.anchor.set(0.5, type === 'leshy' ? 0.85 : 0.6);
    parent.addChild(this.sprite);

    const radius = type === 'leshy' ? 32 : type === 'wolf' ? 18 : 14;
    this.body = Matter.Bodies.circle(x, y, radius, {
      frictionAir: 0.12,
      restitution: 0.2,
      collisionFilter: {
        category: CollisionCategory.ENEMY,
        mask: CollisionCategory.PLAYER | CollisionCategory.OBSTACLE | CollisionCategory.ATTACK_HITBOX | CollisionCategory.SALT_CIRCLE,
      },
    });
    physics.addBody(this.body);
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    isPlayerHidden: boolean,
    torches: TorchInstance[],
    saltCircles: SaltCircleInstance[],
    obstacles: Matter.Body[],
    physics: PhysicsWorld
  ): void {
    if (this.isDead) return;

    this.animTimer += dt * 4;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.stateTimer > 0) this.stateTimer -= dt;

    const myX = this.body.position.x;
    const myY = this.body.position.y;

    // 1. Check Repulsion from Active Salt Circles
    let isInsideSalt = false;
    for (let i = 0; i < saltCircles.length; i++) {
      const sc = saltCircles[i];
      const dist = Math.hypot(myX - sc.x, myY - sc.y);
      if (dist < sc.radius + 15) {
        isInsideSalt = true;
        // Take damage from salt ward
        this.hp -= dt * 25;
        // Strong repulsion vector
        const pushAngle = Math.atan2(myY - sc.y, myX - sc.x);
        Matter.Body.applyForce(this.body, this.body.position, {
          x: Math.cos(pushAngle) * 0.008,
          y: Math.sin(pushAngle) * 0.008,
        });
        this.state = 'flee';
        this.targetX = myX + Math.cos(pushAngle) * 200;
        this.targetY = myY + Math.sin(pushAngle) * 200;
        break;
      }
    }

    // 2. Check Fear of Bright Torches (for Wisps & Wolves)
    if (!isInsideSalt && this.type !== 'leshy') {
      for (let i = 0; i < torches.length; i++) {
        const torch = torches[i];
        if (torch.isLit) {
          const dist = Math.hypot(myX - torch.x, myY - torch.y);
          if (dist < torch.radius * 0.8) {
            const pushAngle = Math.atan2(myY - torch.y, myX - torch.x);
            this.state = 'flee';
            this.targetX = myX + Math.cos(pushAngle) * 150;
            this.targetY = myY + Math.sin(pushAngle) * 150;
            break;
          }
        }
      }
    }

    // 3. Vision & Player Detection
    const distToPlayer = Math.hypot(playerX - myX, playerY - myY);
    const angleToPlayer = Math.atan2(playerY - myY, playerX - myX);
    const angleDiff = Math.abs(Math.atan2(Math.sin(angleToPlayer - this.headingAngle), Math.cos(angleToPlayer - this.headingAngle)));

    const canSeePlayer =
      !isPlayerHidden &&
      distToPlayer <= this.visionRadius &&
      (angleDiff <= this.visionAngle / 2 || distToPlayer < 60) &&
      physics.hasLineOfSight(myX, myY, playerX, playerY, obstacles);

    if (canSeePlayer && this.state !== 'flee') {
      this.state = 'chase';
      this.targetX = playerX;
      this.targetY = playerY;
    } else if (this.state === 'chase' && isPlayerHidden) {
      // Player vanished into a bush: investigate last known spot
      this.state = 'investigate';
      this.stateTimer = 3.5;
    }

    // 4. State Decision & Movement
    if (this.state === 'patrol') {
      const distToPatrol = Math.hypot(this.targetX - myX, this.targetY - myY);
      if (distToPatrol < 30 || this.stateTimer <= 0) {
        const roamRadius = this.type === 'leshy' ? 120 : 180;
        this.targetX = this.patrolX + (Math.random() * 2 - 1) * roamRadius;
        this.targetY = this.patrolY + (Math.random() * 2 - 1) * roamRadius;
        this.stateTimer = 4 + Math.random() * 4;
      }
    } else if (this.state === 'investigate' && this.stateTimer <= 0) {
      this.state = 'patrol';
    }

    // Move towards targetX, targetY
    const dx = this.targetX - myX;
    const dy = this.targetY - myY;
    const dist = Math.hypot(dx, dy);

    if (dist > 10) {
      const moveAngle = Math.atan2(dy, dx);
      this.headingAngle = moveAngle;

      const currentSpeed = this.state === 'chase' ? this.speed * 1.25 : this.speed;
      const vx = Math.cos(moveAngle) * (currentSpeed / 60);
      const vy = Math.sin(moveAngle) * (currentSpeed / 60);

      Matter.Body.setVelocity(this.body, {
        x: this.body.velocity.x * 0.8 + vx * 0.2,
        y: this.body.velocity.y * 0.8 + vy * 0.2,
      });

      // Face direction
      this.sprite.scale.x = dx < 0 ? -1 : 1;
    }

    // Floating bob animation for Wisps
    if (this.type === 'wisp') {
      this.sprite.y = Math.sin(this.animTimer) * 6;
      this.sprite.alpha = 0.85 + Math.sin(this.animTimer * 2) * 0.15;
    }
  }

  takeDamage(amount: number, isBackstab = false): boolean {
    const finalAmount = isBackstab ? amount * 3.0 : amount;
    this.hp -= finalAmount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
    return this.isDead;
  }

  destroy(physics: PhysicsWorld): void {
    physics.removeBody(this.body);
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }
}
