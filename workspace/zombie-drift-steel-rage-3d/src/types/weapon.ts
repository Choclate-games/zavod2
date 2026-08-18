export type WeaponType = 
  | 'ROOF_MINIGUN'
  | 'SIDE_BUZZSAWS'
  | 'FLAMETHROWER'
  | 'SHOCK_RING'
  | 'MORTAR_LAUNCHER'
  | 'SPIKE_BUMPER'
  | 'NITRO_JET';

export interface WeaponConfig {
  type: WeaponType;
  nameRu: string;
  descriptionRu: string;
  level: number;
  maxLevel: number;
  damage: number;
  cooldown: number;
  range: number;
  projectileSpeed?: number;
  areaRadius?: number;
}
