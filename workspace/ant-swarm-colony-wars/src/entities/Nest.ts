import { Team, Caste } from './AntTypes';

export interface NestConfig {
  id: number;
  x: number;
  y: number;
  radius?: number;
  team: Team;
  isHQ?: boolean;
  garrison?: number;
  maxGarrison?: number;
  spawnInterval?: number;
}

export class Nest {
  public readonly id: number;
  public x: number;
  public y: number;
  public radius: number;
  public team: Team;
  public isHQ: boolean;

  public garrison: number;
  public maxGarrison: number;
  public spawnTimer = 0;
  public spawnInterval: number; // Seconds between spawns

  // Capture mechanic: -100 (Enemy) to 0 (Neutral) to +100 (Player)
  public captureScore = 0; 
  public pulseTimer = 0;

  // Visual highlight when under attack
  public hitTimer = 0;

  constructor(config: NestConfig) {
    this.id = config.id;
    this.x = config.x;
    this.y = config.y;
    this.radius = config.radius || 46;
    this.team = config.team;
    this.isHQ = config.isHQ ?? false;
    this.maxGarrison = config.maxGarrison || (this.isHQ ? 80 : 40);
    this.garrison = config.garrison ?? (this.team === Team.NEUTRAL ? 15 : 30);
    this.spawnInterval = config.spawnInterval || (this.isHQ ? 0.8 : 1.4);

    if (this.team === Team.PLAYER) {
      this.captureScore = 100;
    } else if (this.team === Team.ENEMY) {
      this.captureScore = -100;
    } else {
      this.captureScore = 0;
    }
  }

  public update(
    dt: number,
    playerPressure: number,
    enemyPressure: number,
    onSpawn: (nest: Nest, caste: Caste, team: Team) => void,
    onCaptured: (nest: Nest, newTeam: Team) => void
  ): void {
    this.pulseTimer += dt * 3;
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
    }

    // Capture & Combat Pressure logic
    const netPressure = playerPressure - enemyPressure;

    if (Math.abs(netPressure) > 0.05) {
      this.hitTimer = 0.2;
      const changeRate = netPressure * 25 * dt;

      // Deplete garrison first if defending
      if (this.team === Team.ENEMY && netPressure > 0 && this.garrison > 0) {
        this.garrison = Math.max(0, this.garrison - netPressure * 15 * dt);
      } else if (this.team === Team.PLAYER && netPressure < 0 && this.garrison > 0) {
        this.garrison = Math.max(0, this.garrison - Math.abs(netPressure) * 15 * dt);
      } else {
        this.captureScore = Math.max(-100, Math.min(100, this.captureScore + changeRate));

        // Check for team conversion
        if (this.captureScore >= 100 && this.team !== Team.PLAYER) {
          this.team = Team.PLAYER;
          this.captureScore = 100;
          this.garrison = 20;
          onCaptured(this, Team.PLAYER);
        } else if (this.captureScore <= -100 && this.team !== Team.ENEMY) {
          this.team = Team.ENEMY;
          this.captureScore = -100;
          this.garrison = 20;
          onCaptured(this, Team.ENEMY);
        }
      }
    } else {
      // Natural recovery towards own team score
      if (this.team === Team.PLAYER && this.captureScore < 100) {
        this.captureScore = Math.min(100, this.captureScore + 10 * dt);
      } else if (this.team === Team.ENEMY && this.captureScore > -100) {
        this.captureScore = Math.max(-100, this.captureScore - 10 * dt);
      }
    }

    // Spawning logic (Only active non-neutral nests produce ants)
    if (this.team !== Team.NEUTRAL) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;

        // Choose caste to spawn
        let caste = Caste.WORKER;
        const rand = Math.random();
        if (this.team === Team.PLAYER) {
          if (rand < 0.5) caste = Caste.WORKER;
          else if (rand < 0.85) caste = Caste.SOLDIER;
          else caste = Caste.BOMBER;
        } else {
          if (rand < 0.4) caste = Caste.WORKER;
          else if (rand < 0.8) caste = Caste.SOLDIER;
          else caste = Caste.BOMBER;
        }

        onSpawn(this, caste, this.team);
      }
    }
  }
}
