export const CollisionCategory = {
  NONE: 0x0000,
  PLAYER_DRILL: 0x0001,
  TERRAIN_BLOCK: 0x0002,
  ENEMY: 0x0004,
  PLAYER_PROJECTILE: 0x0008,
  ENEMY_PROJECTILE: 0x0010,
  DROP_ITEM: 0x0020,
  SHIELD_AURA: 0x0040,
  EXPLOSION: 0x0080,
} as const;

export type CollisionCategoryType = typeof CollisionCategory[keyof typeof CollisionCategory];
