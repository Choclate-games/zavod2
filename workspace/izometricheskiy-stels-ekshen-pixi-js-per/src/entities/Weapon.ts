/**
 * Interactive Forest Objects: Torches, Salt Ward Circles, Bushes & Drops
 */

import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { SpriteFactory } from '../rendering/MeshPool';
import { PhysicsWorld, CollisionCategory } from '../physics/PhysicsWorld';

export class TorchInstance {
  public id: string;
  public x: number;
  public y: number;
  public isLit = false;
  public duration = 0;
  public maxDuration = 45;
  public radius = 180;
  public sprite: PIXI.Sprite;
  public body: Matter.Body;

  constructor(id: string, x: number, y: number, physics: PhysicsWorld, parent: PIXI.Container) {
    this.id = id;
    this.x = x;
    this.y = y;

    this.sprite = new PIXI.Sprite(SpriteFactory.getTexture('torch'));
    this.sprite.anchor.set(0.5, 0.85);
    parent.addChild(this.sprite);

    this.body = Matter.Bodies.circle(x, y, 16, {
      isStatic: true,
      collisionFilter: {
        category: CollisionCategory.TORCH,
        mask: CollisionCategory.PLAYER | CollisionCategory.ENEMY,
      },
    });
    physics.addBody(this.body);
  }

  light(durationSeconds = 45): void {
    this.isLit = true;
    this.duration = durationSeconds;
    this.maxDuration = durationSeconds;
  }

  update(dt: number): boolean {
    if (this.isLit) {
      this.duration -= dt;
      if (this.duration <= 0) {
        this.isLit = false;
        this.duration = 0;
      }
    }
    return this.isLit;
  }

  destroy(physics: PhysicsWorld): void {
    physics.removeBody(this.body);
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }
}

export class SaltCircleInstance {
  public id: string;
  public x: number;
  public y: number;
  public radius = 140;
  public duration = 30;
  public maxDuration = 30;
  public sprite: PIXI.Sprite;
  public body: Matter.Body;

  constructor(id: string, x: number, y: number, radius = 140, duration = 30, physics: PhysicsWorld, parent: PIXI.Container) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.duration = duration;
    this.maxDuration = duration;

    this.sprite = new PIXI.Sprite(SpriteFactory.getTexture('salt_circle'));
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(radius / 48);
    parent.addChild(this.sprite);

    this.body = Matter.Bodies.circle(x, y, radius, {
      isSensor: true,
      isStatic: true,
      collisionFilter: {
        category: CollisionCategory.SALT_CIRCLE,
        mask: CollisionCategory.ENEMY,
      },
    });
    physics.addBody(this.body);
  }

  update(dt: number): boolean {
    this.duration -= dt;
    this.sprite.rotation += dt * 0.2;
    this.sprite.alpha = Math.min(1, this.duration / 3);
    return this.duration > 0;
  }

  destroy(physics: PhysicsWorld): void {
    physics.removeBody(this.body);
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }
}

export class HidingBushInstance {
  public id: string;
  public x: number;
  public y: number;
  public radius = 42;
  public sprite: PIXI.Sprite;
  public body: Matter.Body;

  constructor(id: string, x: number, y: number, physics: PhysicsWorld, parent: PIXI.Container) {
    this.id = id;
    this.x = x;
    this.y = y;

    this.sprite = new PIXI.Sprite(SpriteFactory.getTexture('bush'));
    this.sprite.anchor.set(0.5, 0.7);
    parent.addChild(this.sprite);

    this.body = Matter.Bodies.circle(x, y, this.radius, {
      isSensor: true,
      isStatic: true,
      collisionFilter: {
        category: CollisionCategory.BUSH,
        mask: CollisionCategory.PLAYER,
      },
    });
    physics.addBody(this.body);
  }

  destroy(physics: PhysicsWorld): void {
    physics.removeBody(this.body);
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }
}

export class CollectibleInstance {
  public id: string;
  public type: 'herb' | 'coin';
  public x: number;
  public y: number;
  public value: number;
  public sprite: PIXI.Sprite;
  public body: Matter.Body;
  private animTimer = Math.random() * Math.PI * 2;

  constructor(id: string, type: 'herb' | 'coin', x: number, y: number, value: number, physics: PhysicsWorld, parent: PIXI.Container) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.value = value;

    this.sprite = new PIXI.Sprite(SpriteFactory.getTexture(type));
    this.sprite.anchor.set(0.5);
    parent.addChild(this.sprite);

    this.body = Matter.Bodies.circle(x, y, 12, {
      isSensor: true,
      isStatic: true,
      collisionFilter: {
        category: CollisionCategory.COLLECTIBLE,
        mask: CollisionCategory.PLAYER,
      },
    });
    physics.addBody(this.body);
  }

  update(dt: number, playerX: number, playerY: number, magnetDist = 90): boolean {
    this.animTimer += dt * 3;
    this.sprite.scale.set(1 + Math.sin(this.animTimer) * 0.1);

    const dist = Math.hypot(playerX - this.x, playerY - this.y);
    if (dist < magnetDist) {
      const speed = 320 * dt;
      const angle = Math.atan2(playerY - this.y, playerX - this.x);
      this.x += Math.cos(angle) * speed;
      this.y += Math.sin(angle) * speed;
      Matter.Body.setPosition(this.body, { x: this.x, y: this.y });
    }

    return dist > 20; // Returns false when collected
  }

  destroy(physics: PhysicsWorld): void {
    physics.removeBody(this.body);
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }
}
