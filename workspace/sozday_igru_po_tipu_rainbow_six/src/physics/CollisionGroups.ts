export const makeGroups = (membership: number, filter: number): number => (membership << 16) | (filter & 0xffff);

export const G_STATIC      = 0x0001; // Environment walls, floor, desks
export const G_PLAYER      = 0x0002; // Player body
export const G_SHIELD      = 0x0004; // Ballistic shield front
export const G_ENEMY       = 0x0008; // Enemy body
export const G_ENEMY_HEAD  = 0x0010; // Enemy head hitbox
export const G_BREACH_WALL = 0x0020; // Destructible wall section
export const G_DEBRIS      = 0x0040; // Physical debris chunks
export const G_BULLET      = 0x0080; // Bullets raycast
export const G_TRIGGER     = 0x0100; // Tripwire / bomb sensor

export const STATIC_GROUPS = makeGroups(
  G_STATIC,
  G_PLAYER | G_ENEMY | G_DEBRIS | G_BULLET
);

export const PLAYER_GROUPS = makeGroups(
  G_PLAYER,
  G_STATIC | G_ENEMY | G_DEBRIS | G_TRIGGER | G_BULLET
);

export const SHIELD_GROUPS = makeGroups(
  G_SHIELD,
  G_STATIC | G_BULLET | G_DEBRIS
);

export const ENEMY_GROUPS = makeGroups(
  G_ENEMY,
  G_STATIC | G_PLAYER | G_BULLET | G_DEBRIS
);

export const ENEMY_HEAD_GROUPS = makeGroups(
  G_ENEMY_HEAD,
  G_BULLET
);

export const BREACH_WALL_GROUPS = makeGroups(
  G_BREACH_WALL,
  G_PLAYER | G_ENEMY | G_BULLET
);

export const DEBRIS_GROUPS = makeGroups(
  G_DEBRIS,
  G_STATIC | G_PLAYER | G_ENEMY | G_DEBRIS | G_SHIELD
);

export const BULLET_PLAYER_GROUPS = makeGroups(
  G_BULLET,
  G_STATIC | G_ENEMY | G_ENEMY_HEAD | G_BREACH_WALL | G_TRIGGER
);

export const BULLET_ENEMY_GROUPS = makeGroups(
  G_BULLET,
  G_STATIC | G_PLAYER | G_SHIELD | G_BREACH_WALL
);
