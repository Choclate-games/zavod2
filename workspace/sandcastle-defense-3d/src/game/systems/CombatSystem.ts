import * as THREE from 'three';
import { Tower } from '../entities/Tower.ts';
import { Enemy } from '../entities/Enemy.ts';
import { Projectile } from '../entities/Projectile.ts';
import { VFXManager } from '../entities/VFXManager.ts';
import { UpgradeManager } from './UpgradeManager.ts';
import { audio } from '../../audio/AudioManager.ts';
import { events } from '../../core/EventBus.ts';

export class CombatSystem {
  private scene: THREE.Scene;
  private vfx: VFXManager;

  public projectiles: Projectile[] = [];
  private nextProjId: number = 1;

  // Reusable projectile geometry and material
  private shellGeo: THREE.DodecahedronGeometry;
  private shellMat: THREE.MeshLambertMaterial;

  constructor(scene: THREE.Scene, vfx: VFXManager) {
    this.scene = scene;
    this.vfx = vfx;

    this.shellGeo = new THREE.DodecahedronGeometry(0.12, 0);
    this.shellMat = new THREE.MeshLambertMaterial({ color: 0xFF6348 });
  }

  public update(dt: number, towers: Iterable<Tower>, enemies: Enemy[]): void {
    const cannonDmgMult = UpgradeManager.getCannonDamageMultiplier();
    const splasherSlowMult = UpgradeManager.getSplasherSlowMultiplier();
    const splasherRangeBonus = UpgradeManager.getSplasherRangeBonus();

    // 1. Process Towers Combat
    for (const tower of towers) {
      tower.update(dt);

      if (!tower.canFire()) continue;

      if (tower.type === 'cannon') {
        const target = this.findCannonTarget(tower, enemies);
        tower.targetEnemy = target;

        if (target) {
          tower.resetCooldown();
          this.fireCannonShell(tower, target, cannonDmgMult);
        }
      } else if (tower.type === 'splasher') {
        const effectiveRange = tower.range + splasherRangeBonus;
        let anyHit = false;

        for (const enemy of enemies) {
          if (!enemy.isAlive) continue;
          const dist = tower.worldPosition.distanceTo(enemy.position);
          if (dist <= effectiveRange) {
            anyHit = true;
            enemy.takeDamage(tower.damage, false);
            enemy.applySlow(3.0, splasherSlowMult);
            this.vfx.spawnWaterSplash(enemy.position.x, enemy.position.y, enemy.position.z, 2);
          }
        }

        if (anyHit) {
          tower.resetCooldown();
          audio.playWaterSpray();
        }
      }
    }

    // 2. Update Projectiles in Flight
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const reached = proj.update(dt);

      if (reached) {
        // Hit resolution
        if (proj.targetEnemy && proj.targetEnemy.isAlive) {
          proj.targetEnemy.takeDamage(proj.damage, proj.isPhysical);
          this.vfx.spawnHitSparks(proj.currentPos.x, proj.currentPos.y, proj.currentPos.z, 5);
          audio.playHit();
        } else {
          this.vfx.spawnSandDust(proj.currentPos.x, 0, proj.currentPos.z, 6);
        }

        this.removeProjectileMesh(proj);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private findCannonTarget(tower: Tower, enemies: Enemy[]): Enemy | null {
    let bestEnemy: Enemy | null = null;
    let bestScore = -Infinity;

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      const dist = tower.worldPosition.distanceTo(enemy.position);
      if (dist <= tower.range) {
        let score = 0;
        if (tower.targetPriority === 'first') {
          // Flying or closest to destination
          score = 1000 - enemy.position.distanceTo(enemy.targetCastlePos);
        } else if (tower.targetPriority === 'strongest') {
          score = enemy.hp;
        } else {
          // Closest to tower
          score = -dist;
        }

        if (score > bestScore) {
          bestScore = score;
          bestEnemy = enemy;
        }
      }
    }

    return bestEnemy;
  }

  private fireCannonShell(tower: Tower, target: Enemy, dmgMult: number): void {
    const muzzlePos = new THREE.Vector3(
      tower.worldPosition.x,
      0.65,
      tower.worldPosition.z
    );

    const effectiveDmg = Math.round(tower.damage * dmgMult);
    const proj = new Projectile(
      this.nextProjId++,
      muzzlePos,
      target,
      effectiveDmg,
      9.5
    );

    const mesh = new THREE.Mesh(this.shellGeo, this.shellMat);
    mesh.position.copy(muzzlePos);
    this.scene.add(mesh);
    proj.mesh = mesh;

    this.projectiles.push(proj);
    audio.playCannonShot();
    this.vfx.spawnSandDust(muzzlePos.x, muzzlePos.y, muzzlePos.z, 4);
  }

  public castTsunami(enemies: Enemy[]): void {
    this.vfx.triggerTsunami();
    audio.playTsunami();

    setTimeout(() => {
      for (const enemy of enemies) {
        if (!enemy.isAlive) continue;
        if (enemy.type === 'boss_kraken') {
          enemy.takeDamage(500, false);
        } else {
          enemy.takeDamage(9999, false);
        }
      }
      events.emit('tsunami:completed');
    }, 600);
  }

  private removeProjectileMesh(proj: Projectile): void {
    if (proj.mesh) {
      this.scene.remove(proj.mesh);
      proj.mesh = null;
    }
  }

  public clear(): void {
    for (const proj of this.projectiles) {
      this.removeProjectileMesh(proj);
    }
    this.projectiles = [];
  }
}
