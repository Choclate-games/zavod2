import Matter from 'matter-js';
import { Container, Sprite, Graphics } from 'pixi.js';
import { TextureGenerator } from '../rendering/TextureGenerator';
import { CollisionCategory } from '../physics/CollisionCategories';
import { physicsWorld } from '../physics/PhysicsWorld';
import { sceneManager } from '../rendering/SceneManager';
import { gameState } from '../core/GameState';
import { audioManager } from '../audio/AudioManager';
import { particleSystem } from '../rendering/ParticleSystem';
import { DroneTurretSystem } from './DroneTurret';

export class PlayerDrill {
  public x: number = 240;
  public y: number = 0;
  public vx: number = 0;
  public vy: number = 100;

  public readonly width: number = 52;
  public readonly height: number = 74;

  public isTurbo: boolean = false;
  public isInvulnerable: boolean = false;
  private invulnerableTimer: number = 0;
  private naniteTimer: number = 0;
  private cryoSupernovaTimer: number = 0;

  public body: Matter.Body;
  public container: Container;
  public bodySprite: Sprite;
  public bladeSprite: Sprite;
  public cryoAuraGfx: Graphics;
  public shieldGfx: Graphics;
  public turretSystem: DroneTurretSystem;

  private bladeAngle: number = 0;

  constructor(startX: number = 240, startY: number = 0) {
    this.x = startX;
    this.y = startY;

    // Matter.js dynamic body
    this.body = Matter.Bodies.rectangle(this.x, this.y, this.width, this.height, {
      friction: 0.1,
      frictionAir: 0.04,
      restitution: 0.1,
      label: 'player_drill',
      collisionFilter: {
        category: CollisionCategory.PLAYER_DRILL,
        mask: CollisionCategory.TERRAIN_BLOCK | CollisionCategory.ENEMY | CollisionCategory.ENEMY_PROJECTILE,
      },
    });
    (this.body as any).playerEntity = this;
    physicsWorld.addBody(this.body);

    // PixiJS Display Containers
    this.container = new Container();
    this.container.position.set(this.x, this.y);

    // Cryo Aura
    this.cryoAuraGfx = new Graphics();
    this.container.addChild(this.cryoAuraGfx);

    // Shield Dome
    this.shieldGfx = new Graphics();
    this.container.addChild(this.shieldGfx);

    // Chassis Sprite
    this.bodySprite = new Sprite(TextureGenerator.get('drill_body'));
    this.bodySprite.anchor.set(0.5, 0.45);
    this.bodySprite.width = 64;
    this.bodySprite.height = 80;
    this.container.addChild(this.bodySprite);

    // Rotary Cutter Blade (positioned at the bottom)
    this.bladeSprite = new Sprite(TextureGenerator.get('drill_blade'));
    this.bladeSprite.anchor.set(0.5, 0.5);
    this.bladeSprite.position.set(0, 36);
    this.bladeSprite.width = 46;
    this.bladeSprite.height = 46;
    this.container.addChild(this.bladeSprite);

    // Drone Turrets & Aux Systems
    this.turretSystem = new DroneTurretSystem();

    sceneManager.playerLayer.addChild(this.container);
  }

  public handleInput(steerX: number, turboActive: boolean): void {
    this.isTurbo = turboActive && !gameState.isOverheated && gameState.currentHeat < gameState.maxHeat;

    // Horizontal steering acceleration
    const steerSpeed = 380 * gameState.saveData.touchSensitivity;
    this.vx = steerX * steerSpeed;

    // Downward target velocity
    const baseDownSpeed = 140;
    const turboDownSpeed = 320;
    this.vy = this.isTurbo ? turboDownSpeed : baseDownSpeed;
  }

  public update(dtSeconds: number): void {
    // 1. Invulnerability timer
    if (this.isInvulnerable) {
      this.invulnerableTimer -= dtSeconds;
      this.container.alpha = Math.sin(Date.now() * 0.03) > 0 ? 0.4 : 1.0;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
        this.container.alpha = 1.0;
      }
    }

    // 2. Overheat & Cooling logic
    if (this.isTurbo) {
      gameState.currentHeat = Math.min(gameState.maxHeat, gameState.currentHeat + 45 * dtSeconds);
      if (gameState.currentHeat >= gameState.maxHeat) {
        gameState.isOverheated = true;
        this.isTurbo = false;
        sceneManager.addTrauma(0.3);
        audioManager.playExplosion();
      }
    } else {
      const coolRate = gameState.getCoolingRate();
      gameState.currentHeat = Math.max(0, gameState.currentHeat - coolRate * dtSeconds);
      if (gameState.currentHeat < 20) {
        gameState.isOverheated = false;
      }
    }

