import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerVehicle } from './PlayerVehicle';
import { PoliceVehicle, PoliceType } from './PoliceVehicle';
import { PursuitBreaker } from './PursuitBreaker';
import { Helicopter } from './Helicopter';
import { BossEntity } from './BossEntity';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { EventBus } from '../core/EventBus';

export class EntityManager {
  readonly policePool: PoliceVehicle[] = [];
  readonly pursuitBreakers: PursuitBreaker[] = [];
  readonly helicopter: Helicopter;
  readonly boss: BossEntity;

  private spawnTimer = 0;
  private spawnInterval = 3.5;
  private maxActiveCops = 14;

  heatLevel = 1;
  elapsedTime = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly player: PlayerVehicle
  ) {
    // 1. Pre-allocate Police Pool
    for (let i = 0; i < 6; i++) {
      this.policePool.push(new PoliceVehicle('cruiser', scene, physics));
    }
    for (let i = 0; i < 4; i++) {
      this.policePool.push(new PoliceVehicle('interceptor', scene, physics));
    }
    for (let i = 0; i < 4; i++) {
      this.policePool.push(new PoliceVehicle('rhino', scene, physics));
    }

    // 2. Helicopter
    this.helicopter = new Helicopter(scene);

    // 3. Boss
    this.boss = new BossEntity(scene, physics);

    // 4. Pursuit Breakers
    this.pursuitBreakers.push(
      new PursuitBreaker('billboard', new THREE.Vector3(-45, 0, -45), scene, physics),
      new PursuitBreaker('gas_station', new THREE.Vector3(45, 0, 45), scene, physics),
      new PursuitBreaker('water_tower', new THREE.Vector3(-60, 0, 50), scene, physics),
      new PursuitBreaker('billboard', new THREE.Vector3(60, 0, -50), scene, physics)
    );

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Pursuit Breaker collapsed: destroy all police in radius
    EventBus.get().on('pursuit_breaker:collapsed', ({ position, radius }) => {
      this.policePool.forEach(cop => {
        if (cop.active && !cop.isDestroyed) {
          const dist = cop.position.distanceTo(position);
          if (dist <= radius) {
            const pushDir = cop.position.clone().sub(position).normalize();
            cop.takeDamage(9999, pushDir, true);
          }
        }
      });
      if (this.boss.active && !this.boss.isDefeated) {
        if (this.boss.position.distanceTo(position) <= radius) {
          this.boss.takeDamage(220, undefined, true);
        }
      }
    });

    // Autocannon Fire: target nearest active police or boss
    EventBus.get().on('player:autocannon_fire', ({ origin, damage }) => {
      let closestTarget: { takeDamage: (dmg: number) => void; position: THREE.Vector3 } | null = null;
      let minDist = 38.0;

      if (this.boss.active && !this.boss.isDefeated) {
        const d = origin.distanceTo(this.boss.position);
        if (d < minDist) {
          closestTarget = this.boss;
          minDist = d;
        }
      }

      this.policePool.forEach(cop => {
        if (cop.active && !cop.isDestroyed) {
          const d = origin.distanceTo(cop.position);
          if (d < minDist) {
            minDist = d;
            closestTarget = cop;
          }
        }
      });

      if (closestTarget) {
        closestTarget.takeDamage(damage);
        ParticleSystem.get().emitDriftSparks(closestTarget.position);
        SoundSynthesizer.get().playImpactCrash(0.5);
      }
    });

    // Tesla EMP Discharge: hit all enemies in radius
    EventBus.get().on('player:tesla_discharge', ({ position, radius, damage }) => {
      this.policePool.forEach(cop => {
        if (cop.active && !cop.isDestroyed && cop.position.distanceTo(position) <= radius) {
          const push = cop.position.clone().sub(position).normalize();
          cop.takeDamage(damage, push, true);
        }
      });
      if (this.boss.active && !this.boss.isDefeated && this.boss.position.distanceTo(position) <= radius) {
        this.boss.takeDamage(damage, undefined, true);
      }
    });

    // Napalm Dropped
    EventBus.get().on('player:napalm_dropped', ({ position, radius, damage }) => {
      this.policePool.forEach(cop => {
        if (cop.active && !cop.isDestroyed && cop.position.distanceTo(position) <= radius) {
          cop.takeDamage(damage * 0.4);
        }
      });
    });
  }

  update(dt: number): void {
    this.elapsedTime += dt;

    // 1. Heat Level Scaling
    if (this.elapsedTime > 330) {
      this.heatLevel = 5;
    } else if (this.elapsedTime > 210) {
      this.heatLevel = 4;
    } else if (this.elapsedTime > 90) {
      this.heatLevel = 3;
    } else if (this.elapsedTime > 30) {
      this.heatLevel = 2;
    } else {
      this.heatLevel = 1;
    }

    // Helicopter activation on Heat >= 4
    if (this.heatLevel >= 4 && !this.helicopter.active) {
      this.helicopter.spawn(this.player.position);
    }
    this.helicopter.update(dt, this.player.position);

    // Boss spawn around 5:00 min mark or Heat 5
    if (this.elapsedTime >= 270 && !this.boss.active && !this.boss.isDefeated) {
      const spawnOffset = new THREE.Vector3(
        (Math.random() - 0.5) * 40,
        0,
        (Math.random() - 0.5) * 40
      ).normalize().multiplyScalar(45);
      this.boss.spawn(this.player.position.clone().add(spawnOffset));
    }
    if (this.boss.active) {
      this.boss.update(dt, this.player.position);
    }

    // 2. Spawn Police Units
    this.spawnTimer += dt;
    const densitySpawnRate = Math.max(1.5, 4.0 - this.heatLevel * 0.5);
    if (this.spawnTimer >= densitySpawnRate) {
      this.spawnTimer = 0;
      this.spawnPoliceUnit();
    }

    // 3. Update active Police
    this.policePool.forEach(cop => {
      if (cop.active) {
        cop.update(dt, this.player.position, this.player.speedKmH);
      }
    });

    // 4. Update Pursuit Breakers
    this.pursuitBreakers.forEach(pb => {
      pb.update(dt);
      pb.checkCollision(this.player.position, this.player.speedKmH);
    });

    // 5. Collision Checks: Player vs Police & Boss
    this.checkVehicleCollisions();
  }

  private spawnPoliceUnit(): void {
    const activeCount = this.policePool.filter(c => c.active).length;
    if (activeCount >= this.maxActiveCops) return;

    // Pick type according to Heat Level
    let targetType: PoliceType = 'cruiser';
    if (this.heatLevel >= 4 && Math.random() > 0.4) {
      targetType = 'rhino';
    } else if (this.heatLevel >= 3 && Math.random() > 0.4) {
      targetType = 'interceptor';
    }

    const available = this.policePool.find(c => !c.active && c.type === targetType) ||
      this.policePool.find(c => !c.active);

    if (available) {
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = 45 + Math.random() * 20;
      const spawnPos = this.player.position.clone().add(new THREE.Vector3(
        Math.cos(angle) * spawnDist,
        0.8,
        Math.sin(angle) * spawnDist
      ));

      const heading = this.player.position.clone().sub(spawnPos).normalize();
      available.spawn(spawnPos, heading);
    }
  }

  private checkVehicleCollisions(): void {
    const pPos = this.player.position;
    const pSpeed = this.player.speedKmH;
    const isNitro = this.player.isNitroActive;

    // Bumper Spikes Upgrade Bonus
    const bumperLvl = UpgradeSystem.get().getModuleLevel('spiked_bumper');
    const bumperBonus = 1.0 + bumperLvl * 0.35;

    // Saws Module Lvl
    const sawsLvl = UpgradeSystem.get().getModuleLevel('circular_saws');

    // 1. Collisions with Police
    this.policePool.forEach(cop => {
      if (!cop.active || cop.isDestroyed) return;

      const dist = pPos.distanceTo(cop.position);
      if (dist < 3.2) {
        // Impact vector
        const impactDir = cop.position.clone().sub(pPos).normalize();

        // Ram Damage formula from specification:
        // Ram_Damage = BaseMass_kg * (CurrentVelocity_kmh / 10)^1.85 * NitroMultiplier * BumperSpikeBonus
        const nitroMult = isNitro ? 4.5 : 1.0;
        const velocityFactor = Math.pow(Math.max(1, pSpeed / 10), 1.85);
        const ramDamage = (1200 / 1000) * velocityFactor * 12 * nitroMult * bumperBonus;

        // Circular Saws Lateral Contact bonus
        let sawDamage = 0;
        if (this.player.isDrifting && sawsLvl > 0) {
          sawDamage = 25 * sawsLvl * 2.5;
        }

        const totalDamage = ramDamage + sawDamage;

        // Damage Cop
        cop.takeDamage(totalDamage, impactDir, true);

        // Player collision recoil / damage
        if (!isNitro && !this.player.isInvulnerable) {
          const recoilDamage = Math.max(5, (cop.mass / 1400) * 12 * (1 - bumperLvl * 0.1));
          this.player.takeDamage(recoilDamage, impactDir.clone().negate());
        }
      }
    });

    // 2. Collision with Boss
    if (this.boss.active && !this.boss.isDefeated) {
      const bossDist = pPos.distanceTo(this.boss.position);
      if (bossDist < 5.2) {
        const impactDir = this.boss.position.clone().sub(pPos).normalize();
        const nitroMult = isNitro ? 4.5 : 1.0;
        const ramDamage = (1200 / 1000) * Math.pow(Math.max(1, pSpeed / 10), 1.85) * 10 * nitroMult * bumperBonus;

        this.boss.takeDamage(ramDamage, impactDir, isNitro, pSpeed);

        if (!isNitro && !this.player.isInvulnerable) {
          this.player.takeDamage(35, impactDir.clone().negate());
        }
      }
    }
  }

  reset(): void {
    this.elapsedTime = 0;
    this.heatLevel = 1;
    this.spawnTimer = 0;
    this.policePool.forEach(cop => cop.recycle());
    this.pursuitBreakers.forEach(pb => pb.reset());
    this.helicopter.hide();
    this.boss.reset();
  }
}
