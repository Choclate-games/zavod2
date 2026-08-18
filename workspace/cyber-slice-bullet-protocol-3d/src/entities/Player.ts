import * as THREE from 'three';
import { PlayerStats, KatanaConfig } from '../core/Types';
import { EventBus } from '../core/EventBus';

export class Player {
  public mesh: THREE.Group;
  public katanaMesh!: THREE.Mesh;
  public stats: PlayerStats;
  
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public isDashing: boolean = false;
  public isInvulnerable: boolean = false;
  public isOverdrive: boolean = false;

  private dashTimer: number = 0;
  private dashCooldown: number = 0;
  private overdriveTimer: number = 0;
  private invulnTimer: number = 0;

  private bladeTip: THREE.Vector3 = new THREE.Vector3();
  private scene: THREE.Scene;
  private currentKatana: KatanaConfig;

  constructor(scene: THREE.Scene, initialKatana: KatanaConfig) {
    this.scene = scene;
    this.currentKatana = initialKatana;

    this.stats = {
      hp: 100,
      maxHp: 100,
      chronoEnergy: 100,
      maxChronoEnergy: 100,
      chronoDrainRate: 28,
      chronoRechargeRate: 18,
      speed: 10.0,
      damage: 100,
      creditMultiplier: 1.0,
      sliceRangeBonus: 1.0,
      ricochetEnabled: false,
      quantumSplitEnabled: false,
      chronoVampirism: false,
      chainLightning: false,
      razorWind: false,
      empBurst: false,
      timeFreezeOnSSS: false,
      shieldCount: 0,
      maxShields: 1
    };

    this.mesh = this.buildPlayerMesh();
    this.scene.add(this.mesh);
  }

