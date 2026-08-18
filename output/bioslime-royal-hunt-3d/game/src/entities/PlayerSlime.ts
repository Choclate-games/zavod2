import * as THREE from 'three';
import { PlayerStats } from '../types';
import { GameConfig } from '../config/GameConfig';
import { createSlimeMaterial } from '../rendering/SlimeShader';
import { StorageService } from '../platform/StorageService';
import { LAB_GENES_DATABASE } from '../config/LabUpgradesData';

export class PlayerSlime {
  public group: THREE.Group = new THREE.Group();
  public mesh: THREE.Mesh;
  public material: THREE.ShaderMaterial;
  public stats: PlayerStats;

  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public moveInput: THREE.Vector2 = new THREE.Vector2(0, 0);

  // Dash state
  public isDashing: boolean = false;
  public dashTimer: number = 0;
  public dashCooldownTimer: number = 0;

  // Invulnerability on revive or hit
  public invulnerableTimer: number = 0;

  // Visual sub-meshes for mutations
  private coreMesh: THREE.Mesh;
  private chitinArmorGroup: THREE.Group = new THREE.Group();
  private sporeBulbsGroup: THREE.Group = new THREE.Group();
  private spikesGroup: THREE.Group = new THREE.Group();

  // Internal lerped velocity for shader
  private shaderVelocity: THREE.Vector3 = new THREE.Vector3();
  private currentScale: number = 1.0;

  constructor() {
    const savedData = StorageService.getInstance().getData();
    const geneLevels = savedData.geneLevels || {};

    // Apply lab permanent gene bonuses
    const cytoBonus = (geneLevels['cytoplasm_density'] || 0) * 25;
    const chemoBonus = (geneLevels['chemotaxis'] || 0) * 0.08;
    const fermBonus = (geneLevels['digestive_ferments'] || 0) * 0.15;
    const magBonus = (geneLevels['biomass_magnetism'] || 0) * 0.2;
    const primalBonus = (geneLevels['primal_mass'] || 0) * 0.2;

    const baseMass = GameConfig.PLAYER.INITIAL_MASS * (1 + primalBonus);
    const maxHp = GameConfig.PLAYER.INITIAL_HP + cytoBonus;

    this.stats = {
      maxHp: maxHp,
      hp: maxHp,
      mass: baseMass,
      baseRadius: GameConfig.PLAYER.BASE_RADIUS,
      radius: GameConfig.PLAYER.BASE_RADIUS,
      baseSpeed: GameConfig.PLAYER.BASE_SPEED * (1 + chemoBonus),
      speed: GameConfig.PLAYER.BASE_SPEED * (1 + chemoBonus),
      damageReduction: 0,
      absorbPower: 1.0 + fermBonus,
      magnetRadius: GameConfig.PLAYER.BASE_MAGNET_RADIUS * (1 + magBonus),
      poisonDamage: GameConfig.PLAYER.BASE_POISON_DAMAGE * (1 + fermBonus),
      dashCooldown: GameConfig.PLAYER.DASH_COOLDOWN,
      dashDuration: GameConfig.PLAYER.DASH_DURATION,
      dashSpeedMult: GameConfig.PLAYER.DASH_SPEED_MULT,
      biomass: 0,
      biomassToNextLevel: 15,
      level: 1,
      dnaEarned: 0,
      enemiesAbsorbed: 0
    };

    // Slime outer mesh
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    this.material = createSlimeMaterial();
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    // Floating internal core nuclei
    const coreGeom = new THREE.SphereGeometry(0.38, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      wireframe: false
    });
    this.coreMesh = new THREE.Mesh(coreGeom, coreMat);
    this.group.add(this.coreMesh);

    // Mutation groups
    this.group.add(this.chitinArmorGroup);
    this.group.add(this.sporeBulbsGroup);
    this.group.add(this.spikesGroup);

