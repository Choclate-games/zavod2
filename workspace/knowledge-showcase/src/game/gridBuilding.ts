/**
 * Grid & Base Building logic module (pure TS, independent of Three.js)
 * Implements mechanics from knowledge/mechanics/grid_building.md,
 * knowledge/mechanics/base_building.md, and knowledge/patterns/builder_defense_loop.md.
 */

export const CELL_SIZE = 2.0;
export const PYLON_LINK_RADIUS = 8.0;

export type StructureType = 'wall' | 'turret' | 'pylon' | 'generator' | 'core';

export interface StructureDef {
  type: StructureType;
  name: string;
  scrapCost: number;
  energyCost: number;
  energyProduction: number;
  maxHp: number;
  range?: number;
  fireRate?: number; // shots per sec
  damage?: number;
  linkRadius?: number;
  blocksMovement: boolean;
}

export const STRUCTURE_DEFS: Record<StructureType, StructureDef> = {
  core: {
    type: 'core',
    name: 'Command Core',
    scrapCost: 0,
    energyCost: 0,
    energyProduction: 20,
    maxHp: 1000,
    linkRadius: PYLON_LINK_RADIUS,
    blocksMovement: true,
  },
  wall: {
    type: 'wall',
    name: 'Fortified Wall',
    scrapCost: 10,
    energyCost: 0,
    energyProduction: 0,
    maxHp: 250,
    blocksMovement: true,
  },
  turret: {
    type: 'turret',
    name: 'Auto-Ballista',
    scrapCost: 35,
    energyCost: 5,
    energyProduction: 0,
    maxHp: 120,
    range: 10.0,
    fireRate: 1.5,
    damage: 30,
    blocksMovement: true,
  },
  pylon: {
    type: 'pylon',
    name: 'Energy Pylon',
    scrapCost: 15,
    energyCost: 0,
    energyProduction: 0,
    maxHp: 80,
    linkRadius: PYLON_LINK_RADIUS,
    blocksMovement: false,
  },
  generator: {
    type: 'generator',
    name: 'Plasma Generator',
    scrapCost: 45,
    energyCost: 0,
    energyProduction: 30,
    maxHp: 150,
    linkRadius: PYLON_LINK_RADIUS,
    blocksMovement: true,
  },
};

export interface PlacedStructure {
  id: number;
  type: StructureType;
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  hp: number;
  maxHp: number;
  isPowered: boolean;
  targetId: number | null;
  cooldown: number;
}

export function snapToGrid(coord: number, size = CELL_SIZE): number {
  return Math.floor((coord + size / 2) / size) * size;
}

export function worldToGrid(worldCoord: number, size = CELL_SIZE): number {
  return Math.round(worldCoord / size);
}

export function gridToWorld(gridCoord: number, size = CELL_SIZE): number {
  return gridCoord * size;
}

export interface EnemyUnit {
  id: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  targetStructureId: number | null;
  attackCooldown: number;
}

export class BaseBuildingSystem {
  public scrap = 100;
  public totalPowerProduced = 0;
  public totalPowerConsumed = 0;
  public gridMin = -12;
  public gridMax = 12;

  private nextStructureId = 1;
  private structures = new Map<string, PlacedStructure>(); // key: "x,z"
  private idToStructure = new Map<number, PlacedStructure>();

  constructor() {
    // Place Core in the center
    this.placeStructure('core', 0, 0, true);
  }

  public key(gx: number, gz: number): string {
    return `${gx},${gz}`;
  }

  public getStructureAt(gx: number, gz: number): PlacedStructure | undefined {
    return this.structures.get(this.key(gx, gz));
  }

  public getStructureById(id: number): PlacedStructure | undefined {
    return this.idToStructure.get(id);
  }

  public getAllStructures(): PlacedStructure[] {
    return Array.from(this.structures.values());
  }

  public canPlace(type: StructureType, gx: number, gz: number): { ok: boolean; reason?: string } {
    if (gx < this.gridMin || gx > this.gridMax || gz < this.gridMin || gz > this.gridMax) {
      return { ok: false, reason: 'Out of bounds' };
    }

    const existing = this.getStructureAt(gx, gz);
    if (existing) {
      return { ok: false, reason: 'Cell occupied' };
    }

    const def = STRUCTURE_DEFS[type];
    if (this.scrap < def.scrapCost) {
      return { ok: false, reason: 'Not enough scrap' };
    }

    return { ok: true };
  }

  public placeStructure(type: StructureType, gx: number, gz: number, free = false): PlacedStructure | null {
    const check = this.canPlace(type, gx, gz);
    if (!check.ok && !free) return null;

    const def = STRUCTURE_DEFS[type];
    if (!free) {
      this.scrap -= def.scrapCost;
    }

    const s: PlacedStructure = {
      id: this.nextStructureId++,
      type,
      gridX: gx,
      gridZ: gz,
      worldX: gridToWorld(gx),
      worldZ: gridToWorld(gz),
      hp: def.maxHp,
      maxHp: def.maxHp,
      isPowered: false,
      targetId: null,
      cooldown: 0,
    };

    const k = this.key(gx, gz);
    this.structures.set(k, s);
    this.idToStructure.set(s.id, s);

    this.recalculatePowerGrid();
    return s;
  }

  public demolish(gx: number, gz: number): { refunded: number } | null {
    const s = this.getStructureAt(gx, gz);
    if (!s || s.type === 'core') return null;

    const def = STRUCTURE_DEFS[s.type];
    const refund = Math.floor(def.scrapCost * 0.75);
    this.scrap += refund;

    this.structures.delete(this.key(gx, gz));
    this.idToStructure.delete(s.id);

    this.recalculatePowerGrid();
    return { refunded: refund };
  }

