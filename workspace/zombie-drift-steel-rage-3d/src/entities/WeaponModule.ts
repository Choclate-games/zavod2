import * as THREE from 'three';
import { WeaponType } from '../types/weapon';
import { ProjectileManager } from './Projectile';
import { audioManager } from '../core/AudioManager';
import { DynamicLightManager } from '../graphics/DynamicLightManager';

export interface WeaponInstance {
  type: WeaponType;
  level: number;
  cooldownTimer: number;
  meshGroup: THREE.Group;
  stats: {
    damage: number;
    cooldown: number;
    range: number;
  };
}

export class WeaponSystem {
  public group = new THREE.Group();
  public weapons: Map<WeaponType, WeaponInstance> = new Map();
  private sawMeshL: THREE.Mesh | null = null;
  private sawMeshR: THREE.Mesh | null = null;
  private minigunBarrel: THREE.Mesh | null = null;

  public addOrUpgradeWeapon(
    type: WeaponType,
    weaponMountRoof: THREE.Group,
    weaponMountLeft: THREE.Group,
    weaponMountRight: THREE.Group
  ): void {
    if (this.weapons.has(type)) {
      const w = this.weapons.get(type)!;
      w.level += 1;
      w.stats.damage = Math.floor(w.stats.damage * 1.35);
      w.stats.cooldown = Math.max(0.1, w.stats.cooldown * 0.85);
      w.stats.range = w.stats.range * 1.1;
      return;
    }

    const wGroup = new THREE.Group();

    if (type === 'ROOF_MINIGUN') {
      // Dual Gatling Minigun Turret
      const baseGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.25, 8);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      wGroup.add(base);

      const barrelGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8);
      const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
      this.minigunBarrel = new THREE.Mesh(barrelGeo, barrelMat);
      this.minigunBarrel.rotation.x = Math.PI / 2;
      this.minigunBarrel.position.set(0, 0.2, 0.5);
      wGroup.add(this.minigunBarrel);