    this.updateScaleAndRadius();
  }

  public updateScaleAndRadius(): void {
    // Volume / Mass scaling: Radius = BaseRadius * (Mass / BaseMass)^(1/3)
    const scaleFactor = Math.pow(this.stats.mass / GameConfig.PLAYER.INITIAL_MASS, 0.3333);
    this.currentScale = Math.max(0.7, scaleFactor);
    this.stats.radius = this.stats.baseRadius * this.currentScale;

    this.group.scale.set(this.currentScale, this.currentScale, this.currentScale);
    this.position.y = this.stats.radius;
    this.group.position.copy(this.position);

    // Recalculate move speed
    const massSpeedPenalty = Math.pow(this.stats.mass, GameConfig.PLAYER.SPEED_MASS_EXPONENT);
    this.stats.speed = (this.stats.baseSpeed / Math.max(1, massSpeedPenalty)) * 1.6;
    if (this.stats.speed < 5.0) this.stats.speed = 5.0; // Min move speed floor
  }

  public addBiomass(amount: number): boolean {
    const earned = amount * this.stats.absorbPower;
    this.stats.biomass += earned;
    this.stats.mass += earned * 0.45; // Increase mass and size
    this.updateScaleAndRadius();

    // Check level up
    if (this.stats.biomass >= this.stats.biomassToNextLevel) {
      this.stats.biomass -= this.stats.biomassToNextLevel;
      this.stats.level++;
      this.stats.biomassToNextLevel = Math.floor(this.stats.biomassToNextLevel * 1.45 + 10);
      return true; // Leveled up!
    }
    return false;
  }

  public heal(amount: number): void {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  public takeDamage(dmg: number): boolean {
    if (this.invulnerableTimer > 0) return false;

    const mitigated = dmg * (1 - this.stats.damageReduction);
    this.stats.hp -= mitigated;

    // Trigger hit visual pulse
    this.material.uniforms.uHitPulse.value = 1.0;

    return this.stats.hp <= 0;
  }

  public tryDash(): boolean {
    if (this.dashCooldownTimer > 0 || this.isDashing) return false;

    this.isDashing = true;
    this.dashTimer = this.stats.dashDuration;
    this.dashCooldownTimer = this.stats.dashCooldown;

    // Deduct slight mass for dash
    const cost = this.stats.mass * GameConfig.PLAYER.DASH_MASS_COST_PERCENT;
    if (this.stats.mass - cost > GameConfig.PLAYER.INITIAL_MASS * 0.8) {
      this.stats.mass -= cost;
      this.updateScaleAndRadius();
    }
    return true;
  }

  public update(dt: number, totalTime: number): void {
    // Regenerate HP based on lab upgrade
    const savedData = StorageService.getInstance().getData();
    const regenBonus = (savedData.geneLevels['cytoplasm_density'] || 0) * 0.5;
    if (regenBonus > 0 && this.stats.hp < this.stats.maxHp) {
      this.heal(regenBonus * dt);
    }

    // Cooldown timers
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= dt;
    }
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }

    // Dash status
    let currentSpeed = this.stats.speed;
    if (this.isDashing) {
      this.dashTimer -= dt;
      currentSpeed *= this.stats.dashSpeedMult;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }

    // Process Movement Input
    if (this.moveInput.lengthSq() > 0.01) {
      const dir = this.moveInput.clone().normalize();
      const targetVx = dir.x * currentSpeed;
      const targetVz = dir.y * currentSpeed;

      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVx, dt * 14);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVz, dt * 14);
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, dt * 10);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, dt * 10);
    }

    // Move position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Bounds check
    const maxR = GameConfig.ARENA_RADIUS - this.stats.radius;
    const curDist = Math.hypot(this.position.x, this.position.z);
    if (curDist > maxR && curDist > 0.001) {
      const factor = maxR / curDist;
      this.position.x *= factor;
      this.position.z *= factor;
    }

    this.position.y = this.stats.radius;
    this.group.position.copy(this.position);

    // Update Shader Material Uniforms
    this.shaderVelocity.lerp(this.velocity, dt * 8);
    this.material.uniforms.uTime.value = totalTime;
    this.material.uniforms.uVelocity.value.copy(this.shaderVelocity);
    this.material.uniforms.uSquashFactor.value = this.isDashing ? 2.5 : 1.0;

    // Decay hit pulse
    if (this.material.uniforms.uHitPulse.value > 0) {
      this.material.uniforms.uHitPulse.value = Math.max(0, this.material.uniforms.uHitPulse.value - dt * 4.0);
    }

    // Core wobble
    this.coreMesh.position.set(
      Math.sin(totalTime * 3) * 0.1,
      Math.cos(totalTime * 4) * 0.1,
      Math.sin(totalTime * 2) * 0.1
    );
  }

  // ---------------- VISUAL MUTATION UPGRADES ----------------
  public setChitinArmorVisual(active: boolean, level = 1): void {
    this.chitinArmorGroup.clear();
    if (!active) return;

    const plateGeom = new THREE.BoxGeometry(0.35, 0.12, 0.45);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.4,
      metalness: 0.7
    });

    const count = Math.min(8, 2 + level * 2);
    for (let i = 0; i < count; i++) {
      const plate = new THREE.Mesh(plateGeom, plateMat);
      const angle = (i / count) * Math.PI * 2;
      plate.position.set(Math.cos(angle) * 0.88, 0.35, Math.sin(angle) * 0.88);
      plate.rotation.y = -angle;
      plate.rotation.x = 0.3;
      this.chitinArmorGroup.add(plate);
    }
  }

  public setSporeBulbsVisual(active: boolean, level = 1): void {
    this.sporeBulbsGroup.clear();
    if (!active) return;

    const bulbGeom = new THREE.SphereGeometry(0.2, 8, 8);
    const bulbMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      wireframe: false
    });

    const count = Math.min(6, 2 + level);
    for (let i = 0; i < count; i++) {
      const bulb = new THREE.Mesh(bulbGeom, bulbMat);
      const angle = (i / count) * Math.PI * 2 + 0.3;
      bulb.position.set(Math.cos(angle) * 0.75, 0.7, Math.sin(angle) * 0.75);
      this.sporeBulbsGroup.add(bulb);
    }
  }

  public setAcidSpikesVisual(active: boolean, level = 1): void {
    this.spikesGroup.clear();
    if (!active) return;

    const spikeGeom = new THREE.ConeGeometry(0.12, 0.6, 6);
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      roughness: 0.3,
      metalness: 0.8
    });

    const count = Math.min(10, 3 + level * 2);
    for (let i = 0; i < count; i++) {
      const spike = new THREE.Mesh(spikeGeom, spikeMat);
      const angle = (i / count) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.95, 0.1, Math.sin(angle) * 0.95);
      spike.rotation.z = -Math.PI / 2;
      spike.rotation.y = -angle;
      this.spikesGroup.add(spike);
    }
  }
}
