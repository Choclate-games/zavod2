import * as THREE from 'three';
import { PhysicsWorld, RigidBody, CollisionLayer } from '../physics/PhysicsWorld';
import { createStealthMaterial } from '../rendering/Shaders';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../audio/AudioManager';
import { storageService } from '../platform/StorageService';

export interface PlayerStats {
  maxHp: number;
  hp: number;
  maxShield: number;
  shield: number;
  maxEnergy: number;
  energy: number;
  moveSpeed: number;
  attackPower: number;
  critChance: number;
  sonarRadius: number;
  magnetRadius: number;
  dashCooldown: number;
  invincibleTime: number;
}

export class Player {
  public mesh: THREE.Group;
  public body: RigidBody;
  public stats: PlayerStats;

  private drillMesh!: THREE.Mesh;
  private goggleMesh!: THREE.Mesh;
  private stealthMat!: THREE.ShaderMaterial;

  public isStealthed = false;
  public isDashing = false;
  public isAttacking = false;

  private dashTimer = 0;
  private attackTimer = 0;
  private sonarTimer = 0;
  private stepTimer = 0;

  public attackHitboxActive = false;
  public headingAngle = 0;

  constructor(private scene: THREE.Scene, private physics: PhysicsWorld) {
    this.mesh = new THREE.Group();
    this.stats = this.initStats();

    this.body = new RigidBody({
      radius: 0.7,
      mass: 2.0,
      drag: 0.86,
      layer: CollisionLayer.PLAYER,
      mask: CollisionLayer.ALL,
    });
    this.body.userData = this;
    this.physics.addBody(this.body);

    this.build3DModel();
    this.scene.add(this.mesh);
  }

  private initStats(): PlayerStats {
    const meta = storageService.getData().colonyUpgrades;
    const forgeLevel = meta.colony_forge || 0;
    const bioLevel = meta.bio_garden || 0;
    const burrowLevel = meta.burrow_network || 0;
    const radarLevel = meta.radar_tower || 0;

    const baseHp = 100 + bioLevel * 15;
    const baseShield = 40 + bioLevel * 10;
    const baseSpeed = 8.5 + burrowLevel * 0.6;
    const baseAtk = 25 + forgeLevel * 5;
    const baseRadar = 14 + radarLevel * 2;

    return {
      maxHp: baseHp,
      hp: baseHp,
      maxShield: baseShield,
      shield: baseShield,
      maxEnergy: 100,
      energy: 100,
      moveSpeed: baseSpeed,
      attackPower: baseAtk,
      critChance: 0.15,
      sonarRadius: baseRadar,
      magnetRadius: 4.5,
      dashCooldown: 0.8,
      invincibleTime: 0,
    };
  }

  private build3DModel(): void {
    // 1. Mole Body
    const bodyGeo = new THREE.SphereGeometry(0.7, 16, 16);
    bodyGeo.scale(1, 1.1, 1.2);
    this.stealthMat = createStealthMaterial('#5d4037');
    const bodyMesh = new THREE.Mesh(bodyGeo, this.stealthMat);
    bodyMesh.position.y = 0.75;
    bodyMesh.castShadow = true;
    this.mesh.add(bodyMesh);

    // 2. Snout / Nose
    const snoutGeo = new THREE.ConeGeometry(0.25, 0.4, 12);
    snoutGeo.rotateX(Math.PI / 2);
    const snoutMat = new THREE.MeshStandardMaterial({ color: '#ff8a80', roughness: 0.5 });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0, 0.7, 0.85);
    this.mesh.add(snout);

