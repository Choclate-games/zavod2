import * as THREE from 'three';
import { EnemyConfig, EnemyType } from '../types';
import { ENEMIES_DATABASE } from '../config/EnemiesData';
import { GameConfig } from '../config/GameConfig';

export class Enemy {
  public id: number;
  public type: EnemyType;
  public config: EnemyConfig;
  public group: THREE.Group = new THREE.Group();

  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public knockback: THREE.Vector3 = new THREE.Vector3();

  public hp: number;
  public isDead: boolean = false;
  public isBeingAbsorbed: boolean = false;
  public absorbProgress: number = 0;
  public absorbTarget: THREE.Vector3 = new THREE.Vector3();

  public attackTimer: number = 0;
  private hitFlashTimer: number = 0;
  private meshesToFlash: THREE.Mesh[] = [];

  constructor(id: number, type: EnemyType, startPos: THREE.Vector3) {
    this.id = id;
    this.type = type;
    this.config = ENEMIES_DATABASE[type];
    this.hp = this.config.maxHp;

    this.position.copy(startPos);
    this.buildModel();
    this.group.position.copy(this.position);
  }

  private buildModel(): void {
    const color = this.config.color;
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd1b3, roughness: 0.8 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });

    const scale = this.config.radius / 0.55;

    switch (this.config.modelType) {
      case 'peasant': {
        // Body & Head
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.6, 6), bodyMat);
        body.position.y = 0.3;
        body.castShadow = true;
        this.group.add(body);
        this.meshesToFlash.push(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), skinMat);
        head.position.y = 0.75;
        this.group.add(head);
        this.meshesToFlash.push(head);

        // Pitchfork
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), woodMat);
        stick.position.set(0.25, 0.45, 0.1);
        stick.rotation.z = -0.2;
        this.group.add(stick);
        break;
      }

      case 'guard': {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8), bodyMat);
        body.position.y = 0.35;
        body.castShadow = true;
        this.group.add(body);
        this.meshesToFlash.push(body);

        // Helmet
        const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.25, 6), steelMat);
        helmet.position.y = 0.82;
        this.group.add(helmet);
        this.meshesToFlash.push(helmet);

        // Sword & Shield
        const sword = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.1), steelMat);
        sword.position.set(0.32, 0.45, 0.15);
        this.group.add(sword);

        const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.35), bodyMat);
        shield.position.set(-0.3, 0.4, 0.1);
        this.group.add(shield);
        break;
      }

      case 'archer': {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.65, 6), bodyMat);
        body.position.y = 0.33;
        body.castShadow = true;
        this.group.add(body);
        this.meshesToFlash.push(body);

        // Hood / Head
        const hood = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 6), bodyMat);
        hood.position.y = 0.8;
        this.group.add(hood);
        this.meshesToFlash.push(hood);

        // Bow
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 4, 8, Math.PI), woodMat);
        bow.position.set(0.28, 0.45, 0.15);
        bow.rotation.y = Math.PI / 2;
        this.group.add(bow);
        break;
      }

      case 'spearman': {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.75, 6), bodyMat);
        body.position.y = 0.38;
        body.castShadow = true;
        this.group.add(body);
        this.meshesToFlash.push(body);

        const helmet = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 6), steelMat);
        helmet.position.y = 0.88;
        this.group.add(helmet);
        this.meshesToFlash.push(helmet);

        // Long Spear
        const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4), woodMat);
        spear.position.set(0.3, 0.8, 0.2);
        spear.rotation.x = 0.4;
        this.group.add(spear);

        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 4), steelMat);
        tip.position.set(0.3, 1.6, 0.55);
        tip.rotation.x = 0.4;
        this.group.add(tip);
        break;
      }

      case 'knight': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.8), steelMat);
        body.position.y = 0.5;
        body.castShadow = true;
        this.group.add(body);
        this.meshesToFlash.push(body);

        const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), bodyMat);
        helmet.position.y = 1.0;
        this.group.add(helmet);
        this.meshesToFlash.push(helmet);

        // Huge sword
        const sword = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.15), steelMat);
        sword.position.set(0.45, 0.65, 0.25);
        sword.rotation.x = 0.3;
        this.group.add(sword);
        break;
      }

      case 'archmage': {
        const robe = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 8), bodyMat);
        robe.position.y = 0.55;
        robe.castShadow = true;
        this.group.add(robe);
        this.meshesToFlash.push(robe);

        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 6), bodyMat);
        hat.position.y = 1.25;
        this.group.add(hat);
        this.meshesToFlash.push(hat);

        // Staff
        const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4), woodMat);
        staff.position.set(0.4, 0.7, 0.2);
        this.group.add(staff);

        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
        orb.position.set(0.4, 1.4, 0.2);
        this.group.add(orb);
        break;
      }

      case 'paladin': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.5), bodyMat);
        body.position.y = 0.55;
        body.castShadow = true;
        this.group.add(body);
        this.meshesToFlash.push(body);

        const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), steelMat);
        helmet.position.y = 1.15;
        this.group.add(helmet);
        this.meshesToFlash.push(helmet);

        // War hammer
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 4), woodMat);
        handle.position.set(0.5, 0.7, 0.2);
        this.group.add(handle);

        const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.5), steelMat);
        hammerHead.position.set(0.5, 1.25, 0.2);
        this.group.add(hammerHead);
        break;
      }

      case 'boss_golem':
      default: {
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.0), bodyMat);
        torso.position.y = 1.1;
        torso.castShadow = true;
        this.group.add(torso);
        this.meshesToFlash.push(torso);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), steelMat);
        head.position.y = 2.1;
        this.group.add(head);
        this.meshesToFlash.push(head);

        const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), bodyMat);
        lArm.position.set(-1.0, 1.0, 0);
        this.group.add(lArm);

        const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), bodyMat);
        rArm.position.set(1.0, 1.0, 0);
        this.group.add(rArm);
        break;
      }
    }

    this.group.scale.set(scale, scale, scale);
  }

  public takeDamage(dmg: number, knockbackDir?: THREE.Vector3, knockbackForce = 6.0): boolean {
    this.hp -= dmg;
    this.hitFlashTimer = 0.12;

    if (knockbackDir) {
      this.knockback.addScaledVector(knockbackDir, knockbackForce);
    }

    if (this.hp <= 0) {
      this.isDead = true;
      return true;
    }
    return false;
  }

  public startAbsorption(targetSlimePos: THREE.Vector3): void {
    this.isBeingAbsorbed = true;
    this.absorbProgress = 0;
    this.absorbTarget.copy(targetSlimePos);
  }

  public update(playerPos: THREE.Vector3, dt: number): void {
    if (this.isBeingAbsorbed) {
      // Suction animation: pulled towards slime center and shrink
      this.absorbProgress += dt * 3.5;
      this.position.lerp(this.absorbTarget, dt * 8.0);
      const remainScale = Math.max(0.01, 1.0 - this.absorbProgress);
      this.group.scale.setScalar(remainScale * (this.config.radius / 0.55));
      this.group.position.copy(this.position);
      return;
    }

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      const isWhite = this.hitFlashTimer > 0;
      for (const m of this.meshesToFlash) {
        if (m.material instanceof THREE.MeshStandardMaterial) {
          m.material.emissive.setHex(isWhite ? 0xffffff : 0x000000);
          m.material.emissiveIntensity = isWhite ? 0.8 : 0;
        }
      }
    }

    // AI movement towards player or ranged kiting
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.01) {
      const dirX = dx / dist;
      const dirZ = dz / dist;

      // Face player
      const angle = Math.atan2(dx, dz);
      this.group.rotation.y = angle;

      const isRanged = this.config.attackRange > 5.0;
      const desiredDist = isRanged ? this.config.attackRange * 0.7 : 0.5;

      if (dist > desiredDist) {
        this.velocity.x = dirX * this.config.speed;
        this.velocity.z = dirZ * this.config.speed;
      } else if (isRanged && dist < desiredDist * 0.8) {
        // Back away slightly
        this.velocity.x = -dirX * this.config.speed * 0.6;
        this.velocity.z = -dirZ * this.config.speed * 0.6;
      } else {
        this.velocity.set(0, 0, 0);
      }
    }

    // Apply knockback
    this.position.x += (this.velocity.x + this.knockback.x) * dt;
    this.position.z += (this.velocity.z + this.knockback.z) * dt;

    // Decay knockback
    this.knockback.multiplyScalar(0.88);

    // Bounds clamp
    const maxR = GameConfig.ARENA_RADIUS - this.config.radius;
    const curDist = Math.hypot(this.position.x, this.position.z);
    if (curDist > maxR && curDist > 0.001) {
      const factor = maxR / curDist;
      this.position.x *= factor;
      this.position.z *= factor;
    }

    this.position.y = 0;
    this.group.position.copy(this.position);

    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
    }
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