  public damageStructure(id: number, amount: number): boolean {
    const s = this.idToStructure.get(id);
    if (!s) return false;
    s.hp -= amount;
    if (s.hp <= 0) {
      this.structures.delete(this.key(s.gridX, s.gridZ));
      this.idToStructure.delete(s.id);
      this.recalculatePowerGrid();
      return true; // destroyed
    }
    return false;
  }

  /**
   * Recalculates power network connectivity and supply via BFS graph traversal.
   */
  public recalculatePowerGrid(): void {
    const all = Array.from(this.structures.values());

    // Reset power flags
    for (const s of all) {
      s.isPowered = false;
    }

    // Identify power sources (Core, Generators)
    let totalGen = 0;
    const powerSources: PlacedStructure[] = [];
    for (const s of all) {
      const def = STRUCTURE_DEFS[s.type];
      if (def.energyProduction > 0) {
        totalGen += def.energyProduction;
        powerSources.push(s);
      }
    }
    this.totalPowerProduced = totalGen;

    // Build adjacency graph for power distribution nodes (generators, pylons, core)
    const powerConductors = all.filter((s) => {
      const def = STRUCTURE_DEFS[s.type];
      return def.energyProduction > 0 || s.type === 'pylon';
    });

    const visitedConductors = new Set<number>();
    const queue: PlacedStructure[] = [];

    for (const src of powerSources) {
      visitedConductors.add(src.id);
      queue.push(src);
      src.isPowered = true;
    }

    // BFS along conductor links
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currRadius = STRUCTURE_DEFS[curr.type].linkRadius || PYLON_LINK_RADIUS;

      for (const other of powerConductors) {
        if (visitedConductors.has(other.id)) continue;
        const dx = curr.worldX - other.worldX;
        const dz = curr.worldZ - other.worldZ;
        const dist = Math.hypot(dx, dz);
        const otherRadius = STRUCTURE_DEFS[other.type].linkRadius || PYLON_LINK_RADIUS;
        const maxDist = Math.max(currRadius, otherRadius);

        if (dist <= maxDist + 0.1) {
          visitedConductors.add(other.id);
          other.isPowered = true;
          queue.push(other);
        }
      }
    }

    // Power consumers (turrets) are powered if within link radius of ANY powered conductor
    let totalCons = 0;
    const activeConductors = Array.from(visitedConductors).map((id) => this.idToStructure.get(id)!).filter(Boolean);

    for (const s of all) {
      const def = STRUCTURE_DEFS[s.type];
      if (def.energyCost > 0) {
        // Turret requires power
        let inRange = false;
        for (const c of activeConductors) {
          const dx = s.worldX - c.worldX;
          const dz = s.worldZ - c.worldZ;
          const dist = Math.hypot(dx, dz);
          const cRadius = STRUCTURE_DEFS[c.type].linkRadius || PYLON_LINK_RADIUS;
          if (dist <= cRadius + 0.1) {
            inRange = true;
            break;
          }
        }

        if (inRange && totalCons + def.energyCost <= totalGen) {
          s.isPowered = true;
          totalCons += def.energyCost;
        } else {
          s.isPowered = false;
        }
      }
    }

    this.totalPowerConsumed = totalCons;
  }

  /**
   * BFS Pathfinding: finds next step from (fromGx, fromGz) towards (toGx, toGz).
   * Walls and structures block unless path is completely blocked.
   */
  public findNextStep(fromGx: number, fromGz: number, toGx: number, toGz: number): { gx: number; gz: number } {
    if (fromGx === toGx && fromGz === toGz) return { gx: fromGx, gz: fromGz };

    const frontier: Array<[number, number]> = [[fromGx, fromGz]];
    const cameFrom = new Map<string, string>();
    const startKey = this.key(fromGx, fromGz);
    cameFrom.set(startKey, '');

    let foundTarget = false;
    const targetKey = this.key(toGx, toGz);

    const DIRS = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
    ];

    while (frontier.length > 0) {
      const [cx, cz] = frontier.shift()!;
      const cKey = this.key(cx, cz);

      if (cKey === targetKey) {
        foundTarget = true;
        break;
      }

      for (const [dx, dz] of DIRS) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < this.gridMin || nx > this.gridMax || nz < this.gridMin || nz > this.gridMax) continue;

        const nKey = this.key(nx, nz);
        if (cameFrom.has(nKey)) continue;

        const s = this.getStructureAt(nx, nz);
        if (s && s.type !== 'core' && STRUCTURE_DEFS[s.type].blocksMovement) {
          continue;
        }

        cameFrom.set(nKey, cKey);
        frontier.push([nx, nz]);
      }
    }

    if (!foundTarget) {
      const signX = Math.sign(toGx - fromGx);
      const signZ = Math.sign(toGz - fromGz);
      if (Math.abs(toGx - fromGx) >= Math.abs(toGz - fromGz)) {
        return { gx: fromGx + signX, gz: fromGz };
      } else {
        return { gx: fromGx, gz: fromGz + signZ };
      }
    }

    let curr = targetKey;
    while (cameFrom.get(curr) && cameFrom.get(curr) !== startKey) {
      curr = cameFrom.get(curr)!;
    }

    const [rx, rz] = curr.split(',').map(Number);
    return { gx: rx, gz: rz };
  }
}
