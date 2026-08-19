import Matter from 'matter-js';
import { Sprite, Container } from 'pixi.js';
import { TextureGenerator } from '../rendering/TextureGenerator';
import { CollisionCategory } from '../physics/CollisionCategories';
import { physicsWorld } from '../physics/PhysicsWorld';
import { sceneManager } from '../rendering/SceneManager';
import { particleSystem } from '../rendering/ParticleSystem';
import { audioManager } from '../audio/AudioManager';
import { Projectile } from './Projectile';
import { DropItem } from './DropItem';

export type EnemyType = 'crawler' | 'beetle' | 'sporer' | 'magma';

export interface EnemyConfig {
  maxHp: number;
  speed: number;
  contactDamage: number;
  textureId: string;
  scoreValue: number;
  shootCooldown?: number;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  crawler: { maxHp: 35, speed: 120, contactDamage: 12, textureId: 'enemy_crawler', scoreValue: 10 },
  beetle: { maxHp: 85, speed: 70, contactDamage: 20, textureId: 'enemy_beetle', scoreValue: 25 },
  sporer: { maxHp: 45, speed: 60, contactDamage: 10, textureId: 'enemy_sporer', scoreValue: 20, shootCooldown: 2.2 },
  magma: { maxHp: 60, speed: 100, contactDamage: 25, textureId: 'enemy_beetle', scoreValue: 30 },
};

export class Enemy {
  public type: EnemyType;
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public hp: number;
  public maxHp: number;
  public isDead: boolean = false;

  public body: Matter.Body;
  public container: Container;
  public sprite: Sprite;

  private shootTimer: number = 0;
  private animTimer: number = 0;

  constructor(x: number, y: number, type: EnemyType) {
    this.x = x;
    this.y = y;
    this.type = type;

    const cfg = ENEMY_CONFIGS[type];
    this.maxHp = cfg.maxHp;
    this.hp = this.maxHp;

    // Matter.js dynamic body
    this.body = Matter.Bodies.circle(this.x, this.y, 18, {
      friction: 0.05,
      frictionAir: 0.05,
      restitution: 0.2,
      label: 'enemy',
      collisionFilter: {
        category: CollisionCategory.ENEMY,
        mask: CollisionCategory.PLAYER_DRILL | CollisionCategory.PLAYER_PROJECTILE | CollisionCategory.TERRAIN_BLOCK,
      },
    });
    (this.body as any).enemyEntity = this;
    physicsWorld.addBody(this.body);

    // Pixi Container & Sprite
    this.container = new Container();
    this.container.position.set(this.x, this.y);

    this.sprite = new Sprite(TextureGenerator.get(cfg.textureId));
    this.sprite.anchor.set(0.5);
    this.container.addChild(this.sprite);

    sceneManager.enemiesLayer.addChild(this.container);
  }

  public update(dtSeconds: number, playerX: number, playerY: number, projectiles: Projectile[]): void {
    if (this.isDead) return;

    this.animTimer += dtSeconds;
    const cfg = ENEMY_CONFIGS[this.type];

    // AI navigation towards player
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    let targetVx = (dx / dist) * cfg.speed;
    let targetVy = (dy / dist) * cfg.speed;

    // Sporer stays at distance and shoots acid
    if (this.type === 'sporer' && cfg.shootCooldown) {
      if (dist < 180) {
        // Back off slightly
        targetVx = -(dx / dist) * cfg.speed;
        targetVy = -(dy / dist) * cfg.speed;
      }
      this.shootTimer += dtSeconds;
      if (this.shootTimer >= cfg.shootCooldown) {
        this.shootTimer = 0;
        const shootSpeed = 220;
        projectiles.push(
          new Projectile(
            this.x,
            this.y,
            (dx / dist) * shootSpeed,
            (dy / dist) * shootSpeed,
            12,
            'enemy_acid'
          )
        );
      }
    }

    // Apply movement
    this.vx += (targetVx - this.vx) * Math.min(1, dtSeconds * 4);
    this.vy += (targetVy - this.vy) * Math.min(1, dtSeconds * 4);

    Matter.Body.setVelocity(this.body, { x: this.vx * 0.016, y: this.vy * 0.016 });
    Matter.Body.setPosition(this.body, {
      x: this.body.position.x + this.vx * dtSeconds,
      y: this.body.position.y + this.vy * dtSeconds,
    });

    this.x = this.body.position.x;
    this.y = this.body.position.y;

    this.container.position.set(this.x, this.y);
    this.container.rotation = Math.atan2(dy, dx) + Math.PI / 2;

    // Subtle scale bounce animation
    const scalePulse = 1.0 + Math.sin(this.animTimer * 8) * 0.06;
    this.sprite.scale.set(scalePulse);
  }

  public takeDamage(amount: number, drops?: DropItem[]): boolean {
    if (this.isDead) return false;

    this.hp -= amount;
    particleSystem.emitSparks(this.x, this.y, 4);
    audioManager.playMonsterHit();

    // Flash white
    this.sprite.tint = 0xffffff;
    setTimeout(() => {
      if (!this.isDead) this.sprite.tint = 0xffffff;
    }, 60);

    if (this.hp <= 0) {
      this.die(drops);
      return true;
    }
    return false;
  }

  private die(drops?: DropItem[]): void {
    this.isDead = true;
    particleSystem.emitExplosion(this.x, this.y, false);
    audioManager.playMonsterHit();

    // Spawn crystals or ore
    if (drops) {
      const dropCount = Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < dropCount; i++) {
        drops.push(new DropItem(this.x, this.y, Math.random() < 0.3 ? 'gold' : 'crystal'));
      }
      if (Math.random() < 0.1) {
        drops.push(new DropItem(this.x, this.y, 'heal'));
      }
    }

    this.destroy();
  }

  public destroy(): void {
    this.isDead = true;
    physicsWorld.removeBody(this.body);
    sceneManager.enemiesLayer.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
