import type { EventBus } from '../core/EventBus';
import { turretDamage, turretFireRate } from '../game/config';
import type { ProjectileState, SaveData } from '../game/types';
import type { MergeGridSystem } from './MergeGridSystem';
import type { WaveManager } from './WaveManager';
import type { SceneManager } from '../rendering/SceneManager';

const PROJECTILE_CAPACITY = 96;

export class CombatSystem {
  private readonly projectiles: ProjectileState[] = Array.from({ length: PROJECTILE_CAPACITY }, () => ({
    active: false,
    targetId: 0,
    tier: 1,
    damage: 0,
    critical: false,
    progress: 0,
    startX: 0,
    startY: 0,
    startZ: 0,
    endX: 0,
    endY: 0,
    endZ: 0
  }));
  private frenzyTimer = 0;

  constructor(
    private readonly bus: EventBus,
    private readonly save: SaveData,
    private readonly grid: MergeGridSystem,
    private readonly waves: WaveManager,
    private readonly scene: SceneManager
  ) {}

  get activeProjectiles(): readonly ProjectileState[] {
    return this.projectiles;
  }

  activateFrenzy(): void {
    this.frenzyTimer = 60;
  }

  update(dt: number): void {
    this.frenzyTimer = Math.max(0, this.frenzyTimer - dt);
    this.grid.tickCooldowns(dt);
    this.updateTurrets();
    this.updateProjectiles(dt);
  }

  private updateTurrets(): void {
    const target = this.waves.findTarget();
    if (!target) return;
    const targetPoint = this.scene.pointOnPath(target.progress);
    const slots = this.grid.slots;
    for (let i = 0; i < slots.length; i += 1) {
      const tier = slots[i];
      if (tier === null || this.grid.getTurretCooldown(i) > 0) continue;
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = (col - 1.5) * 1.35;
      const z = 5.9 + row * 0.78;
      const critChance = Math.min(0.55, 0.05 + this.save.upgrades.critChance * 0.025);
      const critical = Math.random() < critChance;
      const damage = Math.round(turretDamage(tier) * (1 + this.save.upgrades.damage * 0.15) * (critical ? 2 : 1));
      this.spawnProjectile(target.id, tier, damage, critical, x, 0.92, z, targetPoint.x, targetPoint.y, targetPoint.z);
      const rate = turretFireRate(tier) * (this.frenzyTimer > 0 ? 2 : 1);
      this.grid.setTurretCooldown(i, 1 / rate);
    }
  }

  private updateProjectiles(dt: number): void {
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;
      projectile.progress += dt * 3.8;
      if (projectile.progress >= 1) {
        projectile.active = false;
        this.waves.damage(projectile.targetId, projectile.damage);
        this.bus.emit('enemy:hit', {
          enemyId: projectile.targetId,
          damage: projectile.damage,
          critical: projectile.critical
        });
      }
    }
  }

  private spawnProjectile(
    targetId: number,
    tier: number,
    damage: number,
    critical: boolean,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number
  ): void {
    const projectile = this.projectiles.find((item) => !item.active);
    if (!projectile) return;
    projectile.active = true;
    projectile.targetId = targetId;
    projectile.tier = tier;
    projectile.damage = damage;
    projectile.critical = critical;
    projectile.progress = 0;
    projectile.startX = startX;
    projectile.startY = startY;
    projectile.startZ = startZ;
    projectile.endX = endX;
    projectile.endY = endY;
    projectile.endZ = endZ;
  }
}
