// src/entities/BaseCore.ts
// Central Orbital Base Reactor Core entity, shield dome and health coordinator

import * as THREE from 'three';
import { sceneManager } from '../rendering/SceneManager';
import { MeshFactory } from '../rendering/MeshFactory';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../audio/AudioManager';

export class BaseCore {
  private static instance: BaseCore;
  private root!: THREE.Group;
  private rings: THREE.Mesh[] = [];
  private shieldDome!: THREE.Mesh;
  private coreSphere!: THREE.Mesh;

  public maxHp = 1000;
  public currentHp = 1000;
  public maxShield = 300;
  public currentShield = 300;
  private shieldRechargeTimer = 0;
  private isDestroyed = false;

  private constructor() {}

  public static getInstance(): BaseCore {
    if (!BaseCore.instance) {
      BaseCore.instance = new BaseCore();
    }
    return BaseCore.instance;
  }

  public init(): void {
    const scene = sceneManager.getScene();
    const coreRig = MeshFactory.createBaseCore();
    this.root = coreRig.root;
    this.rings = coreRig.rings;
    this.shieldDome = coreRig.shieldDome;
    this.coreSphere = coreRig.coreSphere;

    scene.add(this.root);
    this.reset();
  }

  public reset(): void {
    this.currentHp = this.maxHp;
    this.currentShield = this.maxShield;
    this.isDestroyed = false;
    this.shieldDome.visible = true;
    this.root.position.set(0, 0, 0);
    this.emitStatus();
  }

  public takeDamage(amount: number): void {
    if (this.isDestroyed) return;

    this.shieldRechargeTimer = 4.0; // delay before shield recharge

    if (this.currentShield > 0) {
      this.currentShield = Math.max(0, this.currentShield - amount);
      audioManager.playShieldHit();
      sceneManager.getParticles().emitSparks(0, 2.0, 0, 6, 0x00d4ff);
      if (this.currentShield <= 0) {
        this.shieldDome.visible = false;
        sceneManager.getParticles().emitExplosion(0, 2.0, 0, 16);
      }
    } else {
      this.currentHp = Math.max(0, this.currentHp - amount);
      audioManager.playExplosion(false);
      sceneManager.getParticles().emitSparks(0, 1.5, 0, 10, 0xff3300);
      sceneManager.triggerScreenShake(0.5, 0.3);

      if (this.currentHp <= 0) {
        this.isDestroyed = true;
        sceneManager.getParticles().emitExplosion(0, 2.5, 0, 36, true);
        eventBus.emit('base:destroyed', undefined);
      }
    }

    this.emitStatus();
  }

  public repair(amount: number): void {
    if (this.isDestroyed) return;
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    this.emitStatus();
  }

  private emitStatus(): void {
    eventBus.emit('base:damaged', {
      currentHp: this.currentHp,
      maxHp: this.maxHp,
    });
  }

  public update(dt: number): void {
    if (this.isDestroyed) return;

    // Rings rotation
    if (this.rings[0]) {
      this.rings[0].rotation.x += 1.2 * dt;
      this.rings[0].rotation.y += 0.8 * dt;
    }
    if (this.rings[1]) {
      this.rings[1].rotation.x -= 0.7 * dt;
      this.rings[1].rotation.z += 1.1 * dt;
    }

    // Core pulsing scale
    const time = performance.now() * 0.003;
    const pulse = 1.0 + Math.sin(time) * 0.08;
    this.coreSphere.scale.set(pulse, pulse, pulse);

    // Shield Dome recharge
    if (this.currentShield < this.maxShield) {
      if (this.shieldRechargeTimer > 0) {
        this.shieldRechargeTimer -= dt;
      } else {
        this.currentShield = Math.min(this.maxShield, this.currentShield + 25 * dt);
        if (this.currentShield > 0) {
          this.shieldDome.visible = true;
        }
      }
    }
  }
}

export const baseCore = BaseCore.getInstance();
