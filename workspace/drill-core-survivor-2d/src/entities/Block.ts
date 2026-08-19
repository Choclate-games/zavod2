import Matter from 'matter-js';
import { Sprite, Container, Graphics } from 'pixi.js';
import { TextureGenerator } from '../rendering/TextureGenerator';
import { CollisionCategory } from '../physics/CollisionCategories';
import { physicsWorld } from '../physics/PhysicsWorld';
import { sceneManager } from '../rendering/SceneManager';

export type BlockType =
  | 'basalt'
  | 'granite'
  | 'obsidian'
  | 'ore_gold'
  | 'ore_crystal'
  | 'tnt'
  | 'magma'
  | 'cryo';

export interface BlockConfig {
  maxHp: number;
  textureId: string;
  hardness: number;
  dropType?: 'crystal' | 'gold' | 'heal';
  dropCount?: number;
}

export const BLOCK_CONFIGS: Record<BlockType, BlockConfig> = {
  basalt: { maxHp: 80, textureId: 'block_basalt', hardness: 1 },
  granite: { maxHp: 180, textureId: 'block_granite', hardness: 2 },
  obsidian: { maxHp: 380, textureId: 'block_obsidian', hardness: 3 },
  ore_gold: { maxHp: 120, textureId: 'block_ore_gold', hardness: 1.5, dropType: 'gold', dropCount: 2 },
  ore_crystal: { maxHp: 140, textureId: 'block_ore_crystal', hardness: 1.5, dropType: 'crystal', dropCount: 3 },
  tnt: { maxHp: 30, textureId: 'block_tnt', hardness: 0.5 },
  magma: { maxHp: 160, textureId: 'block_magma', hardness: 2 },
  cryo: { maxHp: 110, textureId: 'block_cryo', hardness: 1.2 },
};

export class Block {
  public type: BlockType;
  public gridX: number;
  public gridY: number;
  public x: number;
  public y: number;
  public readonly size: number = 48;
  public hp: number;
  public maxHp: number;
  public isDestroyed: boolean = false;

  public body: Matter.Body;
  public container: Container;
  public sprite: Sprite;
  public crackOverlay: Graphics;

  constructor(gridX: number, gridY: number, type: BlockType) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.type = type;
    this.x = gridX * this.size + this.size / 2;
    this.y = gridY * this.size + this.size / 2;

    const cfg = BLOCK_CONFIGS[type];
    this.maxHp = cfg.maxHp;
    this.hp = this.maxHp;

    // Matter.js static rigid body
    this.body = Matter.Bodies.rectangle(this.x, this.y, this.size, this.size, {
      isStatic: true,
      label: 'block',
      collisionFilter: {
        category: CollisionCategory.TERRAIN_BLOCK,
        mask: CollisionCategory.PLAYER_DRILL | CollisionCategory.PLAYER_PROJECTILE | CollisionCategory.ENEMY,
      },
    });
    (this.body as any).blockEntity = this;
    physicsWorld.addBody(this.body);

    // Pixi Visuals
    this.container = new Container();
    this.container.position.set(this.x, this.y);

    this.sprite = new Sprite(TextureGenerator.get(cfg.textureId));
    this.sprite.anchor.set(0.5);
    this.sprite.width = this.size;
    this.sprite.height = this.size;
    this.container.addChild(this.sprite);

    this.crackOverlay = new Graphics();
    this.container.addChild(this.crackOverlay);

    sceneManager.terrainLayer.addChild(this.container);
  }

  public takeDamage(amount: number): boolean {
    if (this.isDestroyed) return false;

    this.hp -= amount;
    this.updateCracks();

    if (this.hp <= 0) {
      this.isDestroyed = true;
      return true; // Destroyed!
    }
    return false;
  }

  private updateCracks(): void {
    this.crackOverlay.clear();
    const ratio = this.hp / this.maxHp;
    if (ratio >= 0.8) return;

    this.crackOverlay.strokeStyle = { width: 2, color: 0x000000, alpha: 0.7 };
    const hs = this.size / 2 - 4;

    if (ratio < 0.8) {
      this.crackOverlay.moveTo(-hs, -hs + 6);
      this.crackOverlay.lineTo(-4, 0);
      this.crackOverlay.lineTo(6, -8);
    }
    if (ratio < 0.5) {
      this.crackOverlay.moveTo(0, 0);
      this.crackOverlay.lineTo(8, 14);
      this.crackOverlay.lineTo(hs, 18);
    }
    if (ratio < 0.25) {
      this.crackOverlay.moveTo(-8, 8);
      this.crackOverlay.lineTo(12, -12);
      this.crackOverlay.moveTo(-hs + 4, hs - 4);
      this.crackOverlay.lineTo(hs - 4, -hs + 4);
    }
    this.crackOverlay.stroke();
  }

  public destroy(): void {
    this.isDestroyed = true;
    physicsWorld.removeBody(this.body);
    sceneManager.terrainLayer.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
