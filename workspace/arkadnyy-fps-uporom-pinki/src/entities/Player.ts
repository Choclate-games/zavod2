import * as THREE from 'three';
import { PlayerStats, WeaponType, WeaponData } from '../types';
import { EventBus } from '../core/EventBus';
import { PhysicsWorld, PhysicsBody } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { AudioManager } from '../audio/AudioManager';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { Door } from './Door';
import { Barrel } from './Barrel';
import { Projectile } from './Projectile';
import { Enemy } from './Enemy';
import { WeaponPickup } from './WeaponPickup';

export const WEAPON_REGISTRY: Record<WeaponType, WeaponData> = {
  KICK: { type: 'KICK', name: 'ТЯЖЕЛЫЙ БОТИНОК', maxAmmo: 999, damage: 45, fireRate: 0.35, spread: 0, pellets: 1, range: 2.4, recoil: 0 },
  PISTOL: { type: 'PISTOL', name: 'РЕВОЛЬВЕР .44', maxAmmo: 12, damage: 32, fireRate: 0.28, spread: 0.02, pellets: 1, range: 45, recoil: 0.08 },
  SHOTGUN: { type: 'SHOTGUN', name: 'ДРОБОВИК ОХОТНИКА', maxAmmo: 6, damage: 18, fireRate: 0.75, spread: 0.12, pellets: 8, range: 20, recoil: 0.25 },
  SMG: { type: 'SMG', name: 'ПИСТОЛЕТ-ПУЛЕМЕТ', maxAmmo: 30, damage: 16, fireRate: 0.09, spread: 0.06, pellets: 1, range: 35, recoil: 0.04 },
  GRENADE_LAUNCHER: { type: 'GRENADE_LAUNCHER', name: 'РАКЕТНИЦА', maxAmmo: 4, damage: 140, fireRate: 1.1, spread: 0.01, pellets: 1, range: 50, recoil: 0.35 },
};

