import * as THREE from 'three';
import { WeaponType } from '../types/weapon';
import { ProjectileManager } from './Projectile';
import { ParticleSystem } from '../graphics/ParticleSystem';
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
const _scratchFlameOrigin = new THREE.Vector3();
const _scratchZapTarget = new THREE.Vector3();

export class WeaponSystem {
  public group = new THREE.Group();
  public weapons: Map<WeaponType, WeaponInstance> = new Map();
  private sawMeshL: THREE.Mesh | null = null;
  private sawMeshR: THREE.Mesh | null = null;
  private minigunSwivel: THREE.Group | null = null;
  private minigunBarrels: THREE.Group | null = null;
  private minigunMuzzlePoint: THREE.Object3D | null = null;
  private teslaSphere: THREE.Mesh | null = null;
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

    // Shared high-quality weapon materials
    const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.92, roughness: 0.25 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.96, roughness: 0.08 });
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.85, roughness: 0.4 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.5, roughness: 0.3 });

    if (type === 'ROOF_MINIGUN') {
      // ═══════════════════════════════════════════════════════════════════════
      // 6-BARREL ROTARY GATLING TURRET
      // ═══════════════════════════════════════════════════════════════════════
      // 1. Heavy Turntable Base Plate on Roof
      const baseGeo = new THREE.CylinderGeometry(0.42, 0.48, 0.18, 16);
      const base = new THREE.Mesh(baseGeo, darkSteelMat);
      base.position.set(0, 0.09, 0);
      wGroup.add(base);

      // Servo drive ring
      const servoRing = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 12), brassMat);
      servoRing.position.set(0, 0.2, 0);
      wGroup.add(servoRing);

      // 2. Rotating Turret Swivel Head
      const swivel = new THREE.Group();
      swivel.position.set(0, 0.22, 0);

      // Turret Armor Housing
      const housingGeo = new THREE.BoxGeometry(0.48, 0.32, 0.65);
      const housing = new THREE.Mesh(housingGeo, gunMetalMat);
      housing.position.set(0, 0.16, -0.05);
      swivel.add(housing);

      // Optical Targeting Scope
      const scopeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.35, 10);
      const scopeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.9 });
      const scope = new THREE.Mesh(scopeGeo, scopeMat);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.38, 0.05);
      const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
      scopeLens.rotation.x = Math.PI / 2;
      scopeLens.position.set(0, 0.38, 0.23);
      swivel.add(scope, scopeLens);

      // Side Ammo Feed Drum with Brass Chute
      const drumGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.22, 12);
      const drum = new THREE.Mesh(drumGeo, darkSteelMat);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(-0.35, 0.16, -0.05);
      swivel.add(drum);

      // 3. 6-Barrel Gatling Rotary Assembly
      const barrelsGroup = new THREE.Group();
      barrelsGroup.position.set(0, 0.16, 0.32);

      const barrelGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8);
      const barrelCount = 6;
      const barrelRadius = 0.12;

      for (let b = 0; b < barrelCount; b++) {
        const bAngle = (b / barrelCount) * Math.PI * 2;
        const barrel = new THREE.Mesh(barrelGeo, chromeMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(Math.cos(bAngle) * barrelRadius, Math.sin(bAngle) * barrelRadius, 0.45);
        barrelsGroup.add(barrel);
      }

      // Front & Middle Barrel Clamps
      const clamp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), gunMetalMat);
      clamp1.rotation.x = Math.PI / 2;
      clamp1.position.set(0, 0, 0.4);
      const clamp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), gunMetalMat);
      clamp2.rotation.x = Math.PI / 2;
      clamp2.position.set(0, 0, 0.95);
      barrelsGroup.add(clamp1, clamp2);

      swivel.add(barrelsGroup);

      // Muzzle anchor point for bullet origins
      const muzzlePoint = new THREE.Object3D();
      muzzlePoint.position.set(0, 0.16, 1.45);
      swivel.add(muzzlePoint);

      wGroup.add(swivel);
      weaponMountRoof.add(wGroup);

      this.minigunSwivel = swivel;
      this.minigunBarrels = barrelsGroup;
      this.minigunMuzzlePoint = muzzlePoint;
      this.currentTurretYaw = 0;

      // Base Level 1 Stats
      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 4, cooldown: 1.0, range: 18 },
      });
    } else if (type === 'SIDE_BUZZSAWS') {
      // ═══════════════════════════════════════════════════════════════════════
      // DUAL SERRATED DIAMOND-TOOTH BUZZSAWS
      // ═══════════════════════════════════════════════════════════════════════
      const createSawArm = (side: -1 | 1) => {
        const armRoot = new THREE.Group();

        // Heavy welded mounting arm with hydraulic piston
        const mountArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.14), darkSteelMat);
        mountArm.position.set(side * 0.18, 0, 0);
        armRoot.add(mountArm);

        // Circular Saw Blade
        const sawGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.04, 20);
        const sawMat = new THREE.MeshStandardMaterial({
          color: 0xeeeeee,
          metalness: 0.98,
          roughness: 0.06,
        });

        const sawBlade = new THREE.Mesh(sawGeo, sawMat);
        sawBlade.rotation.z = Math.PI / 2;
        sawBlade.position.set(side * 0.38, 0, 0);

        // Center Chrome Nut & Cooling Holes
        const centerNut = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), brassMat);
        centerNut.rotation.z = Math.PI / 2;
        sawBlade.add(centerNut);

        for (let h = 0; h < 6; h++) {
          const hAngle = (h / 6) * Math.PI * 2;
          const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), darkSteelMat);
          vent.position.set(Math.cos(hAngle) * 0.45, 0, Math.sin(hAngle) * 0.45);
          sawBlade.add(vent);
        }

        armRoot.add(sawBlade);
        return { armRoot, sawBlade };
      };

      const leftSaw = createSawArm(-1);
      const rightSaw = createSawArm(1);

      weaponMountLeft.add(leftSaw.armRoot);
      weaponMountRight.add(rightSaw.armRoot);

      this.sawMeshL = leftSaw.sawBlade;
      this.sawMeshR = rightSaw.sawBlade;

      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 12, cooldown: 0.45, range: 3.8 },
      });
    } else if (type === 'FLAMETHROWER') {
      // ═══════════════════════════════════════════════════════════════════════
      // TWIN HEAVY INDUSTRIAL FLAMETHROWERS & ROOF FUEL TANKS
      // ═══════════════════════════════════════════════════════════════════════
      // 1. Dual Pressurized Gas Tanks on Roof
      const tankGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.75, 12);
      const tankL = new THREE.Mesh(tankGeo, hazardMat);
      tankL.rotation.x = Math.PI / 2;
      tankL.position.set(-0.35, 0.25, -0.2);
      const tankR = new THREE.Mesh(tankGeo, hazardMat);
      tankR.rotation.x = Math.PI / 2;
      tankR.position.set(0.35, 0.25, -0.2);

      // Pressure Gauge
      const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), brassMat);
      gauge.position.set(0, 0.4, -0.2);
      wGroup.add(tankL, tankR, gauge);

      // 2. Twin Heavy Flame Projector Nozzles
      const nozzleGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.75, 10);
      const nL = new THREE.Mesh(nozzleGeo, gunMetalMat);
      nL.rotation.x = Math.PI / 2;
      nL.position.set(-0.65, 0.22, 1.45);
      const nR = new THREE.Mesh(nozzleGeo, gunMetalMat);
      nR.rotation.x = Math.PI / 2;
      nR.position.set(0.65, 0.22, 1.45);

      // Pilot Flame Igniter Tips
      const pilotL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 6), chromeMat);
      pilotL.rotation.x = Math.PI / 2;
      pilotL.position.set(-0.65, 0.1, 1.82);
      const pilotR = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 6), chromeMat);
      pilotR.rotation.x = Math.PI / 2;
      pilotR.position.set(0.65, 0.1, 1.82);

      wGroup.add(nL, nR, pilotL, pilotR);
      weaponMountRoof.add(wGroup);

      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 8, cooldown: 0.65, range: 11 },
      });
    } else if (type === 'MORTAR_LAUNCHER') {
      // ═══════════════════════════════════════════════════════════════════════
      // 4-TUBE HONEYCOMB ROCKET LAUNCHER POD
      // ═══════════════════════════════════════════════════════════════════════
      const podGeo = new THREE.BoxGeometry(0.75, 0.45, 1.0);
      const podMat = new THREE.MeshStandardMaterial({ color: 0x3d4a3d, metalness: 0.7, roughness: 0.4 });
      const pod = new THREE.Mesh(podGeo, podMat);
      pod.rotation.x = -0.28;
      pod.position.set(0, 0.25, 0);

      // 4 Rocket Launch Tubes with warheads
      for (let tx = -0.2; tx <= 0.2; tx += 0.4) {
        for (let ty = -0.1; ty <= 0.1; ty += 0.2) {
          const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.95, 8), darkSteelMat);
          tube.rotation.x = Math.PI / 2;
          tube.position.set(tx, ty, 0.05);
          const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), chromeMat);
          warhead.rotation.x = Math.PI / 2;
          warhead.position.set(tx, ty, 0.55);
          pod.add(tube, warhead);
        }
      }

      // Laser Target Designator
      const laserDiode = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), new THREE.MeshBasicMaterial({ color: 0xff0044 }));
      laserDiode.rotation.x = Math.PI / 2;
      laserDiode.position.set(0.3, 0.18, 0.52);
      pod.add(laserDiode);

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
      // ═══════════════════════════════════════════════════════════════════════
      // TESLA COIL PLASMA ARRAY
      // ═══════════════════════════════════════════════════════════════════════
      // Copper Base Coil
      const coilBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.35, 12), darkSteelMat);
      coilBase.position.set(0, 0.18, 0);
      wGroup.add(coilBase);

      // Copper Windings
      for (let w = 0; w < 4; w++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26 - w * 0.02, 0.04, 8, 16), brassMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0.1 + w * 0.08, 0);
        wGroup.add(ring);
      }

      // Glowing Plasma Sphere Top
      const teslaGeo = new THREE.SphereGeometry(0.32, 12, 12);
      const teslaMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x0077b6,
        emissiveIntensity: 2.2,
        roughness: 0.1,
      });
      const tesla = new THREE.Mesh(teslaGeo, teslaMat);
      tesla.position.set(0, 0.55, 0);
      wGroup.add(tesla);
      this.teslaSphere = tesla;

      weaponMountRoof.add(wGroup);
      this.weapons.set(type, {
        type,
        level: 1,
        cooldownTimer: 0,
        meshGroup: wGroup,
        stats: { damage: 22, cooldown: 3.8, range: 13 },
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
    particleSystem: ParticleSystem,
    dynamicLights?: DynamicLightManager
  ): void {
    // 1. Spin Buzzsaws
    if (this.sawMeshL && this.sawMeshR) {
      const spinSpeed = (isDrifting ? 42 : 25) * dt;
      this.sawMeshL.rotation.x += spinSpeed;
      this.sawMeshR.rotation.x += spinSpeed;
    }

    // 2. Animate Tesla Plasma Sphere Glow
    if (this.teslaSphere) {
      const time = performance.now() * 0.008;
      const mat = this.teslaSphere.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 1.8 + 0.8 * Math.sin(time * 3.0);
      }
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
        const baseTurnSpeed = 7.5 * turretSpeedMult;
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
          // Neutral return
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

        // 3. Firing & Barrel Spin
        if (targetPos && w.cooldownTimer <= 0 && Math.abs(angleDiff) < 0.45) {
          w.cooldownTimer = w.stats.cooldown * cooldownMult;

          // Spin barrels
          if (this.minigunBarrels) {
            this.minigunBarrels.rotation.z += 1.2;
          }

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
          particleSystem.emitMuzzleFlash(_scratchOrigin.x, _scratchOrigin.y, _scratchOrigin.z, _scratchAimDir);
          dynamicLights?.flash(_scratchOrigin.x, _scratchOrigin.y, _scratchOrigin.z, 0xffe066, 1.8, 8, 22.0);
          audioManager.playMinigunShot();
        }
      } else if (w.type === 'SIDE_BUZZSAWS') {
        if (w.cooldownTimer > 0) return;
        let hit = false;
        for (let i = 0; i < zombies.length; i++) {
          const z = zombies[i];
          if (z.isDead) continue;
          const dx = z.position.x - carPos.x;
          const dz = z.position.z - carPos.z;
          if (dx * dx + dz * dz <= rangeSq) {
            const isToxic = z.type === 'SPITTER';
            onZombieDamage(z, effectiveDmg);
            particleSystem.emitBloodSpurt(z.position.x, z.position.y + 0.5, z.position.z, carForward, 18, isToxic);
            particleSystem.emitBloodChunks(z.position.x, z.position.y + 0.5, z.position.z, 6);
            particleSystem.emitBloodMist(z.position.x, z.position.y + 0.5, z.position.z, 4, isToxic);
            particleSystem.emitSparks(z.position.x, z.position.y + 0.3, z.position.z, 6);
            hit = true;
          }
        }
        if (boss && !boss.isDead) {
          const bdx = boss.position.x - carPos.x;
          const bdz = boss.position.z - carPos.z;
          if (bdx * bdx + bdz * bdz <= rangeSq + 4) {
            onBossDamage(effectiveDmg);
            particleSystem.emitBloodBurst(boss.position.x, boss.position.y + 1.0, boss.position.z, 24, 1.3);
            particleSystem.emitBloodMist(boss.position.x, boss.position.y + 1.0, boss.position.z, 6);
            particleSystem.emitBloodChunks(boss.position.x, boss.position.y + 1.0, boss.position.z, 8);
            particleSystem.emitSparks(boss.position.x, boss.position.y + 0.8, boss.position.z, 8);
            hit = true;
          }
        }
        if (hit) {
          w.cooldownTimer = w.stats.cooldown * cooldownMult;
          audioManager.playSplatter();
        }
      } else if (w.type === 'FLAMETHROWER') {
        if (w.cooldownTimer > 0) return;
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
              const isToxic = z.type === 'SPITTER';
              onZombieDamage(z, effectiveDmg);
              particleSystem.emitBloodSplatter(z.position.x, z.position.y + 0.5, z.position.z, 6, isToxic);
              particleSystem.emitBloodMist(z.position.x, z.position.y + 0.5, z.position.z, 3, isToxic);
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

        // Continuous billowing flame stream
        _scratchFlameOrigin.set(
          carPos.x + carForward.x * 1.8,
          carPos.y + 0.6,
          carPos.z + carForward.z * 1.8
        );
        particleSystem.emitFlameStream(_scratchFlameOrigin, carForward, 5);

        if (hitAny) {
          audioManager.playFlamethrower();
          dynamicLights?.flash(
            carPos.x + carForward.x * 2.8,
            0.8,
            carPos.z + carForward.z * 2.8,
            0xff5500,
            2.5,
            14,
            8.0
          );
        }
      } else if (w.type === 'MORTAR_LAUNCHER') {
        if (w.cooldownTimer > 0) return;
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
          particleSystem.emitMuzzleFlash(_scratchOrigin.x, _scratchOrigin.y, _scratchOrigin.z, _scratchAimDir);
          dynamicLights?.flash(_scratchOrigin.x, _scratchOrigin.y, _scratchOrigin.z, 0xff7700, 2.2, 10, 12.0);
          audioManager.playExplosion();
        }
      } else if (w.type === 'SHOCK_RING') {
        if (w.cooldownTimer > 0) return;
        let hitCount = 0;
        const maxHits = 4 + w.level * 2;
        const teslaOrigin = new THREE.Vector3(carPos.x, carPos.y + 1.6, carPos.z);

        for (let i = 0; i < zombies.length; i++) {
          const z = zombies[i];
          if (z.isDead) continue;
          const dx = z.position.x - carPos.x;
          const dz = z.position.z - carPos.z;
          if (dx * dx + dz * dz <= rangeSq) {
            const isToxic = z.type === 'SPITTER';
            onZombieDamage(z, effectiveDmg);
            _scratchZapTarget.set(z.position.x, z.position.y + 0.8, z.position.z);
            particleSystem.emitLightningArc(teslaOrigin, _scratchZapTarget, 4);
            particleSystem.emitSparks(z.position.x, z.position.y + 1, z.position.z, 8);
            particleSystem.emitBloodBurst(z.position.x, z.position.y + 0.8, z.position.z, 10, 0.8, isToxic);
            hitCount++;
            if (hitCount >= maxHits) break;
          }
        }

        if (boss && !boss.isDead) {
          const bdx = boss.position.x - carPos.x;
          const bdz = boss.position.z - carPos.z;
          if (bdx * bdx + bdz * bdz <= rangeSq) {
            onBossDamage(effectiveDmg);
            _scratchZapTarget.set(boss.position.x, boss.position.y + 1.5, boss.position.z);
            particleSystem.emitLightningArc(teslaOrigin, _scratchZapTarget, 6);
            particleSystem.emitSparks(boss.position.x, boss.position.y + 1.5, boss.position.z, 10);
            particleSystem.emitBloodBurst(boss.position.x, boss.position.y + 1.5, boss.position.z, 16, 1.0);
            hitCount++;
          }
        }

        if (hitCount > 0) {
          w.cooldownTimer = w.stats.cooldown * cooldownMult;
          audioManager.playShockZap();
          dynamicLights?.flash(carPos.x, 1.6, carPos.z, 0x00f0ff, 3.0, 16, 9.0);
        }
      }
    });
  }

  public clear(): void {
    this.weapons.clear();
    this.sawMeshL = null;
    this.sawMeshR = null;
    this.minigunSwivel = null;
    this.minigunBarrels = null;
    this.minigunMuzzlePoint = null;
    this.teslaSphere = null;
    this.currentTurretYaw = 0;
  }
}