    // 3. Glowing Goggles
    const goggleGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12);
    goggleGeo.rotateZ(Math.PI / 2);
    const goggleMat = new THREE.MeshStandardMaterial({
      color: '#00e5ff',
      emissive: '#00e5ff',
      emissiveIntensity: 0.9,
    });
    this.goggleMesh = new THREE.Mesh(goggleGeo, goggleMat);
    this.goggleMesh.position.set(0, 0.95, 0.5);
    this.mesh.add(this.goggleMesh);

    // 4. Rotating Drill Tool (Right Hand)
    const drillGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
    drillGeo.rotateX(Math.PI / 2);
    const drillMat = new THREE.MeshStandardMaterial({
      color: '#ffd54f',
      metalness: 0.8,
      roughness: 0.2,
    });
    this.drillMesh = new THREE.Mesh(drillGeo, drillMat);
    this.drillMesh.position.set(0.65, 0.65, 0.45);
    this.drillMesh.castShadow = true;
    this.mesh.add(this.drillMesh);

    // 5. Archivist Scroll Backpack
    const packGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.9, 8);
    const packMat = new THREE.MeshStandardMaterial({ color: '#ffe082', roughness: 0.8 });
    const pack = new THREE.Mesh(packGeo, packMat);
    pack.position.set(0, 0.85, -0.65);
    pack.rotation.z = Math.PI / 2;
    this.mesh.add(pack);
  }

  handleInput(moveX: number, moveY: number, dt: number): void {
    const isMoving = Math.hypot(moveX, moveY) > 0.05;

    // Movement impulse
    if (isMoving && !this.isAttacking) {
      const speed = this.isDashing ? this.stats.moveSpeed * 2.2 : this.stats.moveSpeed;
      const targetVelX = moveX * speed;
      const targetVelZ = moveY * speed;

      this.body.velocity.x = THREE.MathUtils.lerp(this.body.velocity.x, targetVelX, dt * 12);
      this.body.velocity.z = THREE.MathUtils.lerp(this.body.velocity.z, targetVelZ, dt * 12);

      this.headingAngle = Math.atan2(moveX, moveY);

      // Footstep sound ripples
      this.stepTimer += dt;
      if (this.stepTimer >= (this.isDashing ? 0.2 : 0.45)) {
        this.stepTimer = 0;
        eventBus.emit('player:step', { position: this.body.position.clone() });
      }

      this.isStealthed = false;
    } else {
      // Standing still -> Enter stealth cloak
      this.stepTimer = 0;
      this.isStealthed = true;
    }

    // Smooth rotation
    const curRot = this.mesh.rotation.y;
    let diff = this.headingAngle - curRot;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.mesh.rotation.y += diff * Math.min(dt * 14, 1);
  }

  attack(): boolean {
    if (this.isAttacking || this.isDashing || this.stats.energy < 15) return false;

    this.isAttacking = true;
    this.attackTimer = 0.25;
    this.attackHitboxActive = true;
    this.stats.energy -= 15;

    audioManager.playAttackSwipe();

    // Forward lunge impulse
    const forward = new THREE.Vector3(
      Math.sin(this.headingAngle),
      0,
      Math.cos(this.headingAngle)
    );
    this.body.applyImpulse(forward.multiplyScalar(12));

    eventBus.emit('player:attack', {
      position: this.body.position.clone(),
      heading: this.headingAngle,
      damage: this.stats.attackPower,
    });

    return true;
  }

  dash(): boolean {
    if (this.dashTimer > 0 || this.stats.energy < 25) return false;

    this.isDashing = true;
    this.dashTimer = this.stats.dashCooldown;
    this.stats.invincibleTime = 0.35;
    this.stats.energy -= 25;

    audioManager.playDash();

    const forward = new THREE.Vector3(
      Math.sin(this.headingAngle),
      0,
      Math.cos(this.headingAngle)
    );
    this.body.applyImpulse(forward.multiplyScalar(22));

    eventBus.emit('player:dash', { position: this.body.position.clone() });
    return true;
  }

  triggerSonar(): boolean {
    if (this.sonarTimer > 0 || this.stats.energy < 30) return false;

    this.sonarTimer = 3.5;
    this.stats.energy -= 30;

    audioManager.playSonarPulse();
    eventBus.emit('player:sonar', {
      position: this.body.position.clone(),
      radius: this.stats.sonarRadius,
    });

    return true;
  }

  takeDamage(amount: number): boolean {
    if (this.stats.invincibleTime > 0 || this.stats.hp <= 0) return false;

    let remainingDmg = amount;

    // Shield absorb
    if (this.stats.shield > 0) {
      if (this.stats.shield >= remainingDmg) {
        this.stats.shield -= remainingDmg;
        remainingDmg = 0;
      } else {
        remainingDmg -= this.stats.shield;
        this.stats.shield = 0;
      }
    }

    // Health reduction
    this.stats.hp = Math.max(0, this.stats.hp - remainingDmg);
    this.stats.invincibleTime = 0.5;

    audioManager.playImpact(true);
    eventBus.emit('player:hp_changed', {
      current: this.stats.hp,
      max: this.stats.maxHp,
      shield: this.stats.shield,
      maxShield: this.stats.maxShield,
    });

    if (this.stats.hp <= 0) {
      eventBus.emit('player:died', {});
      return true;
    }
    return false;
  }

  heal(amount: number): void {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
    eventBus.emit('player:hp_changed', {
      current: this.stats.hp,
      max: this.stats.maxHp,
      shield: this.stats.shield,
      maxShield: this.stats.maxShield,
    });
  }

  revive(): void {
    this.stats.hp = Math.floor(this.stats.maxHp * 0.5);
    this.stats.shield = this.stats.maxShield;
    this.stats.invincibleTime = 3.0; // 3 sec invulnerability

    // Shockwave pulse
    this.triggerSonar();
    eventBus.emit('player:hp_changed', {
      current: this.stats.hp,
      max: this.stats.maxHp,
      shield: this.stats.shield,
      maxShield: this.stats.maxShield,
    });
  }

  update(dt: number): void {
    // Sync mesh with physics body
    this.mesh.position.copy(this.body.position);

    // Drill spinning animation
    if (this.isAttacking) {
      this.drillMesh.rotation.z += dt * 35;
    } else {
      this.drillMesh.rotation.z += dt * 4;
    }

    // Timers
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      if (this.dashTimer <= this.stats.dashCooldown - 0.25) {
        this.isDashing = false;
      }
    }

    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.attackHitboxActive = false;
      }
    }

    if (this.sonarTimer > 0) {
      this.sonarTimer -= dt;
    }

    if (this.stats.invincibleTime > 0) {
      this.stats.invincibleTime -= dt;
      this.mesh.visible = Math.floor(this.stats.invincibleTime * 20) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // Energy regeneration
    if (this.stats.energy < this.stats.maxEnergy) {
      this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + dt * 25);
      eventBus.emit('player:energy_changed', {
        current: this.stats.energy,
        max: this.stats.maxEnergy,
      });
    }

    // Shield passive recharge
    if (this.stats.shield < this.stats.maxShield && this.stats.invincibleTime <= 0) {
      this.stats.shield = Math.min(this.stats.maxShield, this.stats.shield + dt * 4);
      eventBus.emit('player:hp_changed', {
        current: this.stats.hp,
        max: this.stats.maxHp,
        shield: this.stats.shield,
        maxShield: this.stats.maxShield,
      });
    }

    // Update stealth shader
    const targetStealth = this.isStealthed ? 0.8 : 0.0;
    const curVal = this.stealthMat.uniforms.uStealthAmount.value;
    this.stealthMat.uniforms.uStealthAmount.value = THREE.MathUtils.lerp(curVal, targetStealth, dt * 6);
    this.stealthMat.uniforms.uTime.value += dt;

    eventBus.emit('stealth:changed', {
      isStealthed: this.isStealthed,
      detectionAlert: this.isStealthed ? 0.2 : 0.8,
    });
  }

  resetPosition(x = 0, z = 0): void {
    this.body.teleport(new THREE.Vector3(x, 0.7, z));
    this.mesh.position.copy(this.body.position);
    this.stats.hp = this.stats.maxHp;
    this.stats.shield = this.stats.maxShield;
    this.stats.energy = this.stats.maxEnergy;
    this.stats.invincibleTime = 0;
    this.isDashing = false;
    this.isAttacking = false;
    this.isStealthed = true;
  }
}