export class Player {
  public position: THREE.Vector3 = new THREE.Vector3(0, 1.7, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public body: PhysicsBody;

  // Stats
  public stats: PlayerStats = {
    hp: 100,
    maxHp: 100,
    shield: 50,
    maxShield: 50,
    speed: 8.5,
    slideSpeed: 14.5,
    baseKickDamage: 45,
    kickCooldownDuration: 0.35,
    kickLaunchVelocity: 22.5,
    wallSplatMultiplier: 2.5,
    armorReduction: 0.1,
    disarmMagnetRadius: 1.75,
    adrenalineActive: false,
    adrenalineThreshold: 0.25,
  };

  // Camera & Rotation (FPS controls)
  public pitch = 0;
  public yaw = 0;
  public forward = new THREE.Vector3(0, 0, -1);
  public right = new THREE.Vector3(1, 0, 0);

  // Weapon & Ammo
  public currentWeapon: WeaponType = 'PISTOL';
  public currentAmmo = 12;
  public isTrickshot = false;
  private shootCooldown = 0;

  // Kick State Machine: READY -> WINDUP (0.06s) -> ACTIVE_HITBOX (0.12s) -> RECOVERY (0.18s) -> COOLDOWN
  public kickState: 'READY' | 'WINDUP' | 'ACTIVE_HITBOX' | 'RECOVERY' | 'COOLDOWN' = 'READY';
  public kickCooldown = 0;
  private kickAnimProgress = 0;

  // Movement states
  public isSliding = false;
  public slideTimer = 0;
  public invulnerabilityTimer = 0;
  public isDead = false;

  private sceneMgr: SceneManager;
  private audioMgr: AudioManager;
  private bus: EventBus;

  constructor() {
    this.sceneMgr = SceneManager.getInstance();
    this.audioMgr = AudioManager.getInstance();
    this.bus = EventBus.getInstance();

    this.body = {
      id: 'player',
      position: this.position,
      velocity: this.velocity,
      radius: 0.4,
      height: 1.8,
      mass: 80,
      isStatic: false,
      isGrounded: true,
      useGravity: true,
      drag: 3.5,
      restitution: 0.0,
    };

    PhysicsWorld.getInstance().addBody(this.body);
  }

  public reset(spawnPos: THREE.Vector3): void {
    this.position.copy(spawnPos);
    this.position.y = 1.7;
    this.velocity.set(0, 0, 0);
    this.stats.hp = this.stats.maxHp;
    this.stats.shield = this.stats.maxShield;
    this.currentWeapon = 'PISTOL';
    this.currentAmmo = WEAPON_REGISTRY.PISTOL.maxAmmo;
    this.isTrickshot = false;
    this.isDead = false;
    this.kickState = 'READY';
    this.kickCooldown = 0;
    this.invulnerabilityTimer = 0;
    this.sceneMgr.setWeaponViewmodel('PISTOL');
  }

  public grantInvulnerability(durationSec: number): void {
    this.invulnerabilityTimer = Math.max(this.invulnerabilityTimer, durationSec);
  }

  public takeDamage(amount: number): void {
    if (this.isDead || this.invulnerabilityTimer > 0) return;

    const actualDmg = amount * (1 - this.stats.armorReduction);

    // Shield absorb first
    if (this.stats.shield > 0) {
      if (this.stats.shield >= actualDmg) {
        this.stats.shield -= actualDmg;
      } else {
        const overflow = actualDmg - this.stats.shield;
        this.stats.shield = 0;
        this.stats.hp -= overflow;
      }
    } else {
      this.stats.hp -= actualDmg;
    }

    this.audioMgr.playKickHit(false);
    this.sceneMgr.addTrauma(0.5);

    this.bus.emit('player:damaged', {
      amount: actualDmg,
      currentHp: Math.max(0, this.stats.hp),
      maxHp: this.stats.maxHp,
    });

    // Adrenaline slowmo trigger at low HP
    if (this.stats.hp / this.stats.maxHp <= this.stats.adrenalineThreshold && !this.stats.adrenalineActive) {
      this.stats.adrenalineActive = true;
      this.bus.emit('hitstop:trigger', { durationSec: 0.08 });
      this.audioMgr.setSlowmoFilter(true);
    }

    if (this.stats.hp <= 0) {
      this.stats.hp = 0;
      this.isDead = true;
      this.bus.emit('player:died');
    }
  }

  public heal(amount: number): void {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
    this.bus.emit('player:healed', { amount, currentHp: this.stats.hp });
    if (this.stats.hp / this.stats.maxHp > this.stats.adrenalineThreshold) {
      this.stats.adrenalineActive = false;
      this.audioMgr.setSlowmoFilter(false);
    }
  }

  public equipWeapon(type: WeaponType, ammo: number, isTrickshot = false): void {
    this.currentWeapon = type;
    this.currentAmmo = ammo;
    this.isTrickshot = isTrickshot;
    this.sceneMgr.setWeaponViewmodel(type);
    this.audioMgr.playWeaponCatch();

    this.bus.emit('player:weaponEquipped', { weapon: type, ammo, isTrickshot });

    if (isTrickshot) {
      this.bus.emit('ui:floatingText', {
        text: 'TRICKSHOT READY x2.2!',
        color: '#f2cc8f',
        scale: 1.8,
        worldPos: [this.position.x, this.position.y + 0.3, this.position.z],
        duration: 1.2,
      });
    }
  }

  /** Rotates camera based on mouse or touch look deltas */
  public addLookDelta(dx: number, dy: number, sensitivity = 1.0): void {
    const factor = 0.0025 * sensitivity;
    this.yaw -= dx * factor;
    this.pitch -= dy * factor;

    // Clamp pitch to avoid screen flip (-85 to 85 deg)
    const maxPitch = (85 * Math.PI) / 180;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Update orientation vectors
    this.forward.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize();
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }

  /** Performs the Core Kinetic Kick Attack */
  public performKick(enemies: Enemy[], doors: Door[], barrels: Barrel[], projectiles: Projectile[]): void {
    if (this.kickCooldown > 0 || this.kickState !== 'READY' || this.isDead) return;

    this.kickState = 'WINDUP';
    this.kickCooldown = this.stats.kickCooldownDuration;
    this.kickAnimProgress = 0;

    let hitOccurred = false;

    // 1. Check Door Breach (Tactical Breach-Ram)
    const doorTarget = PhysicsWorld.getInstance().findConeTarget(this.position, this.forward, 2.2, 52.0, doors.filter((d) => d.isClosed));
    if (doorTarget) {
      hitOccurred = true;
      const launchVec = this.forward.clone().multiplyScalar(26.0);
      doorTarget.breach(launchVec);

      this.bus.emit('hitstop:trigger', { durationSec: 0.04 });
      this.bus.emit('camera:fovKick', { targetFov: 102, durationSec: 0.35 });
      this.bus.emit('camera:shake', { intensity: 0.7, durationSec: 0.35 });
      this.audioMgr.playDoorBreach();
      ParticleSystem.getInstance().spawnSplinters(doorTarget.position, this.forward, 18);

      this.bus.emit('ui:floatingText', {
        text: 'DOOR BREACH!',
        color: '#fca311',
        scale: 2.0,
        worldPos: [doorTarget.position.x, doorTarget.position.y + 1.5, doorTarget.position.z],
        duration: 1.2,
      });

      // Damage enemies in breach cone
      for (const enemy of enemies) {
        const dist = enemy.position.distanceTo(doorTarget.position);
        if (dist <= 3.8) {
          const breachDmg = 120 * (1 - dist / 4.0);
          enemy.takeDamage(breachDmg, true);
          enemy.launchRagdoll(this.forward.clone().multiplyScalar(18.0));
        }
      }
    }

    // 2. Check Parryable Projectiles / Hazard Barrels (Hazard Redirection Kick)
    if (!hitOccurred) {
      const barrelTarget = PhysicsWorld.getInstance().findConeTarget(this.position, this.forward, 2.4, 52.0, barrels.filter((b) => !b.isDead));
      if (barrelTarget) {
        hitOccurred = true;
        barrelTarget.launch(this.forward, 24.0);
        this.grantInvulnerability(0.45);
        this.bus.emit('hitstop:trigger', { durationSec: 0.06 });
        this.bus.emit('camera:shake', { intensity: 0.7, durationSec: 0.25 });
        this.audioMgr.playAnvilReflect();

        this.bus.emit('ui:floatingText', {
          text: 'REFLECTED! x3.0',
          color: '#ff3300',
          scale: 1.9,
          worldPos: [barrelTarget.position.x, barrelTarget.position.y + 1.0, barrelTarget.position.z],
          duration: 1.2,
        });
      }
    }

    // 3. Check Parryable Enemy Missiles
    if (!hitOccurred) {
      const projTarget = PhysicsWorld.getInstance().findConeTarget(
        this.position,
        this.forward,
        2.2,
        60.0,
        projectiles.filter((p) => p.team === 'ENEMY' && p.isReflectable && !p.isDead)
      );
      if (projTarget) {
        hitOccurred = true;
        projTarget.team = 'PLAYER';
        projTarget.velocity = this.forward.clone().multiplyScalar(projTarget.baseSpeed * 2.4);
        projTarget.damageMultiplier = 3.0;
        this.grantInvulnerability(0.45);
        this.bus.emit('hitstop:trigger', { durationSec: 0.06 });
        this.bus.emit('camera:shake', { intensity: 0.6, durationSec: 0.25 });
        this.audioMgr.playAnvilReflect();

        this.bus.emit('ui:floatingText', {
          text: 'DEFLECTED! x3.0',
          color: '#00ffff',
          scale: 1.8,
          worldPos: [projTarget.position.x, projTarget.position.y + 0.5, projTarget.position.z],
          duration: 1.2,
        });
      }
    }

    // 4. Check Enemies Kick (Kinetic Wall-Splat Kick)
    if (!hitOccurred) {
      const enemyTarget = PhysicsWorld.getInstance().findConeTarget(this.position, this.forward, 2.5, 52.0, enemies.filter((e) => !e.isDead));
      if (enemyTarget) {
        hitOccurred = true;
        const currentSpeed = this.velocity.length();
        const launchSpeed = this.stats.kickLaunchVelocity + currentSpeed * 0.4;
        const launchVec = this.forward.clone().multiplyScalar(launchSpeed).setY(4.5);

        enemyTarget.launchRagdoll(launchVec);
        enemyTarget.takeDamage(this.stats.baseKickDamage, false);

        this.bus.emit('hitstop:trigger', { durationSec: 0.05 });
        this.bus.emit('camera:fovKick', { targetFov: 78, durationSec: 0.14 });
        this.bus.emit('camera:shake', { intensity: 0.5, durationSec: 0.2 });
        this.audioMgr.playKickHit(false);
        ParticleSystem.getInstance().spawnWallCrushDebris(enemyTarget.position, this.forward, 12);
      }
    }

    if (hitOccurred) {
      this.bus.emit('player:kicked', { hitCount: 1, isWhiff: false });
    } else {
      // Whiff miss: slowdown penalty and audio
      this.velocity.multiplyScalar(0.6);
      this.audioMgr.playKickWhiff();
      this.bus.emit('player:kicked', { hitCount: 0, isWhiff: true });
    }
  }

  /** Snatch airborne flying weapon in front of player */
  public tryCatchAirborneWeapon(pickups: WeaponPickup[]): boolean {
    const target = PhysicsWorld.getInstance().findConeTarget(
      this.position,
      this.forward,
      this.stats.disarmMagnetRadius,
      45.0,
      pickups.filter((p) => p.isAirborne && !p.isDead)
    );

    if (target) {
      this.equipWeapon(target.type, target.loadedAmmo, true);
      target.isDead = true;
      return true;
    }
    return false;
  }

  /** Fires equipped gun */
  public shoot(onSpawnBullet: (pos: THREE.Vector3, dir: THREE.Vector3, dmg: number) => void): void {
    if (this.shootCooldown > 0 || this.isDead) return;

    if (this.currentAmmo <= 0) {
      // Empty click
      this.audioMgr.playGunshot('EMPTY');
      return;
    }

    const data = WEAPON_REGISTRY[this.currentWeapon];
    this.shootCooldown = data.fireRate;
    this.currentAmmo--;

    const critMult = this.isTrickshot ? 2.2 : 1.0;
    const finalDamage = data.damage * critMult;

    // Shotgun pellets or single bullet
    for (let i = 0; i < data.pellets; i++) {
      const spreadX = (Math.random() - 0.5) * data.spread;
      const spreadY = (Math.random() - 0.5) * data.spread;
      const bulletDir = this.forward.clone().add(this.right.clone().multiplyScalar(spreadX)).add(new THREE.Vector3(0, spreadY, 0)).normalize();

      const muzzlePos = this.position.clone().add(this.forward.clone().multiplyScalar(0.4)).add(this.right.clone().multiplyScalar(0.2)).add(new THREE.Vector3(0, -0.1, 0));

      onSpawnBullet(muzzlePos, bulletDir, finalDamage);
    }

    this.audioMgr.playGunshot(this.currentWeapon, this.isTrickshot);
    this.sceneMgr.triggerMuzzleFlash();
    this.sceneMgr.addTrauma(data.recoil);

    // Reset trickshot after firing
    if (this.isTrickshot) {
      this.isTrickshot = false;
    }

    this.bus.emit('player:fired', { weapon: this.currentWeapon, ammoLeft: this.currentAmmo });
  }

  public update(dt: number, moveInput: { x: number; y: number }, isSprintOrSlide: boolean): void {
    if (this.isDead) return;

    // 1. Invulnerability
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer -= dt;
    }

    // 2. Cooldowns
    if (this.shootCooldown > 0) {
      this.shootCooldown -= dt;
    }
    if (this.kickCooldown > 0) {
      this.kickCooldown -= dt;
      if (this.kickCooldown <= 0) {
        this.kickState = 'READY';
      }
    }

    // 3. Movement
    const inputLen = Math.hypot(moveInput.x, moveInput.y);
    const speed = isSprintOrSlide ? this.stats.slideSpeed : this.stats.speed;

    if (inputLen > 0.05) {
      const normX = moveInput.x / inputLen;
      const normY = moveInput.y / inputLen;

      // Planar forward
      const planarForward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      const planarRight = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      const wishDir = new THREE.Vector3().addScaledVector(planarForward, normY).addScaledVector(planarRight, normX).normalize();

      this.velocity.x = wishDir.x * speed;
      this.velocity.z = wishDir.z * speed;
    } else {
      this.velocity.x *= 0.6;
      this.velocity.z *= 0.6;
    }

    // 4. Update Camera position & orientation in SceneManager
    const cam = this.sceneMgr.camera;
    cam.position.copy(this.position);
    cam.rotation.set(0, 0, 0);
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch;

    // 5. Update First-Person Kick Animation
    this.updateKickAnimation(dt);
  }

  private updateKickAnimation(dt: number): void {
    const boot = this.sceneMgr.bootMesh;
    const weaponGroup = this.sceneMgr.weaponMeshGroup;

    if (this.kickCooldown > 0) {
      boot.visible = true;
      const kickDuration = this.stats.kickCooldownDuration;
      const t = 1.0 - this.kickCooldown / kickDuration;

      if (t < 0.35) {
        // Thrust forward
        const thrust = t / 0.35;
        boot.position.set(0.05, -0.25 + Math.sin(thrust * Math.PI * 0.5) * 0.1, -0.3 - thrust * 0.75);
        boot.rotation.set(0.1 + thrust * 0.4, -0.15, 0.2);
        weaponGroup.position.set(0.2, -0.4, 0.1); // Lower gun during kick
      } else {
        // Retract
        const retract = (t - 0.35) / 0.65;
        boot.position.set(0.05, -0.25 - retract * 0.45, -1.05 + retract * 0.75);
        boot.rotation.set(0.5 - retract * 0.4, -0.15, 0.2);
        weaponGroup.position.set(0, 0, 0);
      }
    } else {
      boot.visible = false;
      weaponGroup.position.set(0, 0, 0);
    }
  }
}
