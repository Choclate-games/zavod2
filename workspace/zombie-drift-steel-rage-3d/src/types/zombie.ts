export type BossType =
  | 'BOSS_GOLIATH'
  | 'BOSS_SAND_TITAN'
  | 'BOSS_IRON_BUTCHER'
  | 'BOSS_TOXIC_BEHEMOTH'
  | 'BOSS_INFERNO_TITAN'
  | 'BOSS_CYBER_REAPER'
  | 'BOSS_STORM_BRINGER'
  | 'BOSS_CRIMSON_REAPER'
  | 'BOSS_RADIOACTIVE_COLOSSUS'
  | 'BOSS_ASHEN_OVERLORD'
  | 'BOSS_APOCALYPSE_LORD';

export type ZombieType = 'WALKER' | 'RUNNER' | 'SPITTER' | 'TANK' | BossType;

export type ZombieState = 'SPAWNING' | 'CHASING' | 'ATTACKING' | 'STAGGERED' | 'DEAD';

export interface ZombieConfig {
  type: ZombieType;
  nameRu: string;
  maxHealth: number;
  speed: number;
  turnSpeed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  mass: number;
  scrapDropMin: number;
  scrapDropMax: number;
  xpValue: number;
  scale: number;
  color: number;
  accentColor: number;
}
