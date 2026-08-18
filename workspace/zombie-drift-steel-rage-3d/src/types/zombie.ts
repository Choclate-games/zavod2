export type ZombieType = 'WALKER' | 'RUNNER' | 'SPITTER' | 'TANK' | 'BOSS_GOLIATH';

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
