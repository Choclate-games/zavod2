import * as THREE from "three";
import { PointCloudRenderer, PointCloudSample } from "../rendering/PointCloudRenderer";
import { ParticleEffects } from "../rendering/ParticleEffects";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { EnemyPool } from "../entities/EnemyPool";
import { CrystalCluster } from "../entities/CrystalCluster";
import { GameStats, GAME_CONSTANTS } from "../utils/Constants";
import { MathUtils } from "../utils/MathUtils";
import { EventBus } from "../core/EventBus";

export interface ActivePulse {
  origin: THREE.Vector3;
  radius: number;
  maxRadius: number;
  speed: number;
  age: number;
  maxAge: number;
  isPlayer: boolean;
  colorHex: number;
}

export class SonarSystem {
  private pointCloud: PointCloudRenderer;
  private fx: ParticleEffects;
  private physics: PhysicsWorld;
  private eventBus: EventBus;
  private activePulses: ActivePulse[] = [];

  constructor(
    pointCloud: PointCloudRenderer,
    fx: ParticleEffects,
    physics: PhysicsWorld,
    eventBus: EventBus
  ) {
    this.pointCloud = pointCloud;
    this.fx = fx;
    this.physics = physics;
    this.eventBus = eventBus;
  }

  public triggerPulse(
    origin: THREE.Vector3,
    stats: GameStats,
    isPlayer: boolean = true,
    customRange?: number
  ): void {
    const range = customRange ?? stats.baseScanRange;
    const speed = stats.waveSpeed;
    const maxAge = range / speed;
    const colorHex = isPlayer ? 0x00f0ff : 0xffaa00;

    this.activePulses.push({
      origin: origin.clone(),
      radius: 0.1,
      maxRadius: range,
      speed,
      age: 0,
      maxAge,
      isPlayer,
      colorHex
    });

    // 3D Visual Sonic Ring FX
    this.fx.emitSonicRing(origin, range, speed, colorHex);

    this.eventBus.emit("sonar:pulse", {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      range,
      isPlayer
    });

    // Acoustic resonator bonus: break crystals in radius immediately
    if (isPlayer && stats.acousticResonatorRadius > 0) {
      // Handled in crystal check
    }
  }

