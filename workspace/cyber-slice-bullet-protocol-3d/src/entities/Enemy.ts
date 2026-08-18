import * as THREE from 'three';
import { Projectile } from './Projectile';

export type EnemyType = 'drone' | 'ninja' | 'shield_mech' | 'turret' | 'boss';

export interface WeakPlane {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  active: boolean;
}

export class Enemy {
  public mesh: THREE.Group;
  public mainSlicableMesh!: THREE.Mesh;
  public type: EnemyType;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public hp: number;
  public maxHp: number = 60;
  public scoreValue: number = 100;
  public creditDrop: number = 10;
  public isDead: boolean = false;
  public isStunned: boolean = false;
  public hasShield: boolean = false;
  public shieldHp: number = 0;
  public radius: number = 1.0;

  // Boss specific
  public bossPhase: number = 1;
  public maxBossPhases: number = 3;
  public weakPlane: WeakPlane | null = null;
  public weakPlaneVisual: THREE.Mesh | null = null;

  protected scene: THREE.Scene;
  protected attackTimer: number = 0;
  protected stateTimer: number = 0;
  protected stunTimer: number = 0;

  constructor(scene: THREE.Scene, type: EnemyType, startPos: THREE.Vector3) {
    this.scene = scene;
    this.type = type;
    this.position.copy(startPos);

    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);

    // Initial stats & models
    switch (type) {
      case 'drone':
        this.maxHp = 60;
        this.scoreValue = 150;
        this.creditDrop = 15;
        this.radius = 0.8;
        this.buildDroneModel();
        break;

      case 'ninja':
        this.maxHp = 90;
        this.scoreValue = 250;
        this.creditDrop = 25;
        this.radius = 0.9;
        this.buildNinjaModel();
        break;

      case 'shield_mech':
        this.maxHp = 180;
        this.hasShield = true;
        this.shieldHp = 100;
        this.scoreValue = 400;
        this.creditDrop = 40;
        this.radius = 1.3;
        this.buildShieldMechModel();
        break;

      case 'turret':
        this.maxHp = 120;
        this.scoreValue = 200;
        this.creditDrop = 20;
        this.radius = 1.1;
        this.buildTurretModel();
        break;

      case 'boss':
        this.maxHp = 1200;
        this.scoreValue = 3000;
        this.creditDrop = 300;
        this.radius = 2.4;
        this.buildBossModel();
        this.setupBossWeakPlane();
        break;
    }

