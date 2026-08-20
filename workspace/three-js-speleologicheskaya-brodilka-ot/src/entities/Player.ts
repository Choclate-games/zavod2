import * as THREE from "three";
import { CollisionBody } from "../physics/CollisionBody";
import { GameStats, GAME_CONSTANTS } from "../utils/Constants";
import { EventBus } from "../core/EventBus";
import { MathUtils } from "../utils/MathUtils";

export class Player {
  public mesh: THREE.Group;
  public body: CollisionBody;
  public stats: GameStats;
  private eventBus: EventBus;

  // Visual sub-meshes
  private bodyMesh: THREE.Mesh;
  private visorMesh: THREE.Mesh;
  private scannerMesh: THREE.Mesh;
  private scannerLight: THREE.PointLight;

  // Movement & Input
  public moveInput: THREE.Vector2 = new THREE.Vector2();
  public isSprinting: boolean = false;
  public isCrouching: boolean = false;
  public facingAngle: number = 0;
  
  // Jump & Fall tracking
  private previousYVelocity: number = 0;
  private wasGrounded: boolean = true;
  private stepTimer: number = 0;

  // Invulnerability after hit / revive
  public invulnerableTimer: number = 0;

  constructor(position: THREE.Vector3, stats: GameStats, eventBus: EventBus) {
    this.stats = stats;
    this.eventBus = eventBus;

    // 1. Create 3D Mesh
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Torso / Suit
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.28, 1.1, 12);
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x1f293d,
      roughness: 0.4,
      metalness: 0.6
    });
    this.bodyMesh = new THREE.Mesh(torsoGeo, suitMat);
    this.bodyMesh.position.y = 0.85;
    this.mesh.add(this.bodyMesh);

    // Helmet / Visor
    const helmetGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 1.5;
    this.mesh.add(helmet);

    const visorGeo = new THREE.BoxGeometry(0.26, 0.12, 0.16);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.visorMesh = new THREE.Mesh(visorGeo, visorMat);
    this.visorMesh.position.set(0, 1.5, 0.16);
    this.mesh.add(this.visorMesh);

    // Backpack LiDAR battery
    const packGeo = new THREE.BoxGeometry(0.38, 0.55, 0.22);
    const packMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const backpack = new THREE.Mesh(packGeo, packMat);
    backpack.position.set(0, 0.9, -0.22);
    this.mesh.add(backpack);

    // Scanner Device
    const scanGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8);
    scanGeo.rotateX(Math.PI / 2);
    const scanMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00a8b3 });
    this.scannerMesh = new THREE.Mesh(scanGeo, scanMat);
    this.scannerMesh.position.set(0.35, 0.8, 0.3);
    this.mesh.add(this.scannerMesh);

    this.scannerLight = new THREE.PointLight(0x00f0ff, 2.0, 10, 1.5);
    this.scannerLight.position.set(0, 1.2, 0.5);
    this.mesh.add(this.scannerLight);

    // 2. Physics Body
    this.body = new CollisionBody(
      "player",
      position,
      "PLAYER",
      false,
      0.45,
      1.8
    );
  }

  public setPosition(x: number, y: number, z: number): void {
    this.body.position.set(x, y, z);
    this.body.velocity.set(0, 0, 0);
    this.mesh.position.set(x, y, z);
  }

  public update(dt: number): void {
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.mesh.visible = Math.floor(Date.now() / 100) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // 1. Energy Regeneration
    if (this.stats.energy < this.stats.maxEnergy) {
      this.stats.energy = Math.min(
        this.stats.maxEnergy,
        this.stats.energy + this.stats.energyRechargeRate * dt
      );
      this.eventBus.emit("player:energy_changed", {
        energy: this.stats.energy,
        maxEnergy: this.stats.maxEnergy
      });
    }

    // 2. Movement Calculations
    const inputLen = this.moveInput.length();
    let currentSpeed = this.stats.walkSpeed;

    if (this.isSprinting && inputLen > 0.1 && this.stats.energy > 5) {
      currentSpeed = this.stats.sprintSpeed;
      this.stats.energy = Math.max(0, this.stats.energy - 8.0 * dt);
      this.eventBus.emit("player:energy_changed", {
        energy: this.stats.energy,
        maxEnergy: this.stats.maxEnergy
      });
    } else if (this.isCrouching) {
      currentSpeed = this.stats.walkSpeed * 0.5;
    }

    if (inputLen > 0.05) {
      const dir = this.moveInput.clone().normalize();
      this.body.velocity.x = dir.x * currentSpeed;
      this.body.velocity.z = dir.y * currentSpeed;

      // Smooth rotate towards movement direction
      const targetAngle = Math.atan2(dir.x, dir.y);
      this.facingAngle = MathUtils.damp(this.facingAngle, targetAngle, 12, dt);
      this.mesh.rotation.y = this.facingAngle;

      // Footstep sound & noise generation
      this.stepTimer += dt * (currentSpeed / this.stats.walkSpeed);
      if (this.stepTimer >= 0.38) {
        this.stepTimer = 0;
        if (this.body.isGrounded) {
          this.emitFootstep();
        }
      }
    } else {
      this.stepTimer = 0;
    }

    // 3. Fall Damage & Landing Detection
    if (!this.wasGrounded && this.body.isGrounded) {
      const impactVelocity = Math.abs(this.previousYVelocity);
      this.onLand(impactVelocity);
    }
    this.wasGrounded = this.body.isGrounded;
    this.previousYVelocity = this.body.velocity.y;

    // Check bottomless pit
    if (this.body.position.y < -15.0) {
      this.eventBus.emit("player:fell_into_abyss", undefined as any);
    }

    // Sync mesh position
    this.mesh.position.copy(this.body.position);
  }

  public jump(): boolean {
    if (!this.body.isGrounded) return false;
    this.body.velocity.y = this.stats.jumpForce;
    this.body.isGrounded = false;
    this.emitNoise(this.stats.stepNoiseWeight * 1.5);
    return true;
  }

  public emitFootstep(): void {
    let noise = this.stats.stepNoiseWeight;
    if (this.isCrouching) noise *= this.stats.crouchNoiseMult;
    else if (this.isSprinting) noise *= 1.4;

    this.emitNoise(noise);
  }

  public emitNoise(dbLevel: number): void {
    const alertRatio = MathUtils.clamp(dbLevel / 60.0, 0, 1);
    this.eventBus.emit("player:noise_changed", {
      noiseLevel: dbLevel,
      alertLevel: alertRatio
    });
  }

  private onLand(impactVelocity: number): void {
    // Exact specification formula:
    // fall_damage = max(0.0, (impact_vertical_velocity - safe_velocity_threshold) * fall_damage_multiplier)
    const excess = impactVelocity - this.stats.fallDamageThreshold;
    if (excess > 0) {
      const damage = Math.round(excess * this.stats.fallDamageMultiplier);
      this.takeDamage(damage, "fall");
    }

    // Infrasound shockwave on heavy landing if perk active
    if (this.stats.infrasoundStunActive && impactVelocity > 4.5) {
      this.eventBus.emit("stalker:stunned", {
        position: { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z },
        duration: 2.5
      });
    }

    this.emitNoise(Math.min(50, this.stats.stepNoiseWeight * (1 + impactVelocity * 0.3)));
  }

  public takeDamage(amount: number, source: string = "stalker"): void {
    if (this.invulnerableTimer > 0) return;

    const finalDamage = Math.max(1, Math.round(amount * this.stats.acousticArmorMult));
    this.stats.hp = Math.max(0, this.stats.hp - finalDamage);
    this.invulnerableTimer = 0.8;

    this.eventBus.emit("player:hurt", { damage: finalDamage, source });
    this.eventBus.emit("player:hp_changed", { hp: this.stats.hp, maxHp: this.stats.maxHp });

    if (this.stats.hp <= 0) {
      this.eventBus.emit("player:died", { reason: source });
    }
  }

  public revive(): void {
    this.stats.hp = Math.round(this.stats.maxHp * 0.5);
    this.invulnerableTimer = 3.0;
    this.eventBus.emit("player:hp_changed", { hp: this.stats.hp, maxHp: this.stats.maxHp });
    this.eventBus.emit("player:revived", undefined as any);

    // Shockwave repels enemies
    this.eventBus.emit("stalker:stunned", {
      position: { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z },
      duration: 3.0
    });
  }

  public canPulseSonar(): boolean {
    return this.stats.energy >= this.stats.pulseEnergyCost;
  }

  public consumeSonarEnergy(): void {
    this.stats.energy = Math.max(0, this.stats.energy - this.stats.pulseEnergyCost);
    this.eventBus.emit("player:energy_changed", {
      energy: this.stats.energy,
      maxEnergy: this.stats.maxEnergy
    });

    // Sound output from active ping
    this.emitNoise(this.stats.pingNoiseWeight);
  }
}