    // 3. Passive Nanite Repair perk
    const naniteLvl = gameState.equippedPerks.get('perk_nanite_repair')?.level || 0;
    if (naniteLvl > 0 && !gameState.isOverheated && gameState.currentHp < gameState.maxHp) {
      this.naniteTimer += dtSeconds;
      if (this.naniteTimer >= 1.0) {
        this.naniteTimer = 0;
        gameState.currentHp = Math.min(gameState.maxHp, gameState.currentHp + naniteLvl * 2);
      }
    }

    // 4. Cryo Supernova Perk
    const cryoBlastLvl = gameState.equippedPerks.get('perk_cryo_blast')?.level || 0;
    if (cryoBlastLvl > 0) {
      this.cryoSupernovaTimer += dtSeconds;
      if (this.cryoSupernovaTimer >= 4.0) {
        this.cryoSupernovaTimer = 0;
        this.triggerCryoSupernova(cryoBlastLvl);
      }
    }

    // 5. Update physics body position and velocity
    Matter.Body.setVelocity(this.body, { x: this.vx * 0.016, y: this.vy * 0.016 });
    Matter.Body.setPosition(this.body, {
      x: Math.max(40, Math.min(440, this.body.position.x + this.vx * dtSeconds)),
      y: this.body.position.y + this.vy * dtSeconds,
    });

    this.x = this.body.position.x;
    this.y = this.body.position.y;

    // 6. Update visual transforms
    this.container.position.set(this.x, this.y);

    // Rotary blade animation
    const rotSpeed = this.isTurbo ? 35 : 18;
    this.bladeAngle += rotSpeed * dtSeconds;
    this.bladeSprite.rotation = this.bladeAngle;

    // Chassis slight tilt on steer
    this.container.rotation = (this.vx / 380) * 0.08;

    // Continuous drilling sparks & audio
    particleSystem.emitSparks(this.x, this.y + 38, this.isTurbo ? 5 : 2, Math.PI / 2);
    audioManager.updateDrillSound(true, this.isTurbo);

    // Dynamic camera zoom on turbo
    sceneManager.setZoom(this.isTurbo ? 1.08 : 1.0);

    // 7. Cryo Aura visualization
    const frostLvl = gameState.equippedPerks.get('perk_frost_drill')?.level || 0;
    this.cryoAuraGfx.clear();
    if (frostLvl > 0) {
      this.cryoAuraGfx.circle(0, 0, 48 + frostLvl * 6);
      this.cryoAuraGfx.fill({ color: 0x00f0ff, alpha: 0.12 });
      this.cryoAuraGfx.stroke({ width: 2, color: 0x80e5ff, alpha: 0.4 });
    }
  }

  public takeDamage(amount: number): boolean {
    if (this.isInvulnerable) return false;

    const mitigation = gameState.getArmorReduction();
    const finalDmg = Math.max(1, amount * (1 - mitigation));
    gameState.currentHp -= finalDmg;

    this.isInvulnerable = true;
    this.invulnerableTimer = 0.4;
    sceneManager.addTrauma(0.35);
    audioManager.playMonsterHit();
    particleSystem.emitSparks(this.x, this.y, 10);

    if (gameState.currentHp <= 0) {
      gameState.currentHp = 0;
      return true; // Death!
    }
    return false;
  }

  public triggerRevive(): void {
    gameState.currentHp = gameState.maxHp;
    gameState.currentHeat = 0;
    gameState.isOverheated = false;
    this.isInvulnerable = true;
    this.invulnerableTimer = 3.0; // 3 seconds of invulnerability

    sceneManager.addTrauma(0.8);
    particleSystem.emitExplosion(this.x, this.y, true);
    audioManager.playExplosion(true);
  }

  private triggerCryoSupernova(level: number): void {
    const blastRadius = 160 + level * 30;
    particleSystem.emitExplosion(this.x, this.y, false);
    audioManager.playDraftAppear();
  }

  public destroy(): void {
    audioManager.stopDrillSound();
    physicsWorld.removeBody(this.body);
    sceneManager.playerLayer.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
