export enum ObstacleType {
  CHASM = 'chasm',
  RIVER = 'river',
  DESTRUCTIBLE_WALL = 'destructible_wall',
  THORNS = 'thorns'
}

export interface ObstacleConfig {
  id: number;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  hp?: number;
  maxHp?: number;
}

export class Obstacle {
  public readonly id: number;
  public readonly type: ObstacleType;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public rotation: number;

  public hp: number;
  public maxHp: number;
  public isDestroyed = false;

  // Bridge connection state (if bridged, ants can cross freely!)
  public isBridged = false;
  public bridgeHealth = 0;
  public bridgeMaxHealth = 100;

  constructor(config: ObstacleConfig) {
    this.id = config.id;
    this.type = config.type;
    this.x = config.x;
    this.y = config.y;
    this.width = config.width;
    this.height = config.height;
    this.rotation = config.rotation || 0;

    this.maxHp = config.maxHp || (this.type === ObstacleType.DESTRUCTIBLE_WALL ? 300 : 100);
    this.hp = config.hp ?? this.maxHp;
  }

  public takeDamage(amount: number): boolean {
    if (this.isDestroyed || this.type !== ObstacleType.DESTRUCTIBLE_WALL) return false;

    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.isDestroyed = true;
      return true; // Just destroyed
    }
    return false;
  }

  public containsPoint(px: number, py: number): boolean {
    if (this.isDestroyed) return false;

    // Check AABB bounding box (with optional center offset)
    const left = this.x - this.width / 2;
    const right = this.x + this.width / 2;
    const top = this.y - this.height / 2;
    const bottom = this.y + this.height / 2;

    return px >= left && px <= right && py >= top && py <= bottom;
  }

  public intersectsCircle(cx: number, cy: number, radius: number): boolean {
    if (this.isDestroyed) return false;

    const left = this.x - this.width / 2;
    const right = this.x + this.width / 2;
    const top = this.y - this.height / 2;
    const bottom = this.y + this.height / 2;

    const closestX = Math.max(left, Math.min(cx, right));
    const closestY = Math.max(top, Math.min(cy, bottom));

    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < radius * radius;
  }
}
