import { Sprite } from 'pixi.js';
import { TextureGenerator } from '../rendering/TextureGenerator';
import { sceneManager } from '../rendering/SceneManager';
import { gameState } from '../core/GameState';
import { audioManager } from '../audio/AudioManager';
import { eventBus } from '../core/EventBus';

export type DropType = 'crystal' | 'gold' | 'heal';

export class DropItem {
  public type: DropType;
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public isCollected: boolean = false;
  public sprite: Sprite;
  private lifeTime: number = 0;

  constructor(x: number, y: number, type: DropType) {
    this.x = x;
    this.y = y;
    this.type = type;

    // Initial scatter impulse
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 80;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 30;

    let texName = 'drop_crystal';
    if (type === 'gold') texName = 'drop_ore';
    else if (type === 'heal') texName = 'drop_heal';

    this.sprite = new Sprite(TextureGenerator.get(texName));
    this.sprite.anchor.set(0.5);
    this.sprite.position.set(x, y);
    this.sprite.scale.set(0.9);

    sceneManager.dropLayer.addChild(this.sprite);
  }

  public update(dtSeconds: number, playerX: number, playerY: number, magnetRadius: number): boolean {
    if (this.isCollected) return true;

    this.lifeTime += dtSeconds;

    // Calculate distance to player
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 28) {
      // Collected!
      this.collect();
      return true;
    }

    if (dist < magnetRadius) {
      // Magnetic pull acceleration
      const pullForce = 450 + (1 - dist / magnetRadius) * 650;
      const ax = (dx / dist) * pullForce;
      const ay = (dy / dist) * pullForce;

      this.vx += ax * dtSeconds;
      this.vy += ay * dtSeconds;
      // Damping
      this.vx *= 0.95;
      this.vy *= 0.95;
    } else {
      // Friction
      this.vx *= 0.92;
      this.vy *= 0.92;
    }

    this.x += this.vx * dtSeconds;
    this.y += this.vy * dtSeconds;

    this.sprite.position.set(this.x, this.y);
    this.sprite.rotation += 2.0 * dtSeconds;

    return false;
  }

  private collect(): void {
    this.isCollected = true;
    if (this.type === 'crystal') {
      gameState.addCrystals(1);
      const leveledUp = gameState.addCraftXp(10);
      audioManager.playCrystalPickup();
      if (leveledUp) {
        eventBus.emit('game:craft_level_up');
      }
    } else if (this.type === 'gold') {
      gameState.addCrystals(3);
      gameState.addCraftXp(5);
      audioManager.playCrystalPickup(3);
    } else if (this.type === 'heal') {
      gameState.currentHp = Math.min(gameState.maxHp, gameState.currentHp + 25);
      audioManager.playCrystalPickup(5);
    }

    this.destroy();
  }

  public destroy(): void {
    this.isCollected = true;
    sceneManager.dropLayer.removeChild(this.sprite);
    this.sprite.destroy();
  }
}
