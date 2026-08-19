import { Container, Graphics, Sprite } from 'pixi.js';
import { TextureGenerator } from '../rendering/TextureGenerator';
import { sceneManager } from '../rendering/SceneManager';
import { gameState } from '../core/GameState';
import { audioManager } from '../audio/AudioManager';
import { Projectile } from './Projectile';

export class DroneTurretSystem {
  public container: Container;
  private turretGfxLeft: Graphics;
  private turretGfxRight: Graphics;
  private orbitalSawsContainer: Container;
  private sawSprite1: Sprite;
  private sawSprite2: Sprite;
  private teslaArcGfx: Graphics;

  private fireTimer: number = 0;
  private orbitalAngle: number = 0;
  private teslaTimer: number = 0;

  constructor() {
    this.container = new Container();

    // Turret Barrels
    this.turretGfxLeft = new Graphics();
    this.turretGfxRight = new Graphics();
    this.container.addChild(this.turretGfxLeft);
    this.container.addChild(this.turretGfxRight);

    // Orbital Saws
    this.orbitalSawsContainer = new Container();
    this.sawSprite1 = new Sprite(TextureGenerator.get('drill_blade'));
    this.sawSprite2 = new Sprite(TextureGenerator.get('drill_blade'));
    this.sawSprite1.anchor.set(0.5);
    this.sawSprite2.anchor.set(0.5);
    this.sawSprite1.scale.set(0.65);
    this.sawSprite2.scale.set(0.65);
    this.orbitalSawsContainer.addChild(this.sawSprite1);
    this.orbitalSawsContainer.addChild(this.sawSprite2);
    this.orbitalSawsContainer.visible = false;
    this.container.addChild(this.orbitalSawsContainer);

    // Tesla Arc
    this.teslaArcGfx = new Graphics();
    this.container.addChild(this.teslaArcGfx);

    sceneManager.playerLayer.addChild(this.container);
  }

  public update(
    dtSeconds: number,
    playerX: number,
    playerY: number,
    enemies: { x: number; y: number; hp: number; takeDamage: (dmg: number) => boolean }[],
    projectiles: Projectile[]
  ): void {
    const turretPerk = gameState.equippedPerks.get('perk_plasma_turret')?.level || 0;
    const starterTurrets = gameState.saveData.metaUpgrades.turretLevel;
    const hasTurrets = turretPerk > 0 || starterTurrets > 0;

    const orbitalPerk = gameState.equippedPerks.get('perk_orbital_saws')?.level || 0;
    const teslaPerk = gameState.equippedPerks.get('perk_tesla_arc')?.level || 0;

    // 1. Dual Turrets Fire
    if (hasTurrets) {
      this.fireTimer += dtSeconds;
      const fireInterval = Math.max(0.18, 0.45 - turretPerk * 0.05);

      if (this.fireTimer >= fireInterval && enemies.length > 0) {
        this.fireTimer = 0;

        // Find nearest enemies within 320px
        let nearest: { x: number; y: number; dist: number } | null = null;
        let minDist = 340;

        for (const e of enemies) {
          if (e.hp <= 0) continue;
          const dx = e.x - playerX;
          const dy = e.y - playerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            nearest = { x: e.x, y: e.y, dist };
          }
        }

        if (nearest) {
          const dx = nearest.x - playerX;
          const dy = nearest.y - playerY;
          const angle = Math.atan2(dy, dx);
          const bulletSpeed = 550;
          const damage = 22 + (starterTurrets + turretPerk) * 8;

          // Left muzzle
          projectiles.push(
            new Projectile(
              playerX - 22,
              playerY + 10,
              Math.cos(angle) * bulletSpeed,
              Math.sin(angle) * bulletSpeed,
              damage,
              'player_plasma'
            )
          );

          // Right muzzle
          projectiles.push(
            new Projectile(
              playerX + 22,
              playerY + 10,
              Math.cos(angle) * bulletSpeed,
              Math.sin(angle) * bulletSpeed,
              damage,
              'player_plasma'
            )
          );

          audioManager.playTurretShot();
        }
      }
    }

    // 2. Orbital Saws
    if (orbitalPerk > 0) {
      this.orbitalSawsContainer.visible = true;
      this.orbitalAngle += (3.5 + orbitalPerk * 0.8) * dtSeconds;
      const radius = 64 + orbitalPerk * 6;

      const x1 = playerX + Math.cos(this.orbitalAngle) * radius;
      const y1 = playerY + Math.sin(this.orbitalAngle) * radius;
      const x2 = playerX + Math.cos(this.orbitalAngle + Math.PI) * radius;
      const y2 = playerY + Math.sin(this.orbitalAngle + Math.PI) * radius;

      this.sawSprite1.position.set(x1, y1);
      this.sawSprite2.position.set(x2, y2);
      this.sawSprite1.rotation += 15 * dtSeconds;
      this.sawSprite2.rotation += 15 * dtSeconds;

      // Check collision with nearby enemies
      const sawRadius = 24;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const d1 = Math.hypot(e.x - x1, e.y - y1);
        const d2 = Math.hypot(e.x - x2, e.y - y2);
        if (d1 < sawRadius + 18 || d2 < sawRadius + 18) {
          e.takeDamage((15 + orbitalPerk * 8) * dtSeconds * 30);
        }
      }
    } else {
      this.orbitalSawsContainer.visible = false;
    }

    // 3. Tesla Arc Chain Lightning
    this.teslaArcGfx.clear();
    if (teslaPerk > 0) {
      this.teslaTimer += dtSeconds;
      if (this.teslaTimer >= 2.0 - teslaPerk * 0.25) {
        this.teslaTimer = 0;
        // Chain lightning through up to 3 enemies
        let currentX = playerX;
        let currentY = playerY;
        let chainCount = 0;
        const maxChains = 2 + teslaPerk;

        this.teslaArcGfx.strokeStyle = { width: 3, color: 0x00f0ff, alpha: 0.9 };
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          const dist = Math.hypot(e.x - currentX, e.y - currentY);
          if (dist < 260) {
            this.teslaArcGfx.moveTo(currentX, currentY);
            // Jagged lightning line
            const midX = (currentX + e.x) / 2 + (Math.random() - 0.5) * 30;
            const midY = (currentY + e.y) / 2 + (Math.random() - 0.5) * 30;
            this.teslaArcGfx.lineTo(midX, midY);
            this.teslaArcGfx.lineTo(e.x, e.y);

            e.takeDamage(35 + teslaPerk * 18);
            currentX = e.x;
            currentY = e.y;
            chainCount++;
            if (chainCount >= maxChains) break;
          }
        }
        if (chainCount > 0) {
          this.teslaArcGfx.stroke();
          audioManager.playTurretShot();
          // Fade lightning out after short time
          setTimeout(() => {
            this.teslaArcGfx.clear();
          }, 80);
        }
      }
    }
  }

  public clear(): void {
    this.turretGfxLeft.clear();
    this.turretGfxRight.clear();
    this.teslaArcGfx.clear();
    this.orbitalSawsContainer.visible = false;
  }
}
