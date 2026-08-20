import * as THREE from 'three';
import { Ragdoll } from '../physics/Ragdoll';
import { Weapon } from './Weapon';
import { InputState } from '../input/InputManager';
import { globalEventBus } from '../core/EventBus';

export class Player {
  public ragdoll: Ragdoll;
  public weapon: Weapon;

  public maxHp: number = 100;
  public hp: number = 100;
  public maxStamina: number = 100;
  public stamina: number = 100;
  public moveSpeed: number = 7.2;

  public isAlive: boolean = true;
  public isInvulnerable: boolean = false;
  private invulnerableTimer: number = 0;

  // Dash & Tackle
  private dashCooldown: number = 0;
  private tackleCooldown: number = 0;
  public isDashing: boolean = false;

  // Attack & Swing state
  public swingPhase: number = 0;
  private autoSwingDirection: number = 1;

  // Active perks & modifiers
  public perks = {
    serratedBlade: false, // lower armor shear threshold by 35%
    spikedArmor: false, // +45 damage on body tackle
    vestaFlame: false, // ignite blade
    crowdFavorite: false, // +25% favor gain
  };

  constructor() {
    this.ragdoll = new Ragdoll({
      massKg: 80.0,
      jointMotorTorque: 850.0,
      height: 1.85,
      isPlayer: true,
      colorArmor: 0xd4af37, // Roman Gold / Bronze
      colorSkin: 0xd2a679,
      colorCloth: 0x8b1e1e, // Imperial Roman Red
    });

    this.weapon = new Weapon({
      massKg: 4.2,
      bladeLengthM: 1.25,
      baseDamage: 40,
    });

    // Mount weapon to right arm
    this.ragdoll.rightArmMesh.add(this.weapon.mesh);
    this.weapon.mesh.position.set(0, -0.4, 0.1);
    this.weapon.mesh.rotation.x = Math.PI * 0.5;

    // Equip round legionary buckler / shield
    this.ragdoll.equipShield(0x8b1e1e);
  }

  public takeDamage(amount: number, knockback?: THREE.Vector3): void {
    if (!this.isAlive || this.isInvulnerable) return;

    this.hp = Math.max(0, this.hp - amount);
    globalEventBus.emit('player:damaged', { currentHp: this.hp, maxHp: this.maxHp, damage: amount });
    globalEventBus.emit('camera:shake', { intensity: 0.35, duration: 0.25 });
    globalEventBus.emit('audio:play_sfx', { sound: 'flesh_impact', pitchVariation: 0.9 });

    if (knockback) {
      this.ragdoll.applyImpulse(knockback);
    }

    if (this.hp <= 0) {
      this.die();
    }
  }

  public heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    globalEventBus.emit('player:damaged', { currentHp: this.hp, maxHp: this.maxHp, damage: 0 });
  }

  public revive(): void {
    this.isAlive = true;
    this.hp = Math.floor(this.maxHp * 0.6);
    this.isInvulnerable = true;
    this.invulnerableTimer = 3.0; // 3s invulnerability wave
    this.ragdoll.isKnockedDown = false;
    globalEventBus.emit('player:revived', undefined);
    globalEventBus.emit('player:damaged', { currentHp: this.hp, maxHp: this.maxHp, damage: 0 });
  }

  private die(): void {
    this.isAlive = false;
    this.ragdoll.triggerKnockdown(999);
    globalEventBus.emit('player:died', undefined);
    globalEventBus.emit('audio:play_sfx', { sound: 'wall_smash', pitchVariation: 0.7 });
  }

  public update(dt: number, input: InputState): void {
    if (!this.isAlive) {
      this.ragdoll.update(dt);
      return;
    }

    // Invulnerability timer
    if (this.isInvulnerable) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
      }
    }

    // Cooldowns & Stamina regeneration
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.tackleCooldown > 0) this.tackleCooldown -= dt;
    if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 25 * dt);
      globalEventBus.emit('player:stamina_changed', { current: this.stamina, max: this.maxStamina });
    }

    // 1. Movement & Input resolution
    const moveLen = Math.hypot(input.moveX, input.moveY);
    if (moveLen > 0.05 && !this.ragdoll.isKnockedDown && !this.ragdoll.isStaggered) {
      const moveAngle = Math.atan2(input.moveX, input.moveY);
      this.ragdoll.targetRotationY = moveAngle;

      const currentSpeed = this.isDashing ? this.moveSpeed * 2.2 : this.moveSpeed;
      const targetVelX = Math.sin(moveAngle) * currentSpeed * moveLen;
      const targetVelZ = Math.cos(moveAngle) * currentSpeed * moveLen;

      this.ragdoll.velocity.x = THREE.MathUtils.lerp(this.ragdoll.velocity.x, targetVelX, Math.min(1.0, 16.0 * dt));
      this.ragdoll.velocity.z = THREE.MathUtils.lerp(this.ragdoll.velocity.z, targetVelZ, Math.min(1.0, 16.0 * dt));
    }

    // 2. Dash Skill (Space / Mobile Dash)
    if (input.isDashing && this.dashCooldown <= 0 && this.stamina >= 30) {
      this.stamina -= 30;
      this.dashCooldown = 0.85;
      this.isDashing = true;
      this.isInvulnerable = true;
      this.invulnerableTimer = 0.25;

      const dashDirX = input.moveX !== 0 || input.moveY !== 0 ? input.moveX : Math.sin(this.ragdoll.rotationY);
      const dashDirZ = input.moveX !== 0 || input.moveY !== 0 ? input.moveY : Math.cos(this.ragdoll.rotationY);
      const len = Math.hypot(dashDirX, dashDirZ) || 1;

      this.ragdoll.velocity.x = (dashDirX / len) * 18.0;
      this.ragdoll.velocity.z = (dashDirZ / len) * 18.0;

      globalEventBus.emit('audio:play_sfx', { sound: 'dash', pitchVariation: 1.1 });
      setTimeout(() => { this.isDashing = false; }, 220);
    }

    // 3. Tackle / Shield Bash
    if (input.isTackling && this.tackleCooldown <= 0 && this.stamina >= 25) {
      this.stamina -= 25;
      this.tackleCooldown = 1.2;
      const fwdX = Math.sin(this.ragdoll.rotationY);
      const fwdZ = Math.cos(this.ragdoll.rotationY);
      this.ragdoll.velocity.x += fwdX * 12.0;
      this.ragdoll.velocity.z += fwdZ * 12.0;
      globalEventBus.emit('audio:play_sfx', { sound: 'tackle', pitchVariation: 0.95 });
    }

    // 4. Kinetic Weapon Swing Mechanics
    if (input.isAttacking || input.isHeavyAttacking) {
      const swingSpeed = input.isHeavyAttacking ? 16.0 : 20.0;
      this.swingPhase += swingSpeed * dt * this.autoSwingDirection;
      if (this.swingPhase > Math.PI * 0.8) {
        this.swingPhase = Math.PI * 0.8;
        this.autoSwingDirection = -1;
      } else if (this.swingPhase < -Math.PI * 0.8) {
        this.swingPhase = -Math.PI * 0.8;
        this.autoSwingDirection = 1;
      }
    } else {
      this.swingPhase = THREE.MathUtils.lerp(this.swingPhase, 0, Math.min(1.0, 10.0 * dt));
    }

    // Update weapon rotation and tip tracking
    this.weapon.update(dt, this.ragdoll.position, this.ragdoll.rotationY, this.swingPhase);

    // Update ragdoll physics simulation
    this.ragdoll.update(dt);
  }
}