      weaponMountRoof.add(wGroup);
      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 22, cooldown: 0.18, range: 24 },
      });
    } else if (type === 'SIDE_BUZZSAWS') {
      // Spinning Razor Saws
      const sawGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.05, 16);
      const sawMat = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.95,
        roughness: 0.1,
      });

      this.sawMeshL = new THREE.Mesh(sawGeo, sawMat);
      this.sawMeshL.rotation.z = Math.PI / 2;
      weaponMountLeft.add(this.sawMeshL);

      this.sawMeshR = new THREE.Mesh(sawGeo, sawMat);
      this.sawMeshR.rotation.z = Math.PI / 2;
      weaponMountRight.add(this.sawMeshR);

      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 35, cooldown: 0.25, range: 3.5 },
      });
    } else if (type === 'FLAMETHROWER') {
      // Twin Nozzles
      const nozzleGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.6, 8);
      const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, metalness: 0.8 });
      const nL = new THREE.Mesh(nozzleGeo, nozzleMat);
      nL.rotation.x = Math.PI / 2;
      nL.position.set(-0.6, 0.2, 1.4);
      const nR = new THREE.Mesh(nozzleGeo, nozzleMat);
      nR.rotation.x = Math.PI / 2;
      nR.position.set(0.6, 0.2, 1.4);
      wGroup.add(nL, nR);

      weaponMountRoof.add(wGroup);
      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 18, cooldown: 0.35, range: 12 },
      });
    } else if (type === 'MORTAR_LAUNCHER') {
      // Missile Pod
      const podGeo = new THREE.BoxGeometry(0.7, 0.4, 0.9);
      const podMat = new THREE.MeshStandardMaterial({ color: 0x334433, metalness: 0.7 });
      const pod = new THREE.Mesh(podGeo, podMat);
      pod.rotation.x = -0.3;
      wGroup.add(pod);

      weaponMountRoof.add(wGroup);
      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 110, cooldown: 2.2, range: 35 },
      });
    } else if (type === 'SHOCK_RING') {
      // Tesla Coil
      const teslaGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const teslaMat = new THREE.MeshStandardMaterial({
        color: 0x00b4d8,
        emissive: 0x0077b6,
        emissiveIntensity: 0.8,
      });
      const tesla = new THREE.Mesh(teslaGeo, teslaMat);
      wGroup.add(tesla);

      weaponMountRoof.add(wGroup);
      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 60, cooldown: 1.8, range: 14 },
      });
    } else if (type === 'SPIKE_BUMPER') {
      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 50, cooldown: 0.1, range: 3.0 },
      });
    }
  }

  public update(
    dt: number,
    carPos: THREE.Vector3,
    carForward: THREE.Vector3,
    isDrifting: boolean,
    rageMultiplier: number,
    enemies: { position: THREE.Vector3; health: number; takeDamage: (dmg: number) => void }[],
    projectileManager: ProjectileManager,
    particleSystem: any,
    dynamicLights?: DynamicLightManager
  ): void {
    // Spin Buzzsaws
    if (this.sawMeshL && this.sawMeshR) {
      const spinSpeed = (isDrifting ? 35 : 20) * dt;
      this.sawMeshL.rotation.x += spinSpeed;
      this.sawMeshR.rotation.x += spinSpeed;
    }

    // Process each equipped weapon
    this.weapons.forEach((w) => {
      w.cooldownTimer -= dt;
      if (w.cooldownTimer > 0) return;

      const effectiveDmg = Math.floor(w.stats.damage * (isDrifting ? rageMultiplier : 1.0));

      if (w.type === 'ROOF_MINIGUN') {
        // Find closest enemy within range
        let closestDist = w.stats.range;
        let target: THREE.Vector3 | null = null;

        for (const e of enemies) {
          if (e.health <= 0) continue;
          const dist = carPos.distanceTo(e.position);
          if (dist < closestDist) {
            closestDist = dist;
            target = e.position;
          }
        }

        if (target) {
          w.cooldownTimer = w.stats.cooldown;
          const fireOrigin = carPos.clone().add(new THREE.Vector3(0, 1.4, 0));
          const aimDir = target.clone().sub(fireOrigin).normalize();

          if (this.minigunBarrel) {
            this.minigunBarrel.lookAt(target);
          }

          projectileManager.spawnBullet(fireOrigin, aimDir, effectiveDmg);
          dynamicLights?.flash(fireOrigin.x, fireOrigin.y, fireOrigin.z, 0xffe066, 1.8, 10, 22.0);
          audioManager.playMinigunShot();
        }
      } else if (w.type === 'SIDE_BUZZSAWS') {
        // Continuous proximity shred
        let hit = false;
        for (const e of enemies) {
          if (e.health <= 0) continue;
          const dist = carPos.distanceTo(e.position);
          if (dist <= w.stats.range) {
            e.takeDamage(effectiveDmg);
            particleSystem.emitBloodSplatter(e.position.x, e.position.y, e.position.z, 6);
            particleSystem.emitSparks(e.position.x, e.position.y, e.position.z, 4);
            hit = true;
          }
        }
        if (hit) {
          w.cooldownTimer = w.stats.cooldown;
          audioManager.playSplatter();
        }
      } else if (w.type === 'FLAMETHROWER') {
        // Ignite cone in forward direction
        let hitAny = false;
        for (const e of enemies) {
          if (e.health <= 0) continue;
          const toEnemy = e.position.clone().sub(carPos);
          const dist = toEnemy.length();
          if (dist <= w.stats.range) {
            const dot = carForward.dot(toEnemy.normalize());
            if (dot > 0.4) {
              // Within ~65 degree forward cone
              e.takeDamage(effectiveDmg);
              hitAny = true;
            }
          }
        }
        w.cooldownTimer = w.stats.cooldown;
        if (hitAny) {
          audioManager.playFlamethrower();
          particleSystem.emitExplosion(
            carPos.x + carForward.x * 3.5,
            0.6,
            carPos.z + carForward.z * 3.5,
            4
          );
          dynamicLights?.flash(
            carPos.x + carForward.x * 2.5,
            0.8,
            carPos.z + carForward.z * 2.5,
            0xff5500,
            2.6,
            14,
            7.0
          );
        }
      } else if (w.type === 'MORTAR_LAUNCHER') {
        // Fire homing rocket at furthest or highest health enemy
        let target: THREE.Vector3 | null = null;
        let maxHp = 0;

        for (const e of enemies) {
          if (e.health <= 0) continue;
          const dist = carPos.distanceTo(e.position);
          if (dist <= w.stats.range && e.health > maxHp) {
            maxHp = e.health;
            target = e.position;
          }
        }

        if (target) {
          w.cooldownTimer = w.stats.cooldown;
          const origin = carPos.clone().add(new THREE.Vector3(0, 1.6, 0));
          const launchDir = new THREE.Vector3(carForward.x, 0.8, carForward.z).normalize();
          projectileManager.spawnRocket(origin, launchDir, effectiveDmg, target);
          dynamicLights?.flash(origin.x, origin.y, origin.z, 0xff7700, 2.2, 10, 12.0);
          audioManager.playExplosion();
        }
      } else if (w.type === 'SHOCK_RING') {
        // Chain lightning to nearby enemies
        const inRange: typeof enemies = [];
        for (const e of enemies) {
          if (e.health <= 0) continue;
          if (carPos.distanceTo(e.position) <= w.stats.range) {
            inRange.push(e);
          }
        }

        if (inRange.length > 0) {
          w.cooldownTimer = w.stats.cooldown;
          audioManager.playShockZap();
          dynamicLights?.flash(carPos.x, 1.4, carPos.z, 0x00f0ff, 3.2, 16, 9.0);
          const targetCount = Math.min(4 + w.level * 2, inRange.length);
          for (let k = 0; k < targetCount; k++) {
            const targetEnemy = inRange[k];
            targetEnemy.takeDamage(effectiveDmg);
            particleSystem.emitSparks(
              targetEnemy.position.x,
              targetEnemy.position.y + 1,
              targetEnemy.position.z,
              8
            );
          }
        }
      }
    });
  }

  public clear(): void {
    this.weapons.clear();
    this.sawMeshL = null;
    this.sawMeshR = null;
    this.minigunBarrel = null;
  }
}
