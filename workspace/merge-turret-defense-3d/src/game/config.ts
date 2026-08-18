export const GAME_TITLE = 'Слияние Турелей 3D: Оборона Базы';
export const GRID_SIZE = 4;
export const SLOT_COUNT = GRID_SIZE * GRID_SIZE;
export const MAX_TIER = 15;
export const BASE_TURRET_COST = 25;
export const BASE_HP = 100;
export const SAVE_KEY = 'turrets_grid_slots';

export function turretDamage(tier: number): number {
  return Math.round(5 * Math.pow(1.42, tier - 1));
}

export function turretFireRate(tier: number): number {
  return 0.72 + Math.min(2.2, tier * 0.085);
}

export function buyCost(purchases: number): number {
  return Math.round(BASE_TURRET_COST * Math.pow(1.15, purchases));
}

export function upgradeCost(level: number): number {
  return Math.round(80 * Math.pow(1.55, level));
}

export function enemyHp(wave: number, size: number): number {
  return Math.round(35 * size * Math.pow(1.18, Math.max(0, wave - 1)));
}

export function waveTargetCount(wave: number): number {
  return Math.min(30, 14 + Math.floor(wave * 1.35));
}
