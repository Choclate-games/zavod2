import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { bus } from '../core/EventBus';
import { ARENA, PLAYER, RESOURCES, SPOTLIGHT, math } from '../config/GameConfig';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { InputState } from '../core/InputManager';
import { Weapon } from './Weapon';

export interface PlayerStats {
  maxAir: number;
  maxEnergy: number;
  maxHull: number;
  thrustMul: number;
  regenMul: number;
  pulseDmgMul: number;
  heavyDmgMul: number;
  lightEffMul: number;
  sampleHullRegen: number;
}

const FORWARD = new THREE.Vector3(0, -0.25, -1).normalize();

export class Player {
  readonly body: RAPIER.RigidBody;
  readonly group = new THREE.Group();
  private glowMat!: THREE.MeshStandardMaterial;

  air: number;
  energy: number;
  hull: number;
  stats: PlayerStats;

  private contactCd = 0;
  private spotlightTier = 1;
  private lowAirWarned = false;
  invuln = 0;
  readonly weapon: Weapon;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
  ) {
    this.stats = Player.createStats();
    this.air = this.stats.maxAir;
    this.energy = this.stats.maxEnergy;
    this.hull = this.stats.maxHull;
    this.weapon = new Weapon(
      () => this.energy,
      (n) => {
        this.energy = Math.max(0, this.energy - n);
      },
    );

    this.body = physics.createDynamicBody({
      x: 0,
      y: -4,
      z: 0,
      linearDamping: PLAYER.linearDamping,
      angularDamping: PLAYER.angularDamping,
      ccd: true,
    });
    physics.attachBall(this.body, PLAYER.radius, 0.2, 0.4);

    this.buildMesh();
    scene.add(this.group);
  }

  static createStats(): PlayerStats {
    return {
      maxAir: RESOURCES.air.max,
      maxEnergy: RESOURCES.energy.max,
      maxHull: RESOURCES.hull.max,
      thrustMul: 1,
      regenMul: 1,
      pulseDmgMul: 1,
      heavyDmgMul: 1,
      lightEffMul: 1,
      sampleHullRegen: 0,
    };
  }

  private buildMesh(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x9fe6ff,
      emissive: new THREE.Color(0x9fe6ff).multiplyScalar(0.18),
      roughness: 0.45,
      metalness: 0.55,
    });
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 1.4, 6, 12), bodyMat);
    hull.rotation.x = Math.PI / 2; // long axis along Z (forward)
    hull.castShadow = true;
    this.group.add(hull);

    const fin = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a6f9e, roughness: 0.6 }),
    );
    fin.position.set(0, 0.2, 1.2);
    this.group.add(fin);

    this.glowMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c4,
      emissive: new THREE.Color(0xfff2c4).multiplyScalar(1.2),
      roughness: 0.3,
    });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), this.glowMat);
    eye.position.set(0, 0.1, -1.0);
    this.group.add(eye);
  }

  /** Reset for a brand new run at the surface. */
  spawn(): void {
    this.stats = Player.createStats();
    this.air = this.stats.maxAir;
    this.energy = this.stats.maxEnergy;
    this.hull = this.stats.maxHull;
    this.weapon.reset();
    this.contactCd = 0;
    this.lowAirWarned = false;
    this.body.setTranslation({ x: 0, y: -4, z: 0 }, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.resetForces(true);
    this.body.resetTorques(true);
    this.body.wakeUp();
  }

  /** Reset cooldowns for a new run. */
  resetWeapon(): void {
    this.weapon.reset();
  }

  applyUpgrade(id: string): void {
    const s = this.stats;
    switch (id) {
      case 'air': s.maxAir += 30; break;
      case 'hull': s.maxHull += 35; break;
      case 'energy': s.maxEnergy += 40; s.regenMul += 0.25; break;
      case 'light': s.lightEffMul += 0.35; break;
      case 'pulse': s.pulseDmgMul += 0.45; break;
      case 'heavy': s.heavyDmgMul += 0.6; break;
      case 'thrust': s.thrustMul += 0.25; break;
      case 'regen': s.sampleHullRegen += 2; break;
      default: break;
    }
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get depth(): number {
    return Math.max(0, -this.body.translation().y);
  }

  /** Read input, apply forces & decide pulse firing (emits pulse:fired). */
  handleInput(input: InputState, dt: number): void {
    this.weapon.tick(dt);

    let ix = input.moveX;
    let iz = input.moveZ;
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    const boost = input.boost ? PLAYER.boostMultiplier : 1;
    const intensity = Math.min(1, len + ((input.ascend ? 1 : 0) + (input.descend ? 1 : 0)) * 0.6);

    if (intensity > 0.05 && this.energy > RESOURCES.energy.emptyThreshold) {
      const force = PLAYER.thrustForce * this.stats.thrustMul * boost;
      const impulse: RAPIER.Vector3 = {
        x: ix * force * dt,
        y: ((input.ascend ? 1 : 0) - (input.descend ? 1 : 0)) * force * 0.8 * dt,
        z: iz * force * dt,
      };
      this.body.applyImpulse(impulse, true);
      // Thrust draws from the shared power budget.
      this.energy = Math.max(0, this.energy - RESOURCES.energy.thrustCostPerSec * intensity * dt);
    }

    // Pulse (primary / heavy) — gated by cooldown + energy, emits to combat.
    if (input.heavy) {
      if (this.weapon.tryPulse(true)) bus.emit('pulse:fired', { heavy: true });
    } else if (input.pulse) {
      if (this.weapon.tryPulse(false)) bus.emit('pulse:fired', { heavy: false });
    }

    // Cap speed.
    const v = this.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    const maxS = PLAYER.maxSpeed * this.stats.thrustMul;
    if (speed > maxS) {
      const k = maxS / speed;
      this.body.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
    }
  }

  /** Resource simulation + spotlight tier + sync. */
  update(dt: number, scene: { setPlayerLight(p: THREE.Vector3, d: THREE.Vector3, tier: number): void; setPlayerGlow(v: boolean): void }): void {
    const t = this.body.translation();
    const pos = new THREE.Vector3(t.x, t.y, t.z);

    // Air: refill near surface, drain deeper.
    if (pos.y > RESOURCES.air.surfaceThreshold) {
      this.air = Math.min(this.stats.maxAir, this.air + RESOURCES.air.refillPerSec * dt);
    } else {
      this.air = Math.max(0, this.air - RESOURCES.air.drainPerSec * dt);
    }
    if (this.air <= 0) {
      this.hull = Math.max(0, this.hull - RESOURCES.hull.airLossDamagePerSec * dt);
    }

    // Energy: light draws power (tier-based), passive regen otherwise.
    const lightTierIdx = this.spotlightTier as 0 | 1 | 2;
    this.energy = Math.max(0, this.energy - RESOURCES.energy.lightCostPerSec[lightTierIdx] * dt);
    this.energy = Math.min(this.stats.maxEnergy, this.energy + RESOURCES.energy.regenPerSec * this.stats.regenMul * dt);

    // Spotlight brightness tracks remaining power — the core tension made visible.
    const prevTier = this.spotlightTier;
    const ratio = this.energy / this.stats.maxEnergy;
    this.spotlightTier = ratio > 0.55 ? 2 : ratio > 0.22 ? 1 : 0;
    if (this.spotlightTier !== prevTier) {
      bus.emit('player:spotlight', { tier: this.spotlightTier });
    }

    if (this.contactCd > 0) this.contactCd -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    // Collision (scrape) damage when slamming walls at speed.
    const v = this.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    const margin = PLAYER.radius + 0.25;
    const nearWall =
      Math.abs(pos.x) > ARENA.halfX - margin ||
      Math.abs(pos.z) > ARENA.halfZ - margin ||
      pos.y < ARENA.depthY + margin ||
      pos.y > ARENA.surfaceY + 1.5 - margin;
    if (nearWall && speed > RESOURCES.hull.collisionSpeedThreshold && this.contactCd <= 0) {
      const dmg = (speed - RESOURCES.hull.collisionSpeedThreshold) * RESOURCES.hull.collisionDamageScale;
      this.damage(dmg, 'impact');
      this.contactCd = 0.3;
    }

    // Low-air warning (once per run threshold crossing).
    if (this.air < 18 && !this.lowAirWarned) {
      this.lowAirWarned = true;
      bus.emit('ui:toast', { text: 'toast.lowair' });
    }

    // Sync visual + light.
    const r = this.body.rotation();
    this.group.position.copy(pos);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
    const effTier = Math.min(this.spotlightTier, 2);
    scene.setPlayerLight(pos, FORWARD, effTier);
    scene.setPlayerGlow(this.energy > RESOURCES.energy.emptyThreshold);

    // Emit HUD events.
    bus.emit('player:air', { air: this.air, max: this.stats.maxAir });
    bus.emit('player:energy', { energy: this.energy, max: this.stats.maxEnergy });
    bus.emit('player:hull', { hull: this.hull, max: this.stats.maxHull });
    bus.emit('player:depth', { depth: this.depth });
  }

  /** Apply hull damage from any source. */
  damage(amount: number, source: string): void {
    if (amount <= 0 || this.invuln > 0) return;
    this.hull = Math.max(0, this.hull - amount);
    bus.emit('player:damage', { amount, source });
    bus.emit('player:hull', { hull: this.hull, max: this.stats.maxHull });
  }

  onSampleCollected(): void {
    if (this.stats.sampleHullRegen > 0) {
      this.hull = Math.min(this.stats.maxHull, this.hull + this.stats.sampleHullRegen);
      bus.emit('player:hull', { hull: this.hull, max: this.stats.maxHull });
    }
  }

  /** Effective pulse parameters after upgrades. */
  pulseParams(heavy: boolean): { radius: number; damage: number } {
    return heavy
      ? { radius: PLAYER.heavyPulseRadius, damage: PLAYER.heavyPulseDamage * this.stats.heavyDmgMul }
      : { radius: PLAYER.pulseRadius, damage: PLAYER.pulseDamage * this.stats.pulseDmgMul };
  }
}