  private buildPlayerMesh(): THREE.Group {
    const group = new THREE.Group();

    // Materials
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      roughness: 0.3,
      metalness: 0.8
    });

    const neonMat = new THREE.MeshBasicMaterial({
      color: this.currentKatana.color
    });

    const visorMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff
    });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.1, 0.5);
    const torso = new THREE.Mesh(torsoGeo, armorMat);
    torso.position.y = 1.3;
    torso.castShadow = true;
    group.add(torso);

    // Glowing Chest Core
    const coreGeo = new THREE.BoxGeometry(0.3, 0.4, 0.52);
    const core = new THREE.Mesh(coreGeo, neonMat);
    core.position.y = 1.3;
    group.add(core);

    // Head / Visor Helm
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.55);
    const head = new THREE.Mesh(headGeo, armorMat);
    head.position.y = 2.15;
    head.castShadow = true;
    group.add(head);

    const visorGeo = new THREE.BoxGeometry(0.42, 0.16, 0.58);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.15, 0.05);
    group.add(visor);

    // Shoulder Pads
    const shoulderGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const leftShoulder = new THREE.Mesh(shoulderGeo, armorMat);
    leftShoulder.position.set(-0.6, 1.7, 0);
    group.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderGeo, armorMat);
    rightShoulder.position.set(0.6, 1.7, 0);
    group.add(rightShoulder);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
    const leftArm = new THREE.Mesh(armGeo, armorMat);
    leftArm.position.set(-0.6, 1.2, 0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armorMat);
    rightArm.position.set(0.6, 1.2, 0);
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.32, 0.8, 0.32);
    const leftLeg = new THREE.Mesh(legGeo, armorMat);
    leftLeg.position.set(-0.25, 0.45, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, armorMat);
    rightLeg.position.set(0.25, 0.45, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Cyber Katana Blade
    const bladeGeo = new THREE.BoxGeometry(0.08, 1.8, 0.16);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      emissive: this.currentKatana.color,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.9
    });
    this.katanaMesh = new THREE.Mesh(bladeGeo, bladeMat);
    this.katanaMesh.position.set(0.8, 1.5, 0.5);
    this.katanaMesh.rotation.set(0.4, 0, -0.2);
    this.katanaMesh.castShadow = true;
    group.add(this.katanaMesh);

    return group;
  }

  public setKatana(katana: KatanaConfig): void {
    this.currentKatana = katana;
    if (this.katanaMesh && this.katanaMesh.material instanceof THREE.MeshStandardMaterial) {
      this.katanaMesh.material.emissive.setHex(katana.color);
    }
  }

  public getKatana(): KatanaConfig {
    return this.currentKatana;
  }

  public update(dt: number, moveInput: THREE.Vector2, isBulletTime: boolean): void {
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      if (this.invulnTimer <= 0) this.isInvulnerable = false;
    }

    if (this.isOverdrive) {
      this.overdriveTimer -= dt;
      if (this.overdriveTimer <= 0) {
        this.isOverdrive = false;
        EventBus.emit('player:overdrive', false);
      }
    }

    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      const currentSpeed = (this.isOverdrive ? this.stats.speed * 1.35 : this.stats.speed);
      if (moveInput.lengthSq() > 0.01) {
        this.velocity.x = moveInput.x * currentSpeed;
        this.velocity.z = moveInput.y * currentSpeed;

        const targetAngle = Math.atan2(moveInput.x, moveInput.y);
        this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetAngle, 14.0 * dt);
      } else {
        this.velocity.x *= 0.8;
        this.velocity.z *= 0.8;
      }
    }

    this.position.addScaledVector(this.velocity, dt);

    const arenaRadius = 19.5;
    const distFromCenter = Math.sqrt(this.position.x * this.position.x + this.position.z * this.position.z);
    if (distFromCenter > arenaRadius) {
      this.position.x = (this.position.x / distFromCenter) * arenaRadius;
      this.position.z = (this.position.z / distFromCenter) * arenaRadius;
    }

    this.mesh.position.copy(this.position);

    if (isBulletTime) {
      this.stats.chronoEnergy = Math.max(0, this.stats.chronoEnergy - this.stats.chronoDrainRate * dt);
      if (this.stats.chronoEnergy <= 0) {
        EventBus.emit('bullet_time:exhausted');
      }
    } else {
      this.stats.chronoEnergy = Math.min(
        this.stats.maxChronoEnergy,
        this.stats.chronoEnergy + this.stats.chronoRechargeRate * dt
      );
    }

    if (this.katanaMesh) {
      this.katanaMesh.getWorldPosition(this.bladeTip);
    }
  }

  public triggerDash(direction?: THREE.Vector2): boolean {
    if (this.dashCooldown > 0) return false;

    this.isDashing = true;
    this.isInvulnerable = true;
    this.dashTimer = 0.22;
    this.dashCooldown = 0.75;
    this.invulnTimer = 0.35;

    const dashDir = direction && direction.lengthSq() > 0.01 
      ? direction.clone().normalize()
      : new THREE.Vector2(Math.sin(this.mesh.rotation.y), Math.cos(this.mesh.rotation.y));

    this.velocity.x = dashDir.x * 24.0;
    this.velocity.z = dashDir.y * 24.0;

    EventBus.emit('player:dash', this.position);
    return true;
  }

  public triggerOverdrive(durationSec: number = 7.0): void {
    this.isOverdrive = true;
    this.overdriveTimer = durationSec;
    EventBus.emit('player:overdrive', true);
  }

  public takeDamage(amount: number): boolean {
    if (this.isInvulnerable || this.isDashing) return false;

    if (this.stats.shieldCount > 0) {
      this.stats.shieldCount--;
      this.isInvulnerable = true;
      this.invulnTimer = 0.6;
      EventBus.emit('player:shield_break');
      return false;
    }

    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.isInvulnerable = true;
    this.invulnTimer = 0.5;

    EventBus.emit('player:damaged', { hp: this.stats.hp, maxHp: this.stats.maxHp });

    if (this.stats.hp <= 0) {
      EventBus.emit('player:dead');
    }
    return true;
  }

  public heal(amount: number): void {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
    EventBus.emit('player:healed', { hp: this.stats.hp, maxHp: this.stats.maxHp });
  }

  public addChronoEnergy(amount: number): void {
    this.stats.chronoEnergy = Math.min(this.stats.maxChronoEnergy, this.stats.chronoEnergy + amount);
  }

  public getBladeTip(): THREE.Vector3 {
    return this.bladeTip;
  }

  public reset(keepHp: boolean = false): void {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    if (!keepHp) {
      this.stats.hp = this.stats.maxHp;
    }
    this.stats.chronoEnergy = this.stats.maxChronoEnergy;
    this.isDashing = false;
    this.isInvulnerable = false;
    this.isOverdrive = false;
    this.mesh.position.copy(this.position);
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
  }
}
