import Matter from 'matter-js';
import { Container, Sprite, Graphics } from 'pixi.js';
import { TextureGenerator } from '../rendering/TextureGenerator';
import { CollisionCategory } from '../physics/CollisionCategories';
import { physicsWorld } from '../physics/PhysicsWorld';
import { sceneManager } from '../rendering/SceneManager';
import { particleSystem } from '../rendering/ParticleSystem';
import { audioManager } from '../audio/AudioManager';
import { Projectile } from './Projectile';
import { DropItem } from './DropItem';

export type BossType = 'obsidian_golem' | 'magma_worm';

export class Boss {
  public type: BossType;
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
  public healthBarGfx: Graphics;

  private attackTimer: number = 0;
  private moveTimer: number = 0;

  constructor(x: number, y: number, type: BossType) {
    this.x = x;
    this.y = y;
    this.type = type;

    this.maxHp = type === 'obsidian_golem' ? 1200 : 2500;
    this.hp = this.maxHp;

    const texName = type === 'obsidian_golem' ? 'boss_golem' : 'boss_worm_segment';
    const radius = type === 'obsidian_golem' ? 38 : 30;

    // Matter.js dynamic body
    this.body = Matter.Bodies.circle(this.x, this.y, radius, {
      friction: 0.1,
      frictionAir: 0.05,
      restitution: 0.3,
      label: 'boss',
      collisionFilter: {
        category: CollisionCategory.ENEMY,
        mask: CollisionCategory.PLAYER_DRILL | CollisionCategory.PLAYER_PROJECTILE,
      },
    });
    (this.body as any).bossEntity = this;
    physicsWorld.addBody(this.body);

    // Pixi Container
    this.container = new Container();
    this.container.position.set(this.x, this.y);

    this.sprite = new Sprite(TextureGenerator.get(texName));
    this.sprite.anchor.set(0.5);
    this.container.addChild(this.sprite);

    this.healthBarGfx = new Graphics();
    this.container.addChild(this.healthBarGfx);

    sceneManager.enemiesLayer.addChild(this.container);

    audioManager.playBossWarning();
    sceneManager.addTrauma(0.5);
  }

  public update(dtSeconds: number, playerX: number, playerY: number, projectiles: Projectile[]): void {
    if (this.isDead) return;

    this.moveTimer += dtSeconds;
    this.attackTimer += dtSeconds;

    // Boss AI tracking & charges
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const speed = 85;
    const targetVx = (dx / dist) * speed + Math.sin(this.moveTimer * 3) * 60;
    const targetVy = (dy / dist) * speed;

    this.vx += (targetVx - this.vx) * Math.min(1, dtSeconds * 3);
    this.vy += (targetVy - this.vy) * Math.min(1, dtSeconds * 3);

    Matter.Body.setVelocity(this.body, { x: this.vx * 0.016, y: this.vy * 0.016 });
    Matter.Body.setPosition(this.body, {
      x: this.body.position.x + this.vx * dtSeconds,
      y: this.body.position.y + this.vy * dtSeconds,
    });

    this.x = this.body.position.x;
    this.y = this.body.position.y;

    this.container.position.set(this.x, this.y);
    this.container.rotation = Math.atan2(dy, dx) + Math.PI / 2;

    // Special Boss Attacks
    if (this.attackTimer >= 3.0) {
      this.attackTimer = 0;
      this.performSpecialAttack(playerX, playerY, projectiles);
    }

    this.updateHealthBar();
  }

  private performSpecialAttack(playerX: number, playerY: number, projectiles: Projectile[]): void {
    sceneManager.addTrauma(0.3);
    audioManager.playExplosion();

    // Fire 5-way radial projectile fan
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count + this.moveTimer;
      const spd = 200;
      projectiles.push(
        new Projectile(
          this.x,
          this.y,
          Math.cos(angle) * spd,
          Math.sin(angle) * spd,
          15,
          'enemy_acid'
        )
      );
    }
  }

  public takeDamage(amount: number, drops?: DropItem[]): boolean {
    if (this.isDead) return false;

    this.hp -= amount;
    particleSystem.emitSparks(this.x, this.y, 6);
    audioManager.playMonsterHit();

    if (this.hp <= 0) {
      this.die(drops);
      return true;
    }
    return false;
  }

  private updateHealthBar(): void {
    this.healthBarGfx.clear();
    const w = 64;
    const h = 6;
    const yOff = -45;

    // Background
    this.healthBarGfx.rect(-w / 2, yOff, w, h);
    this.healthBarGfx.fill({ color: 0x111111, alpha: 0.8 });

    // Fill
    const pct = Math.max(0, this.hp / this.maxHp);
    this.healthBarGfx.rect(-w / 2, yOff, w * pct, h);
    this.healthBarGfx.fill({ color: 0xff1a40 });
  }

  private die(drops?: DropItem[]): void {
    this.isDead = true;
    particleSystem.emitExplosion(this.x, this.y, true);
    audioManager.playExplosion(true);
    sceneManager.addTrauma(0.9);

    if (drops) {
      // Massive crystal burst
      for (let i = 0; i < 15; i++) {
        drops.push(new DropItem(this.x, this.y, 'crystal'));
      }
      for (let i = 0; i < 8; i++) {
        drops.push(new DropItem(this.x, this.y, 'gold'));
      }
      drops.push(new DropItem(this.x, this.y, 'heal'));
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
