import { EnemyPool } from '../entities/EnemyPool';
import { EnemyType } from '../core/Types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CombatSystem } from './CombatSystem';
import { ExplosiveBarrel, BreachDoor } from '../entities/Props';
import { EventBus } from '../core/EventBus';

export class WaveManager {
  private enemyPool: EnemyPool;
  private physicsWorld: PhysicsWorld;
  private combatSystem: CombatSystem;
  private eventBus: EventBus;

  public currentSector: number = 1;
  public readonly maxSectors: number = 12;

  public isWaveActive: boolean = false;
  public enemiesRemainingInSector: number = 0;
  private spawnQueue: EnemyType[] = [];
  private spawnTimer: number = 0;
  public isBossFight: boolean = false;

  constructor(
    enemyPool: EnemyPool,
    physicsWorld: PhysicsWorld,
    combatSystem: CombatSystem
  ) {
    this.enemyPool = enemyPool;
    this.physicsWorld = physicsWorld;
    this.combatSystem = combatSystem;
    this.eventBus = EventBus.getInstance();
  }

  public startSector(sector: number): void {
    this.currentSector = sector;
    this.isWaveActive = true;
    this.isBossFight = sector === this.maxSectors;

    // Clear previous entities
    this.enemyPool.clear();
    this.combatSystem.barrels = [];
    this.combatSystem.doors = [];

    // 1. Setup Room Props & Arena Bounds
    this.setupRoomEnvironment(sector);

    // 2. Build Enemy Spawn Schedule
    this.buildSpawnSchedule(sector);
  }

  private setupRoomEnvironment(sector: number): void {
    // Arena bounds
    this.physicsWorld.setArenaBounds({
      minX: -14,
      maxX: 14,
      minZ: -16,
      maxZ: 16
    });

    // Spawn Breach Door at the entrance
    const door = new BreachDoor('entry_door', 0, 14);
    this.combatSystem.doors.push(door);
    this.physicsWorld.addBody(door.rigidBody);

    // Spawn Explosive Barrels strategically
    const barrelCount = Math.min(6, 2 + Math.floor(sector * 0.4));
    for (let i = 0; i < barrelCount; i++) {
      const bx = (Math.random() - 0.5) * 20;
      const bz = -10 + Math.random() * 16;
      const barrel = new ExplosiveBarrel(`barrel_${i}`, bx, bz);
      this.combatSystem.barrels.push(barrel);
      this.physicsWorld.addBody(barrel.rigidBody);
    }
  }

  private buildSpawnSchedule(sector: number): void {
    this.spawnQueue = [];
    const multiplier = 1.0 + (sector - 1) * 0.15;

    if (sector === this.maxSectors) {
      // Final Boss Fight!
      this.spawnQueue.push(EnemyType.BOSS_COLOSSUS);
      // Minions escort
      this.spawnQueue.push(EnemyType.SHIELD_SOLDIER);
      this.spawnQueue.push(EnemyType.BERSERKER);
      this.spawnQueue.push(EnemyType.SNIPER);
    } else if (sector >= 8) {
      // Kinetic storm: High density mix
      const count = 8 + sector;
      for (let i = 0; i < count; i++) {
        const rand = Math.random();
        if (rand < 0.35) this.spawnQueue.push(EnemyType.SHIELD_SOLDIER);
        else if (rand < 0.65) this.spawnQueue.push(EnemyType.BERSERKER);
        else if (rand < 0.85) this.spawnQueue.push(EnemyType.SNIPER);
        else this.spawnQueue.push(EnemyType.GRUNT);
      }
    } else if (sector >= 4) {
      // Mid sectors: Shield soldiers & Berserkers
      const count = 6 + sector;
      for (let i = 0; i < count; i++) {
        const rand = Math.random();
        if (rand < 0.4) this.spawnQueue.push(EnemyType.SHIELD_SOLDIER);
        else if (rand < 0.7) this.spawnQueue.push(EnemyType.BERSERKER);
        else this.spawnQueue.push(EnemyType.GRUNT);
      }
    } else {
      // Early sectors: Grunts and occasional shield
      const count = 4 + sector * 2;
      for (let i = 0; i < count; i++) {
        this.spawnQueue.push(i % 3 === 0 && sector > 1 ? EnemyType.SHIELD_SOLDIER : EnemyType.GRUNT);
      }
    }

    this.enemiesRemainingInSector = this.spawnQueue.length;
  }

  public update(dt: number): void {
    if (!this.isWaveActive) return;

    // Spawn Enemies with pacing
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const type = this.spawnQueue.shift()!;
        const spawnX = (Math.random() - 0.5) * 18;
        const spawnZ = -12 + (Math.random() - 0.5) * 6;
        const sectorMult = 1.0 + (this.currentSector - 1) * 0.12;

        this.enemyPool.spawn(type, spawnX, spawnZ, sectorMult);
        this.spawnTimer = 0.8;
      }
    }

    // Check Sector Cleared condition
    const activeEnemies = this.enemyPool.getActiveEnemies();
    if (this.spawnQueue.length === 0 && activeEnemies.length === 0 && this.isWaveActive) {
      this.isWaveActive = false;
      this.onSectorCompleted();
    }
  }

  private onSectorCompleted(): void {
    if (this.currentSector >= this.maxSectors) {
      // Victory!
      this.eventBus.emit('game:victory');
    } else {
      // Trigger 3-Card Tactical Bio-chip selection
      this.eventBus.emit('game:sectorClear', this.currentSector);
    }
  }
}
