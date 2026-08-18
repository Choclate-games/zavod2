export enum Caste {
  WORKER = 0,
  SOLDIER = 1,
  BOMBER = 2,
  TITAN = 3
}

export enum Team {
  PLAYER = 0,
  ENEMY = 1,
  NEUTRAL = 2
}

export enum AntState {
  FREE = 0,
  IN_STRUCTURE = 1,
  IN_SPHERE = 2,
  ATTACKING = 3,
  HARVESTING = 4,
  DEAD = 5
}

export interface CasteStats {
  speed: number;
  health: number;
  attack: number;
  armor: number; // Damage reduction 0.0 - 1.0
  explosionRadius: number;
  color: number;
  scale: number;
  buildPower: number;
}

export const CASTE_BASE_STATS: Record<Caste, CasteStats> = {
  [Caste.WORKER]: {
    speed: 180,
    health: 40,
    attack: 6,
    armor: 0.0,
    explosionRadius: 0,
    color: 0x39ff14,
    scale: 0.9,
    buildPower: 2.0
  },
  [Caste.SOLDIER]: {
    speed: 145,
    health: 110,
    attack: 26,
    armor: 0.35,
    explosionRadius: 0,
    color: 0xff3355,
    scale: 1.25,
    buildPower: 0.5
  },
  [Caste.BOMBER]: {
    speed: 155,
    health: 35,
    attack: 160,
    armor: 0.0,
    explosionRadius: 85,
    color: 0xffaa00,
    scale: 1.1,
    buildPower: 0.2
  },
  [Caste.TITAN]: {
    speed: 115,
    health: 600,
    attack: 85,
    armor: 0.6,
    explosionRadius: 130,
    color: 0x00e5ff,
    scale: 2.2,
    buildPower: 3.0
  }
};
