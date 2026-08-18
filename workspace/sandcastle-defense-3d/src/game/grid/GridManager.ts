import { FlowFieldSolver } from '../ai/FlowFieldSolver.ts';
import { Tower } from '../entities/Tower.ts';

export const CELL_SIZE = 1.2;

export enum CellType {
  EMPTY = 0,
  OBSTACLE = 1,
  TOWER = 2,
  CASTLE = 3,
  SPAWNER = 4,
}

export class GridManager {
  public readonly width: number;
  public readonly height: number;
  public readonly grid: Uint8Array;
  public readonly towers: Map<number, Tower> = new Map();
  public readonly targetIndices: number[] = [];
  public readonly spawnerIndices: number[] = [];

  public flowSolver: FlowFieldSolver;

  constructor(width: number = 24, height: number = 16) {
    this.width = width;
    this.height = height;
    this.grid = new Uint8Array(width * height);
    this.flowSolver = new FlowFieldSolver(width, height);
  }

  public getIndex(x: number, z: number): number {
    return z * this.width + x;
  }

  public isInBounds(x: number, z: number): boolean {
    return x >= 0 && x < this.width && z >= 0 && z < this.height;
  }

  public cellToWorld(cx: number, cz: number): { x: number; y: number; z: number } {
    return {
      x: (cx - this.width / 2 + 0.5) * CELL_SIZE,
      y: 0,
      z: (cz - this.height / 2 + 0.5) * CELL_SIZE,
    };
  }

  public worldToCell(wx: number, wz: number): { x: number; z: number } {
    const cx = Math.floor(wx / CELL_SIZE + this.width / 2);
    const cz = Math.floor(wz / CELL_SIZE + this.height / 2);
    return { x: cx, z: cz };
  }

  public loadLevel(
    obstacles: Array<{ x: number; z: number }>,
    spawners: Array<{ x: number; z: number }>,
    castles: Array<{ x: number; z: number }>
  ): void {
    this.grid.fill(CellType.EMPTY);
    this.towers.clear();
    this.targetIndices.length = 0;
    this.spawnerIndices.length = 0;

    for (const obs of obstacles) {
      if (this.isInBounds(obs.x, obs.z)) {
        this.grid[this.getIndex(obs.x, obs.z)] = CellType.OBSTACLE;
      }
    }

    for (const sp of spawners) {
      if (this.isInBounds(sp.x, sp.z)) {
        const idx = this.getIndex(sp.x, sp.z);
        this.grid[idx] = CellType.SPAWNER;
        this.spawnerIndices.push(idx);
      }
    }

    for (const c of castles) {
      if (this.isInBounds(c.x, c.z)) {
        const idx = this.getIndex(c.x, c.z);
        this.grid[idx] = CellType.CASTLE;
        this.targetIndices.push(idx);
      }
    }

    this.recalculateFlowField();
  }

  public recalculateFlowField(): boolean {
    return this.flowSolver.compute(this.grid, this.targetIndices);
  }

  public canBuildAt(
    cx: number,
    cz: number,
    activeEnemyPositions?: Array<{ x: number; z: number }>
  ): boolean {
    if (!this.isInBounds(cx, cz)) return false;
    const idx = this.getIndex(cx, cz);
    if (this.grid[idx] !== CellType.EMPTY) return false;

    // Convert active enemy world coords to cell grid coords for path validation
    const enemyCellPositions = activeEnemyPositions?.map((pos) => {
      const cell = this.worldToCell(pos.x, pos.z);
      return { x: cell.x, z: cell.z };
    });

    // Test with flowSolver to ensure no spawn or mob is trapped
    const isValid = this.flowSolver.validateNoBlockage(
      this.grid,
      this.targetIndices,
      this.spawnerIndices,
      cx,
      cz,
      enemyCellPositions
    );

    // Recompute active field back to current state
    this.recalculateFlowField();
    return isValid;
  }

  public buildTower(cx: number, cz: number, tower: Tower): boolean {
    if (!this.isInBounds(cx, cz)) return false;
    const idx = this.getIndex(cx, cz);
    this.grid[idx] = CellType.TOWER;
    this.towers.set(idx, tower);
    this.recalculateFlowField();
    return true;
  }

  public removeTower(cx: number, cz: number): Tower | null {
    if (!this.isInBounds(cx, cz)) return null;
    const idx = this.getIndex(cx, cz);
    const tower = this.towers.get(idx) || null;
    if (tower) {
      this.towers.delete(idx);
      this.grid[idx] = CellType.EMPTY;
      this.recalculateFlowField();
    }
    return tower;
  }

  public getTowerAt(cx: number, cz: number): Tower | null {
    if (!this.isInBounds(cx, cz)) return null;
    return this.towers.get(this.getIndex(cx, cz)) || null;
  }
}