    this.hp = this.maxHp;
    this.scene.add(this.mesh);
  }

  // --- Model Builders ---

  private buildDroneModel(): void {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222a38, metalness: 0.8, roughness: 0.3 });
    const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });

    const bodyGeo = new THREE.OctahedronGeometry(0.7, 1);
    this.mainSlicableMesh = new THREE.Mesh(bodyGeo, metalMat);
    this.mainSlicableMesh.castShadow = true;
    this.mesh.add(this.mainSlicableMesh);

    const eyeGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const eye = new THREE.Mesh(eyeGeo, redEyeMat);
    eye.position.set(0, 0, 0.5);
    this.mesh.add(eye);

    const ringGeo = new THREE.TorusGeometry(0.9, 0.05, 6, 16);
    const ring = new THREE.Mesh(ringGeo, redEyeMat);
    ring.rotation.x = Math.PI / 2;
    this.mesh.add(ring);
  }

  private buildNinjaModel(): void {
    const ninjaMat = new THREE.MeshStandardMaterial({ color: 0x181024, metalness: 0.6, roughness: 0.4 });
    const violetNeon = new THREE.MeshBasicMaterial({ color: 0xb026ff });

    const torsoGeo = new THREE.BoxGeometry(0.7, 1.2, 0.4);
    this.mainSlicableMesh = new THREE.Mesh(torsoGeo, ninjaMat);
    this.mainSlicableMesh.position.y = 1.1;
    this.mainSlicableMesh.castShadow = true;
    this.mesh.add(this.mainSlicableMesh);

    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.45);
    const head = new THREE.Mesh(headGeo, ninjaMat);
    head.position.set(0, 1.9, 0);
    this.mesh.add(head);

    const visorGeo = new THREE.BoxGeometry(0.35, 0.1, 0.5);
    const visor = new THREE.Mesh(visorGeo, violetNeon);
    visor.position.set(0, 1.9, 0.05);
    this.mesh.add(visor);

    const katanaGeo = new THREE.BoxGeometry(0.06, 1.4, 0.12);
    const katana = new THREE.Mesh(katanaGeo, violetNeon);
    katana.position.set(0.6, 1.4, 0.4);
    katana.rotation.set(0.3, 0, -0.3);
    this.mesh.add(katana);
  }

  private buildShieldMechModel(): void {
    const heavyMat = new THREE.MeshStandardMaterial({ color: 0x2b3342, metalness: 0.9, roughness: 0.2 });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    const bodyGeo = new THREE.BoxGeometry(1.4, 1.6, 1.0);
    this.mainSlicableMesh = new THREE.Mesh(bodyGeo, heavyMat);
    this.mainSlicableMesh.position.y = 1.4;
    this.mainSlicableMesh.castShadow = true;
    this.mesh.add(this.mainSlicableMesh);

    const coreGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 1.4, 0.5);
    this.mesh.add(core);

    const shieldGeo = new THREE.PlaneGeometry(2.0, 1.8);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(0, 1.4, 0.9);
    shield.name = 'energy_shield';
    this.mesh.add(shield);
  }

  private buildTurretModel(): void {
    const turretMat = new THREE.MeshStandardMaterial({ color: 0x1f2430, metalness: 0.85, roughness: 0.3 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });

    const baseGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.6, 8);
    const base = new THREE.Mesh(baseGeo, turretMat);
    base.position.y = 0.3;
    base.castShadow = true;
    this.mesh.add(base);

    const headGeo = new THREE.SphereGeometry(0.7, 8, 8);
    this.mainSlicableMesh = new THREE.Mesh(headGeo, turretMat);
    this.mainSlicableMesh.position.y = 1.1;
    this.mainSlicableMesh.castShadow = true;
    this.mesh.add(this.mainSlicableMesh);

    const barrelGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6);
    barrelGeo.rotateX(Math.PI / 2);

    const barrel1 = new THREE.Mesh(barrelGeo, glowMat);
    barrel1.position.set(-0.3, 1.1, 0.7);
    this.mesh.add(barrel1);

    const barrel2 = new THREE.Mesh(barrelGeo, glowMat);
    barrel2.position.set(0.3, 1.1, 0.7);
    this.mesh.add(barrel2);
  }

  private buildBossModel(): void {
    const bossMat = new THREE.MeshStandardMaterial({ color: 0x1a1528, metalness: 0.9, roughness: 0.15 });
    const neonRed = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00f3ff });

    const torsoGeo = new THREE.BoxGeometry(2.4, 2.8, 1.8);
    this.mainSlicableMesh = new THREE.Mesh(torsoGeo, bossMat);
    this.mainSlicableMesh.position.y = 2.6;
    this.mainSlicableMesh.castShadow = true;
    this.mesh.add(this.mainSlicableMesh);

    const headGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const head = new THREE.Mesh(headGeo, bossMat);
    head.position.set(0, 4.4, 0.2);
    this.mesh.add(head);

    const crownGeo = new THREE.ConeGeometry(0.3, 1.2, 4);
    const hornL = new THREE.Mesh(crownGeo, neonRed);
    hornL.position.set(-0.6, 5.2, 0);
    hornL.rotation.z = -0.3;
    this.mesh.add(hornL);

    const hornR = new THREE.Mesh(crownGeo, neonRed);
    hornR.position.set(0.6, 5.2, 0);
    hornR.rotation.z = 0.3;
    this.mesh.add(hornR);

    const podGeo = new THREE.CylinderGeometry(0.5, 0.6, 2.2, 8);
    podGeo.rotateX(Math.PI / 2);

    const podL = new THREE.Mesh(podGeo, bossMat);
    podL.position.set(-1.8, 3.4, 0.4);
    this.mesh.add(podL);

    const podR = new THREE.Mesh(podGeo, bossMat);
    podR.position.set(1.8, 3.4, 0.4);
    this.mesh.add(podR);

    const coreGeo = new THREE.SphereGeometry(0.7, 12, 12);
    const core = new THREE.Mesh(coreGeo, neonCyan);
    core.position.set(0, 2.6, 0.95);
    this.mesh.add(core);
  }

  private setupBossWeakPlane(): void {
    const planeGeo = new THREE.PlaneGeometry(4.5, 2.5);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      wireframe: true
    });
    this.weakPlaneVisual = new THREE.Mesh(planeGeo, planeMat);
    this.weakPlaneVisual.position.set(0, 2.6, 0);
    this.weakPlaneVisual.rotation.set(0, 0, Math.PI / 4);
    this.mesh.add(this.weakPlaneVisual);

    this.weakPlane = {
      point: new THREE.Vector3(0, 2.6, 0),
      normal: new THREE.Vector3(1, -1, 0).normalize(),
      active: true
    };
  }

  // --- AI Update Loop ---

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    spawnProjectile: (p: Projectile) => void
  ): void {
    if (this.isDead) return;

    if (this.isStunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) this.isStunned = false;
      return;
    }

    this.attackTimer += dt;
    this.stateTimer += dt;

    const toPlayer = playerPos.clone().sub(this.position);
    const distToPlayer = toPlayer.length();

    if (this.type !== 'turret') {
      const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
      this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetAngle, 6.0 * dt);
    }

    switch (this.type) {
      case 'drone':
        this.updateDroneAI(playerPos, distToPlayer, spawnProjectile);
        break;
      case 'ninja':
        this.updateNinjaAI(playerPos, distToPlayer);
        break;
      case 'shield_mech':
        this.updateShieldMechAI(playerPos);
        break;
      case 'turret':
        this.updateTurretAI(playerPos, spawnProjectile);
        break;
      case 'boss':
        this.updateBossAI(dt, playerPos, spawnProjectile);
        break;
    }

    this.position.addScaledVector(this.velocity, dt);
    this.mesh.position.copy(this.position);
  }

  private updateDroneAI(playerPos: THREE.Vector3, dist: number, spawnProjectile: (p: Projectile) => void): void {
    this.position.y = 2.2 + Math.sin(this.stateTimer * 3.0) * 0.4;

    if (dist > 6.0) {
      const dir = playerPos.clone().sub(this.position).normalize();
      this.velocity.x = dir.x * 5.5;
      this.velocity.z = dir.z * 5.5;
    } else {
      const angle = this.stateTimer * 1.5;
      this.velocity.x = Math.cos(angle) * 4.0;
      this.velocity.z = Math.sin(angle) * 4.0;

      if (this.attackTimer >= 2.0) {
        this.attackTimer = 0;
        const fireDir = playerPos.clone().sub(this.position).normalize();
        spawnProjectile(new Projectile(this.scene, 'laser', this.position.clone(), fireDir, 16.0, 15));
      }
    }
  }

  private updateNinjaAI(playerPos: THREE.Vector3, dist: number): void {
    this.position.y = 0;

    if (dist > 3.0) {
      const dir = playerPos.clone().sub(this.position).normalize();
      this.velocity.x = dir.x * 8.5;
      this.velocity.z = dir.z * 8.5;
    } else {
      if (this.attackTimer >= 1.6) {
        this.attackTimer = 0;
        const dir = playerPos.clone().sub(this.position).normalize();
        this.velocity.x = dir.x * 18.0;
        this.velocity.z = dir.z * 18.0;
      } else {
        this.velocity.multiplyScalar(0.9);
      }
    }
  }

  private updateShieldMechAI(playerPos: THREE.Vector3): void {
    this.position.y = 0;
    const dir = playerPos.clone().sub(this.position).normalize();
    this.velocity.x = dir.x * 3.5;
    this.velocity.z = dir.z * 3.5;
  }

  private updateTurretAI(playerPos: THREE.Vector3, spawnProjectile: (p: Projectile) => void): void {
    this.position.y = 0;
    this.velocity.set(0, 0, 0);

    const toPlayer = playerPos.clone().sub(this.position);
    this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    if (this.attackTimer >= 2.4) {
      this.attackTimer = 0;
      const fireDir = toPlayer.clone().normalize();
      if (Math.random() > 0.4) {
        spawnProjectile(new Projectile(this.scene, 'plasma', this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), fireDir, 10.0, 25));
      } else {
        spawnProjectile(new Projectile(this.scene, 'rocket', this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), fireDir, 8.0, 35));
      }
    }
  }

  private updateBossAI(dt: number, playerPos: THREE.Vector3, spawnProjectile: (p: Projectile) => void): void {
    this.position.y = 0;

    const hpPercent = this.hp / this.maxHp;
    if (hpPercent < 0.35 && this.bossPhase < 3) {
      this.bossPhase = 3;
      this.updateBossWeakPlaneAngle(Math.PI / 2);
    } else if (hpPercent < 0.7 && this.bossPhase < 2) {
      this.bossPhase = 2;
      this.updateBossWeakPlaneAngle(0);
    }

    if (this.weakPlaneVisual) {
      this.weakPlaneVisual.rotation.z += dt * 0.4;
    }

    const toPlayer = playerPos.clone().sub(this.position);
    const dist = toPlayer.length();

    if (dist > 7.0) {
      const dir = toPlayer.clone().normalize();
      this.velocity.x = dir.x * 3.2;
      this.velocity.z = dir.z * 3.2;
    } else {
      this.velocity.multiplyScalar(0.9);
    }

    if (this.attackTimer >= (this.bossPhase === 3 ? 1.5 : 2.5)) {
      this.attackTimer = 0;

      if (this.bossPhase === 1) {
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + this.stateTimer;
          const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
          spawnProjectile(new Projectile(this.scene, 'laser', this.position.clone().add(new THREE.Vector3(0, 2.5, 0)), dir, 14.0, 20));
        }
      } else if (this.bossPhase === 2) {
        const fireDir = toPlayer.clone().normalize();
        spawnProjectile(new Projectile(this.scene, 'plasma', this.position.clone().add(new THREE.Vector3(0, 2.5, 0)), fireDir, 11.0, 30));
        spawnProjectile(new Projectile(this.scene, 'rocket', this.position.clone().add(new THREE.Vector3(-1.8, 3.4, 0)), fireDir, 9.0, 35));
        spawnProjectile(new Projectile(this.scene, 'rocket', this.position.clone().add(new THREE.Vector3(1.8, 3.4, 0)), fireDir, 9.0, 35));
      } else {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
          spawnProjectile(new Projectile(this.scene, 'laser', this.position.clone().add(new THREE.Vector3(0, 2.5, 0)), dir, 18.0, 25));
        }
      }
    }
  }

  private updateBossWeakPlaneAngle(angleZ: number): void {
    if (this.weakPlaneVisual) {
      this.weakPlaneVisual.rotation.z = angleZ;
    }
    if (this.weakPlane) {
      this.weakPlane.normal.set(Math.cos(angleZ), Math.sin(angleZ), 0).normalize();
    }
  }

  public stun(durationSec: number = 2.0): void {
    this.isStunned = true;
    this.stunTimer = durationSec;
    this.velocity.set(0, 0, 0);
  }

  public takeDamage(amount: number): boolean {
    if (this.hasShield && this.shieldHp > 0) {
      this.shieldHp -= amount;
      if (this.shieldHp <= 0) {
        this.hasShield = false;
        const shieldMesh = this.mesh.getObjectByName('energy_shield');
        if (shieldMesh) {
          this.mesh.remove(shieldMesh);
        }
      }
      return false;
    }

    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.isDead = true;
      return true;
    }
    return false;
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
  }
}
