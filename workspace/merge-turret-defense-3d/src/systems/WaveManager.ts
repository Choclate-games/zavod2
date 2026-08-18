import { BASE_HP, enemyHp, waveTargetCount } from '../game/config';
import type { EventBus } from '../core/EventBus';
import type { EnemyState, SaveData } from '../game/types';

const MAX_ENEMIES = 80;

export class WaveManager {
  private readonly enemies: EnemyState[] = [];
  private spawnTimer = 0;
  private spawned = 0;
  private target = 0;
  private nextEnemyId = 1;
  private baseHp = BASE_HP;

  constructor(private readonly bus: EventBus, private readonly save: SaveData) {
    this.startWave(save.currentWave);
  }

  get activeEnemies(): readonly EnemyState[] {
    return this.enemies;
  }

  get hp(): number {
    return this.baseHp;
  }

  get wave(): number {
    return this.save.currentWave;
  }

  update(dt: number): void {
    if (this.baseHp <= 0) return;
    this.spawnTimer -= dt;
    if (this.spawned < this.target && this.spawnTimer <= 0) {
      this.spawnEnemy(this.save.currentWave % 5 === 0 && this.spawned === this.target - 1 ? 3 : 2);
      this.spawnTimer = Math.max(0.42, 1.08 - this.save.currentWave * 0.018);
    }

    let alive = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.progress += enemy.speed * dt;
      if (enemy.progress >= 1) {
        enemy.alive = false;
        this.baseHp = Math.max(0, this.baseHp - enemy.size * 5);
        this.bus.emit('base:damaged', { hp: this.baseHp });
      } else {
        alive += 1;
      }
    }

    if (this.baseHp <= 0) {
      this.bus.emit('state:changed', { state: 'defeat' });
    } else if (this.spawned >= this.target && alive === 0) {
      const reward = Math.round(60 * Math.pow(1.16, this.save.currentWave));
      this.save.coins += reward;
      this.bus.emit('wave:cleared', { wave: this.save.currentWave, reward });
      this.startWave(this.save.currentWave + 1);
    }

    this.emitChanged(alive);
  }

  damage(enemyId: number, damage: number): boolean {
    const enemy = this.enemies.find((item) => item.id === enemyId && item.alive);
    if (!enemy) return false;
    enemy.hp -= damage;
    if (enemy.hp > 0) return true;
    enemy.alive = false;
    this.save.coins += enemy.reward;
    this.bus.emit('enemy:killed', { enemyId, coins: enemy.reward });
    if (enemy.size > 1) {
      this.spawnSplit(enemy);
      this.spawnSplit(enemy);
    }
    return true;
  }

  selectEnemy(enemyId: number | null): void {
    for (const enemy of this.enemies) enemy.selected = enemy.alive && enemy.id === enemyId;
  }

  findTarget(): EnemyState | null {
    let selected: EnemyState | null = null;
    let first: EnemyState | null = null;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.selected) selected = enemy;
      if (first === null || enemy.progress > first.progress) first = enemy;
    }
    return selected ?? first;
  }

  revive(): void {
    this.baseHp = BASE_HP;
    for (const enemy of this.enemies) enemy.alive = false;
    this.startWave(this.save.currentWave);
    this.bus.emit('state:changed', { state: 'playing' });
  }

  private startWave(wave: number): void {
    this.save.currentWave = wave;
    this.target = waveTargetCount(wave);
    this.spawned = 0;
    this.spawnTimer = 0.25;
    this.enemies.length = 0;
    this.baseHp = BASE_HP;
    this.emitChanged(0);
  }

  private spawnEnemy(size: 1 | 2 | 3): void {
    if (this.enemies.length >= MAX_ENEMIES) return;
    const hp = enemyHp(this.save.currentWave, size);
    this.enemies.push({
      id: this.nextEnemyId,
      alive: true,
      hp,
      maxHp: hp,
      size,
      progress: 0,
      speed: (0.036 + this.save.currentWave * 0.0018) / size,
      reward: Math.round(7 * size * (1 + this.save.upgrades.income * 0.12)),
      selected: false
    });
    this.nextEnemyId += 1;
    this.spawned += 1;
  }

  private spawnSplit(parent: EnemyState): void {
    if (this.enemies.length >= MAX_ENEMIES || parent.size <= 1) return;
    const size = (parent.size - 1) as 1 | 2;
    const hp = Math.max(1, Math.round(parent.maxHp * 0.42));
    this.enemies.push({
      id: this.nextEnemyId,
      alive: true,
      hp,
      maxHp: hp,
      size,
      progress: Math.max(0, parent.progress - 0.015),
      speed: parent.speed * 1.45,
      reward: Math.max(1, Math.round(parent.reward * 0.45)),
      selected: false
    });
    this.nextEnemyId += 1;
  }

  private emitChanged(alive: number): void {
    this.bus.emit('wave:changed', {
      wave: this.save.currentWave,
      alive,
      spawned: this.spawned,
      target: this.target,
      baseHp: this.baseHp
    });
  }
}
