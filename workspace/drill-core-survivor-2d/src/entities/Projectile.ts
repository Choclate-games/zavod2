import { Sprite } from 'pixi.js';
import { TextureGenerator } from '../rendering/TextureGenerator';
import { sceneManager } from '../rendering/SceneManager';
import { particleSystem } from '../rendering/ParticleSystem';

export type ProjectileType = 'player_plasma' | 'player_cryo' | 'enemy_acid';

export class Projectile {
  public type: ProjectileType;
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public damage: number;
  public isDead: boolean = false;
  public isEnemy: boolean;
  public radius: number = 8;
  public sprite: Sprite;
  private life: number = 0;
  private maxLife: number = 2.0;

  constructor(x: number, y: number, vx: number, vy: number, damage: number, type: ProjectileType) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.type = type;
    this.isEnemy = type === 'enemy_acid';

    let texName = 'proj_plasma';
    if (type === 'enemy_acid') texName = 'proj_acid';

    this.sprite = new Sprite(TextureGenerator.get(texName));
    this.sprite.anchor.set(0.5);
    this.sprite.position.set(x, y);
    this.sprite.rotation = Math.atan2(vy, vx) + Math.PI / 2;

    sceneManager.vfxLayer.addChild(this.sprite);
  }

  public update(dtSeconds: number): boolean {
    if (this.isDead) return true;

    this.life += dtSeconds;
    if (this.life >= this.maxLife) {
      this.destroy();
      return true;
    }

    this.x += this.vx * dtSeconds;
    this.y += this.vy * dtSeconds;
    this.sprite.position.set(this.x, this.y);

    return false;
  }

  public hit(): void {
    particleSystem.emitSparks(this.x, this.y, 4);
    this.destroy();
  }

  public destroy(): void {
    this.isDead = true;
    sceneManager.vfxLayer.removeChild(this.sprite);
    this.sprite.destroy();
  }
}