  public update(
    dt: number,
    stats: GameStats,
    enemyPool: EnemyPool,
    crystals: CrystalCluster[],
    stationPos: THREE.Vector3,
    exitPos: THREE.Vector3
  ): void {
    const samples: PointCloudSample[] = [];

    for (let p = this.activePulses.length - 1; p >= 0; p--) {
      const pulse = this.activePulses[p];
      const prevRadius = pulse.radius;
      pulse.age += dt;
      pulse.radius += pulse.speed * dt;

      const curRadius = pulse.radius;

      // 1. Sample Wall Geometry
      const obstacles = this.physics.getObstacles();
      for (let i = 0; i < obstacles.length; i++) {
        const box = obstacles[i];
        this.sampleBoxSurface(pulse.origin, prevRadius, curRadius, box, samples, stats);
      }

      // 2. Sample Enemies
      for (let i = 0; i < enemyPool.enemies.length; i++) {
        const enemy = enemyPool.enemies[i];
        const dist = pulse.origin.distanceTo(enemy.body.position);
        if (dist >= prevRadius && dist <= curRadius) {
          const lifetime = stats.dopplerFilterActive ? stats.particleLifetime * 1.4 : stats.particleLifetime;
          const count = 35;
          for (let k = 0; k < count; k++) {
            const ox = MathUtils.randomRange(-0.5, 0.5);
            const oy = MathUtils.randomRange(0.1, 1.2);
            const oz = MathUtils.randomRange(-0.5, 0.5);
            samples.push({
              x: enemy.body.position.x + ox,
              y: enemy.body.position.y + oy,
              z: enemy.body.position.z + oz,
              r: 1.0,
              g: 0.1,
              b: 0.25,
              size: 3.5,
              lifetime
            });
          }

          // Infrasound stun on scan if perk active
          if (pulse.isPlayer && stats.infrasoundStunActive && dist <= 8.0) {
            enemy.stun(2.5);
          }
        }
      }

      // 3. Sample Crystals
      for (let i = 0; i < crystals.length; i++) {
        const crystal = crystals[i];
        if (crystal.isHarvested) continue;
        const dist = pulse.origin.distanceTo(crystal.body.position);
        if (dist >= prevRadius && dist <= curRadius) {
          const count = 25;
          for (let k = 0; k < count; k++) {
            const ox = MathUtils.randomRange(-0.4, 0.4);
            const oy = MathUtils.randomRange(0.1, 1.4);
            const oz = MathUtils.randomRange(-0.4, 0.4);
            samples.push({
              x: crystal.body.position.x + ox,
              y: crystal.body.position.y + oy,
              z: crystal.body.position.z + oz,
              r: 0.75,
              g: 0.33,
              b: 0.95,
              size: 3.2,
              lifetime: stats.particleLifetime
            });
          }

          // Resonator shatter
          if (pulse.isPlayer && stats.acousticResonatorRadius > 0 && dist <= stats.acousticResonatorRadius) {
            const yieldAmt = crystal.shatter(stats.resonanceFrequencyMatch);
            if (yieldAmt > 0) {
              this.eventBus.emit("crystal:collected", {
                amount: yieldAmt,
                totalInRun: yieldAmt
              });
              this.fx.emitCrystalSparks(crystal.body.position, 0xbf55ec, 25);
            }
          }
        }
      }

      // 4. Sample Station & Exit
      const dStation = pulse.origin.distanceTo(stationPos);
      if (dStation >= prevRadius && dStation <= curRadius) {
        for (let k = 0; k < 20; k++) {
          samples.push({
            x: stationPos.x + MathUtils.randomRange(-0.6, 0.6),
            y: stationPos.y + MathUtils.randomRange(0.1, 1.5),
            z: stationPos.z + MathUtils.randomRange(-0.6, 0.6),
            r: 0.0,
            g: 1.0,
            b: 0.55,
            size: 3.5,
            lifetime: stats.particleLifetime
          });
        }
      }

      const dExit = pulse.origin.distanceTo(exitPos);
      if (dExit >= prevRadius && dExit <= curRadius) {
        for (let k = 0; k < 25; k++) {
          samples.push({
            x: exitPos.x + MathUtils.randomRange(-0.9, 0.9),
            y: exitPos.y + MathUtils.randomRange(0.1, 2.5),
            z: exitPos.z + MathUtils.randomRange(-0.9, 0.9),
            r: 0.0,
            g: 0.95,
            b: 1.0,
            size: 3.5,
            lifetime: stats.particleLifetime
          });
        }
      }

      // End of pulse
      if (pulse.age >= pulse.maxAge || pulse.radius >= pulse.maxRadius) {
        this.activePulses.splice(p, 1);
      }
    }

    if (samples.length > 0) {
      this.pointCloud.addBatch(samples);
    }
  }

  private sampleBoxSurface(
    origin: THREE.Vector3,
    r1: number,
    r2: number,
    box: THREE.Box3,
    out: PointCloudSample[],
    stats: GameStats
  ): void {
    // Generate points along the box surface within ring range
    const stepsX = Math.max(2, Math.round((box.max.x - box.min.x) * 1.5));
    const stepsZ = Math.max(2, Math.round((box.max.z - box.min.z) * 1.5));

    for (let ix = 0; ix <= stepsX; ix++) {
      const x = box.min.x + (ix / stepsX) * (box.max.x - box.min.x);
      for (let iz = 0; iz <= stepsZ; iz++) {
        const z = box.min.z + (iz / stepsZ) * (box.max.z - box.min.z);
        const dx = x - origin.x;
        const dz = z - origin.z;
        const d = Math.sqrt(dx * dx + dz * dz);

        if (d >= r1 && d <= r2) {
          const y = MathUtils.randomRange(0.1, box.max.y);
          out.push({
            x: x + MathUtils.randomRange(-0.08, 0.08),
            y,
            z: z + MathUtils.randomRange(-0.08, 0.08),
            r: 0.0,
            g: 0.9,
            b: 1.0,
            size: 2.8,
            lifetime: stats.particleLifetime + stats.phosphorGlowBonus
          });
        }
      }
    }
  }

  public clear(): void {
    this.activePulses = [];
  }
}
