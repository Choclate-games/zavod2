import * as THREE from 'three';
import { bus } from '../core/EventBus';
import { WAVES, ENEMY, ARENA, math } from '../config/GameConfig';

type SpawnFn = (pos: THREE.Vector3, health: number) => void;
type GetActive = () => number;
type GetPlayerPos = () => THREE.Vector3;

/**
 * Wave Manager (Gameplay Systems Layer). Spawns deepening waves of creatures as
 * the player commits to a descent. Natural breaks between waves are the only
 * places an upgrade card is offered — never mid-combat.
 */
export class WaveManager {
  wave = 0;
  private state: 'idle' | 'active' | 'cleared' = 'idle';
  private toSpawn = 0;
  private spawnTimer = 0;
  private clearTimer = 0;
  private startTimer = 0;

  constructor(
    private readonly spawn: SpawnFn,
    private readonly getActive: GetActive,
    private readonly getPlayerPos: GetPlayerPos,
  ) {}

  start(): void {
    this.wave = 0;
    this.state = 'idle';
    this.startTimer = 2.5; // grace before the first wave
  }

  private beginNextWave(): void {
    this.wave += 1;
    this.toSpawn = Math.min(
      WAVES.maxEnemiesPerWave,
      WAVES.firstWaveEnemies + (this.wave - 1) * WAVES.enemiesPerWaveStep,
    );
    this.state = 'active';
    this.spawnTimer = 0;
    bus.emit('wave:start', { wave: this.wave });
  }

  private spawnOne(): void {
    const pp = this.getPlayerPos();
    const angle = math.randRange(0, Math.PI * 2);
    const dist = math.randRange(20, 34);
    let x = pp.x + Math.cos(angle) * dist;
    let z = pp.z + Math.sin(angle) * dist;
    let y = pp.y + math.randRange(-8, 6);
    x = math.clamp(x, -ARENA.halfX + 2, ARENA.halfX - 2);
    z = math.clamp(z, -ARENA.halfZ + 2, ARENA.halfZ - 2);
    y = math.clamp(y, ARENA.depthY + 3, ARENA.surfaceY - 1);
    const health = ENEMY.baseHealth + (this.wave - 1) * ENEMY.healthPerWave;
    this.spawn(new THREE.Vector3(x, y, z), health);
  }

  update(dt: number): void {
    if (this.state === 'idle') {
      this.startTimer -= dt;
      if (this.startTimer <= 0) this.beginNextWave();
      return;
    }
    if (this.state === 'active') {
      if (this.toSpawn > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnOne();
          this.toSpawn -= 1;
          this.spawnTimer = 0.7;
        }
      } else if (this.getActive() === 0) {
        this.state = 'cleared';
        this.clearTimer = WAVES.interWaveDelay;
        bus.emit('wave:clear', { wave: this.wave });
      }
      return;
    }
    if (this.state === 'cleared') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.beginNextWave();
    }
  }
}
