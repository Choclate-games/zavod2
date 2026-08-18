export interface PheromoneSample {
  x: number;
  y: number;
  strength: number;
}

export class FlowFieldGrid {
  public readonly cellSize: number;
  public readonly cols: number;
  public readonly rows: number;
  public readonly totalCells: number;
  public readonly worldWidth: number;
  public readonly worldHeight: number;

  public dirX: Float32Array;
  public dirY: Float32Array;
  public intensity: Float32Array;
  public casteMask: Uint8Array; // Bitmask: 1 = Worker, 2 = Soldier, 4 = Bomber, 7 = All

  private readonly EVAPORATION_RATE = 0.12; // 12% decay per second
  private readonly MIN_INTENSITY = 0.05;

  constructor(worldWidth: number, worldHeight: number, cellSize = 32) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;

    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
    this.totalCells = this.cols * this.rows;

    this.dirX = new Float32Array(this.totalCells);
    this.dirY = new Float32Array(this.totalCells);
    this.intensity = new Float32Array(this.totalCells);
    this.casteMask = new Uint8Array(this.totalCells);
  }

  public addStroke(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius = 48,
    targetCasteMask = 7,
    strength = 1.0
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;

    const normX = dx / dist;
    const normY = dy / dist;

    // Interpolate steps along the segment to paint cells
    const steps = Math.max(1, Math.ceil(dist / (this.cellSize * 0.5)));
    const rCells = Math.ceil(radius / this.cellSize);

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const curX = x1 + dx * t;
      const curY = y1 + dy * t;

      const baseC = Math.floor(curX / this.cellSize);
      const baseR = Math.floor(curY / this.cellSize);

      for (let r = baseR - rCells; r <= baseR + rCells; r++) {
        if (r < 0 || r >= this.rows) continue;
        const rowOffset = r * this.cols;

        for (let c = baseC - rCells; c <= baseC + rCells; c++) {
          if (c < 0 || c >= this.cols) continue;

          const cellCenterX = (c + 0.5) * this.cellSize;
          const cellCenterY = (r + 0.5) * this.cellSize;
          const cellDist = Math.hypot(cellCenterX - curX, cellCenterY - curY);

          if (cellDist <= radius) {
            const factor = 1.0 - (cellDist / radius);
            const idx = rowOffset + c;

            // Blend direction with existing vector
            const prevInt = this.intensity[idx];
            const addedInt = strength * factor;
            const newInt = Math.min(1.0, prevInt + addedInt);

            if (newInt > 0) {
              const blendWeight = addedInt / (prevInt + addedInt + 0.001);
              const blendedX = this.dirX[idx] * (1 - blendWeight) + normX * blendWeight;
              const blendedY = this.dirY[idx] * (1 - blendWeight) + normY * blendWeight;
              const bLen = Math.hypot(blendedX, blendedY) || 1;

              this.dirX[idx] = blendedX / bLen;
              this.dirY[idx] = blendedY / bLen;
            } else {
              this.dirX[idx] = normX;
              this.dirY[idx] = normY;
            }

            this.intensity[idx] = newInt;
            this.casteMask[idx] = this.casteMask[idx] | targetCasteMask;
          }
        }
      }
    }
  }

  public update(dt: number): void {
    const decay = 1.0 - (this.EVAPORATION_RATE * dt);

    for (let i = 0; i < this.totalCells; i++) {
      if (this.intensity[i] > 0) {
        this.intensity[i] *= decay;
        if (this.intensity[i] < this.MIN_INTENSITY) {
          this.intensity[i] = 0;
          this.dirX[i] = 0;
          this.dirY[i] = 0;
          this.casteMask[i] = 0;
        }
      }
    }
  }

  public sample(x: number, y: number, caste: number, out: PheromoneSample): boolean {
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) {
      out.x = 0;
      out.y = 0;
      out.strength = 0;
      return false;
    }

    const c = Math.floor(x / this.cellSize);
    const r = Math.floor(y / this.cellSize);
    const idx = r * this.cols + c;

    if (idx < 0 || idx >= this.totalCells) {
      out.x = 0;
      out.y = 0;
      out.strength = 0;
      return false;
    }

    const strength = this.intensity[idx];
    const mask = this.casteMask[idx];
    const casteBit = 1 << caste;

    // Check if this pheromone applies to the ant's caste
    if (strength > 0.05 && (mask & casteBit)) {
      out.x = this.dirX[idx];
      out.y = this.dirY[idx];
      out.strength = strength;
      return true;
    }

    out.x = 0;
    out.y = 0;
    out.strength = 0;
    return false;
  }

  public clear(): void {
    this.dirX.fill(0);
    this.dirY.fill(0);
    this.intensity.fill(0);
    this.casteMask.fill(0);
  }
}
