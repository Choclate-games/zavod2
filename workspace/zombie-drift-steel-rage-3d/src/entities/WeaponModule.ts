import * as THREE from 'three';
import { WeaponType } from '../types/weapon';
import { ProjectileManager } from './Projectile';
import { audioManager } from '../core/AudioManager';
import { DynamicLightManager } from '../graphics/DynamicLightManager';
import { Zombie } from './Zombie';
import { BossZombie } from './BossZombie';
import { gameStore } from '../core/Store';

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

const _scratchOrigin = new THREE.Vector3();
const _scratchAimDir = new THREE.Vector3();
const _scratchMuzzleWorld = new THREE.Vector3();

export class WeaponSystem {
  public group = new THREE.Group();
  public weapons: Map<WeaponType, WeaponInstance> = new Map();
  private sawMeshL: THREE.Mesh | null = null;
  private sawMeshR: THREE.Mesh | null = null;
  private minigunSwivel: THREE.Group | null = null;
  private minigunMuzzlePoint: THREE.Object3D | null = null;
  private currentTurretYaw = 0; // Local radians relative to vehicle chassis

  public addOrUpgradeWeapon(
    type: WeaponType,
    weaponMountRoof: THREE.Group,
    weaponMountLeft: THREE.Group,
    weaponMountRight: THREE.Group
  ): void {
    if (this.weapons.has(type)) {
      const w = this.weapons.get(type)!;
      w.level += 1;
      w.stats.damage = Math.floor(w.stats.damage * 1.2 + 1);
      w.stats.cooldown = Math.max(0.25, w.stats.cooldown * 0.9);
      w.stats.range = w.stats.range * 1.05;
      return;
    }

    const wGroup = new THREE.Group();

    if (type === 'ROOF_MINIGUN') {
      // 1. Static Base Plate on Roof
      const baseGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.16, 12);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.8, roughness: 0.4 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(0, 0.08, 0);
      wGroup.add(base);

      // 2. Rotating Turret Swivel Head
      const swivel = new THREE.Group();
      swivel.position.set(0, 0.16, 0);

      // Turret Housing
      const housingGeo = new THREE.BoxGeometry(0.42, 0.28, 0.55);
      const housingMat = new THREE.MeshStandardMaterial({ color: 0x303030, metalness: 0.7, roughness: 0.3 });
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(0, 0.14, -0.05);
      swivel.add(housing);

      // Top Ammo Drum
      const drumGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.2, 10);
      const drumMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.85 });
      const drum = new THREE.Mesh(drumGeo, drumMat);
      drum.position.set(0, 0.32, -0.08);
      swivel.add(drum);

      // Dual Gatling Barrels
      const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8);
      const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, metalness: 0.95, roughness: 0.15 });

      const barrelL = new THREE.Mesh(barrelGeo, barrelMat);
      barrelL.rotation.x = Math.PI / 2;
      barrelL.position.set(-0.1, 0.14, 0.42);
      swivel.add(barrelL);

      const barrelR = new THREE.Mesh(barrelGeo, barrelMat);
      barrelR.rotation.x = Math.PI / 2;
      barrelR.position.set(0.1, 0.14, 0.42);
      swivel.add(barrelR);

      // Muzzle anchor point for bullet origins
      const muzzlePoint = new THREE.Object3D();
      muzzlePoint.position.set(0, 0.14, 0.9);
      swivel.add(muzzlePoint);

      wGroup.add(swivel);
      weaponMountRoof.add(wGroup);

      this.minigunSwivel = swivel;
      this.minigunMuzzlePoint = muzzlePoint;
      this.currentTurretYaw = 0;

      // Base Level 1 Stats (2x debuffed)
      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 4, cooldown: 1.0, range: 18 },
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
        stats: { damage: 12, cooldown: 0.45, range: 3.5 },
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
        stats: { damage: 8, cooldown: 0.65, range: 10 },
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
        stats: { damage: 42, cooldown: 4.5, range: 28 },
      });
    } else if (type === 'SHOCK_RING') {
      // Tesla Coil
      const teslaGeo = new THREE.SphereGeometry(0.35, 10, 10);
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
        stats: { damage: 22, cooldown: 3.8, range: 12 },
      });
    }
  }

  public updateDirect(
    dt: number,
    carPos: THREE.Vector3,
    carForward: THREE.Vector3,
    carHeading: number,
    isDrifting: boolean,
    rageMultiplier: number,
    zombies: Zombie[],
    boss: BossZombie | null,
    onZombieDamage: (z: Zombie, dmg: number) => void,
    onBossDamage: (dmg: number) => void,
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

    const cooldownMult = gameStore.run.weaponCooldownMultiplier || 1.0;
    const damageMult = gameStore.run.weaponDamageMultiplier || 1.0;
    const turretSpeedMult = gameStore.run.turretSpeedMultiplier || 1.0;

    // Process each equipped weapon
    this.weapons.forEach((w) => {
      w.cooldownTimer -= dt;

      const effectiveDmg = Math.floor(w.stats.damage * damageMult * (isDrifting ? rageMultiplier : 1.0));
      const rangeSq = w.stats.range * w.stats.range;

      if (w.type === 'ROOF_MINIGUN') {
        // 1. Find Closest Target within Range
        let closestDistSq = rangeSq;
        let targetPos: THREE.Vector3 | null = null;

        for (let i = 0; i < zombies.length; i++) {
          const z = zombies[i];
          if (z.isDead) continue;
          const dx = z.position.x - carPos.x;
          const dz = z.position.z - carPos.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < closestDistSq) {
            closestDistSq = dSq;
            targetPos = z.position;
          }
        }

        if (boss && !boss.isDead) {
          const bdx = boss.position.x - carPos.x;
          const bdz = boss.position.z - carPos.z;
          const bdSq = bdx * bdx + bdz * bdz;
          if (bdSq < closestDistSq) {
            closestDistSq = bdSq;
            targetPos = boss.position;
          }
        }

        // 2. Smooth Turret Angular Tracking
        const baseTurnSpeed = 7.0 * turretSpeedMult; // radians per sec
        let angleDiff = 0;

        if (targetPos) {
          const dx = targetPos.x - carPos.x;
          const dz = targetPos.z - carPos.z;
          const targetWorldYaw = Math.atan2(dx, dz);
          const desiredLocalYaw = targetWorldYaw - carHeading;

          angleDiff = Math.atan2(Math.sin(desiredLocalYaw - this.currentTurretYaw), Math.cos(desiredLocalYaw - this.currentTurretYaw));
          const maxStep = baseTurnSpeed * dt;

          if (Math.abs(angleDiff) <= maxStep) {
            this.currentTurretYaw = desiredLocalYaw;
          } else {
            this.currentTurretYaw += Math.sign(angleDiff) * maxStep;
          }
        } else {
          // No targets: smoothly return to forward alignment (0 rad)
          angleDiff = Math.atan2(Math.sin(0 - this.currentTurretYaw), Math.cos(0 - this.currentTurretYaw));
          const maxStep = (baseTurnSpeed * 0.6) * dt;
          if (Math.abs(angleDiff) <= maxStep) {
            this.currentTurretYaw = 0;
          } else {
            this.currentTurretYaw += Math.sign(angleDiff) * maxStep;
          }
        }

        if (this.minigunSwivel) {
          this.minigunSwivel.rotation.y = this.currentTurretYaw;
        }

        // 3. Firing Check
        if (targetPos && w.cooldownTimer <= 0 && Math.abs(angleDiff) < 0.45) {
          w.cooldownTimer = w.stats.cooldown * cooldownMult;

          if (this.minigunMuzzlePoint) {
            this.minigunMuzzlePoint.getWorldPosition(_scratchOrigin);
          } else {
            _scratchOrigin.set(carPos.x, carPos.y + 1.4, carPos.z);
          }

          _scratchAimDir.set(
            targetPos.x - _scratchOrigin.x,
            targetPos.y + 0.5 - _scratchOrigin.y,
            targetPos.z - _scratchOrigin.z
          ).normalize();

          projectileManager.spawnBullet(_scratchOrigin, _scratchAimDir, effectiveDmg);
          dynamicLights?.flash(_scratchOrigin.x, _scratchOrigin.y, _scratchOrigin.z, 0xffe066, 1.8, 8, 22.0);
          audioManager.playMinigunShot();
        }
      } else if (w.type === 'SIDE_BUZZSAWS') {
        if (w.cooldownTimer > 0) return;
        // Continuous proximity shred
        let hit = false;
        for (let i = 0; i < zombies.length; i++) {
          const z = zombies[i];
          if (z.isDead) continue;
          const dx = z.position.x - carPos.x;
          const dz = z.position.z - carPos.z;
          if (dx * dx + dz * dz <= rangeSq) {
            onZombieDamage(z, effectiveDmg);
            particleSystem.emitBloodSplatter(z.position.x, z.position.y + 0.5, z.position.z, 6);
            particleSystem.emitSparks(z.position.x, z.position.y + 0.3, z.position.z, 4);
            hit = true;
          }
        }
        if (boss && !boss.isDead) {
          const bdx = boss.position.x - carPos.x;
          const bdz = boss.position.z - carPos.z;
          if (bdx * bdx + bdz * bdz <= rangeSq + 4) {
            onBossDamage(effectiveDmg);
            particleSystem.emitBloodSplatter(boss.position.x, boss.position.y + 1.0, boss.position.z, 8);
            hit = true;
          }
        }
        if (hit) {
          w.cooldownTimer = w.stats.cooldown * cooldownMult;
          audioManager.playSplatter();
        }
      } else if (w.type === 'FLAMETHROWER') {
        if (w.cooldownTimer > 0) return;
        // Ignite forward cone
        let hitAny = false;
        for (let i = 0; i < zombies.length; i++) {
          const z = zombies[i];
          if (z.isDead) continue;
          const toX = z.position.x - carPos.x;
          const toZ = z.position.z - carPos.z;
          const dSq = toX * toX + toZ * toZ;
          if (dSq <= rangeSq) {
            const d = Math.sqrt(dSq);
            const dot = carForward.x * (toX / d) + carForward.z * (toZ / d);
            if (dot > 0.35) {
              onZombieDamage(z, effectiveDmg);
              hitAny = true;
            }
          }
        }
        if (boss && !boss.isDead) {
          const toX = boss.position.x - carPos.x;
          const toZ = boss.position.z - carPos.z;
          const dSq = toX * toX + toZ * toZ;
          if (dSq <= rangeSq + 6) {
            const d = Math.sqrt(dSq);
            const dot = carForward.x * (toX / d) + carForward.z * (toZ / d);
            if (dot > 0.35) {
              onBossDamage(effectiveDmg);
              hitAny = true;
            }
          }
        }
        w.cooldownTimer = w.stats.cooldown * cooldownMult;
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
            2.2,
            12,
            7.0
          );
        }
      } else if (w.type === 'MORTAR_LAUNCHER') {
        if (w.cooldownTimer > 0) return;
        // Fire homing rocket at dense cluster or boss
        let targetPos: THREE.Vector3 | null = null;
        let maxHp = 0;

        if (boss && !boss.isDead) {
          targetPos = boss.position;
        } else {
          for (let i = 0; i < zombies.length; i++) {
            const z = zombies[i];
            if (z.isDead) continue;
            const dx = z.position.x - carPos.x;
            const dz = z.position.z - carPos.z;
            if (dx * dx + dz * dz <= rangeSq && z.health > maxHp) {
              maxHp = z.health;
              targetPos = z.position;
            }
          }
        }

        if (targetPos) {
          w.cooldownTimer = w.stats.cooldown * cooldownMult;
          _scratchOrigin.set(carPos.x, carPos.y + 1.6, carPos.z);
          _scratchAimDir.set(carForward.x, 0.8, carForward.z).normalize();
          projectileManager.spawnRocket(_scratchOrigin, _scratchAimDir, effectiveDmg, targetPos);
          dynamicLights?.flash(_scratchOrigin.x, _scratchOrigin.y, _scratchOrigin.z, 0xff7700, 2.0, 8, 12.0);
          audioManager.playExplosion();
        }
      } else if (w.type === 'SHOCK_RING') {
        if (w.cooldownTimer > 0) return;
        // Chain lightning to nearby enemies
        let hitCount = 0;
        const maxHits = 4 + w.level * 2;

        for (let i = 0; i < zombies.length; i++) {
          const z = zombies[i];
          if (z.isDead) continue;
          const dx = z.position.x - carPos.x;
          const dz = z.position.z - carPos.z;
          if (dx * dx + dz * dz <= rangeSq) {
            onZombieDamage(z, effectiveDmg);
            particleSystem.emitSparks(z.position.x, z.position.y + 1, z.position.z, 6);
            hitCount++;
            if (hitCount >= maxHits) break;
          }
        }

        if (boss && !boss.isDead) {
          const bdx = boss.position.x - carPos.x;
          const bdz = boss.position.z - carPos.z;
          if (bdx * bdx + bdz * bdz <= rangeSq) {
            onBossDamage(effectiveDmg);
            particleSystem.emitSparks(boss.position.x, boss.position.y + 1.5, boss.position.z, 8);
            hitCount++;
          }
        }

        if (hitCount > 0) {
          w.cooldownTimer = w.stats.cooldown * cooldownMult;
          audioManager.playShockZap();
          dynamicLights?.flash(carPos.x, 1.4, carPos.z, 0x00f0ff, 2.5, 14, 9.0);
        }
      }
    });
  }

  public clear(): void {
    this.weapons.clear();
    this.sawMeshL = null;
    this.sawMeshR = null;
    this.minigunSwivel = null;
    this.minigunMuzzlePoint = null;
    this.currentTurretYaw = 0;
  }
}
