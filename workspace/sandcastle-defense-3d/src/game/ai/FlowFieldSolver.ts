export class FlowFieldSolver {
  public readonly width: number;
  public readonly height: number;
  public readonly size: number;

  // Pre-allocated typed arrays (Zero GC)
  public costField: Uint16Array;
  public flowX: Float32Array;
  public flowZ: Float32Array;

  // Reusable BFS queue
  private queue: Int32Array;
  private queueHead: number = 0;
  private queueTail: number = 0;

  // 4-way cardinal offsets
  private static readonly DX4 = [0, 1, 0, -1];
  private static readonly DZ4 = [-1, 0, 1, 0];

  // 8-way offsets (for smooth flow vectors)
  private static readonly DX8 = [0, 1, 1, 1, 0, -1, -1, -1];
  private static readonly DZ8 = [-1, -1, 0, 1, 1, 1, 0, -1];
  private static readonly DIST8 = [1.0, 1.414, 1.0, 1.414, 1.0, 1.414, 1.0, 1.414];

  constructor(width: number = 24, height: number = 16) {
    this.width = width;
    this.height = height;
    this.size = width * height;

    this.costField = new Uint16Array(this.size);
    this.flowX = new Float32Array(this.size);
    this.flowZ = new Float32Array(this.size);
    this.queue = new Int32Array(this.size);
  }

  public getIndex(x: number, z: number): number {
    return z * this.width + x;
  }

  public isInBounds(x: number, z: number): boolean {
    return x >= 0 && x < this.width && z >= 0 && z < this.height;
  }

  /**
   * Recalculates Dijkstra Integration Field and Flow Field vectors towards target castle cells.
   * @param grid Array of cell types: 0=walkable, >0=blocked (unless target/spawner)
   * @param targetIndices Array of castle cell indices (cost = 0)
   */
  public compute(grid: Uint8Array, targetIndices: number[]): boolean {
    // 1. Reset costs to max (65535)
    this.costField.fill(65535);
    this.flowX.fill(0);
    this.flowZ.fill(0);

    this.queueHead = 0;
    this.queueTail = 0;

    // 2. Push all target cells (castle) into BFS queue
    for (let i = 0; i < targetIndices.length; i++) {
      const idx = targetIndices[i];
      if (idx >= 0 && idx < this.size) {
        this.costField[idx] = 0;
        this.queue[this.queueTail++] = idx;
      }
    }

    if (this.queueTail === 0) {
      return false;
    }

    // 3. BFS expansion (Dijkstra wave)
    while (this.queueHead < this.queueTail) {
      const currIdx = this.queue[this.queueHead++];
      const cx = currIdx % this.width;
      const cz = Math.floor(currIdx / this.width);
      const currCost = this.costField[currIdx];

      for (let i = 0; i < 4; i++) {
        const nx = cx + FlowFieldSolver.DX4[i];
        const nz = cz + FlowFieldSolver.DZ4[i];

        if (nx >= 0 && nx < this.width && nz >= 0 && nz < this.height) {
          const nIdx = nz * this.width + nx;
          // Walkable if grid is 0 or castle/spawner (or custom walkable check)
          const isWalkable = grid[nIdx] === 0 || grid[nIdx] === 3 || grid[nIdx] === 4;

          if (isWalkable && this.costField[nIdx] === 65535) {
            this.costField[nIdx] = currCost + 1;
            this.queue[this.queueTail++] = nIdx;
          }
        }
      }
    }

    // 4. Compute 8-direction flow gradients for every walkable cell
    for (let z = 0; z < this.height; z++) {
      for (let x = 0; x < this.width; x++) {
        const idx = z * this.width + x;
        const currentCost = this.costField[idx];

        if (currentCost === 0 || currentCost === 65535) {
          this.flowX[idx] = 0;
          this.flowZ[idx] = 0;
          continue;
        }

        let bestCost = currentCost;
        let bestDirX = 0;
        let bestDirZ = 0;

        for (let i = 0; i < 8; i++) {
          const nx = x + FlowFieldSolver.DX8[i];
          const nz = z + FlowFieldSolver.DZ8[i];

          if (nx >= 0 && nx < this.width && nz >= 0 && nz < this.height) {
            const nIdx = nz * this.width + nx;
            const nCost = this.costField[nIdx];

            if (nCost < bestCost) {
              // Diagonal corner-cutting check
              const isDiagonal = (i % 2 === 1);
              if (isDiagonal) {
                const adj1 = grid[z * this.width + nx];
                const adj2 = grid[nz * this.width + x];
                if ((adj1 === 1 || adj1 === 2) && (adj2 === 1 || adj2 === 2)) {
                  // Both adjacent tiles are walls - do not cut corner
                  continue;
                }
              }

              // Effective cost with Euclidean weight
              const weightedCost = nCost + (FlowFieldSolver.DIST8[i] - 1.0);
              if (weightedCost < bestCost) {
                bestCost = weightedCost;
                bestDirX = FlowFieldSolver.DX8[i];
                bestDirZ = FlowFieldSolver.DZ8[i];
              }
            }
          }
        }

        if (bestDirX !== 0 || bestDirZ !== 0) {
          const len = Math.hypot(bestDirX, bestDirZ);
          this.flowX[idx] = bestDirX / len;
          this.flowZ[idx] = bestDirZ / len;
        } else {
          this.flowX[idx] = 0;
          this.flowZ[idx] = 0;
        }
      }
    }

    return true;
  }

  /**
   * Sample flow direction at world continuous coordinates with bilinear or nearest lookup.
   */
  public getFlowVector(worldX: number, worldZ: number, out: { x: number; z: number }): void {
    const cx = Math.floor(worldX);
    const cz = Math.floor(worldZ);

    if (cx < 0 || cx >= this.width || cz < 0 || cz >= this.height) {
      out.x = 0;
      out.z = 0;
      return;
    }

    const idx = cz * this.width + cx;
    out.x = this.flowX[idx];
    out.z = this.flowZ[idx];
  }

  /**
   * Test whether all spawners and test points can reach target castle if a block is added at (testCellX, testCellZ).
   */
  public validateNoBlockage(
    grid: Uint8Array,
    targetIndices: number[],
    spawnerIndices: number[],
    testCellX: number,
    testCellZ: number,
    activeEnemyPositions?: Array<{ x: number; z: number }>
  ): boolean {
    const testIdx = testCellZ * this.width + testCellX;
    const oldVal = grid[testIdx];
    grid[testIdx] = 2; // Simulate tower

    const success = this.compute(grid, targetIndices);
    grid[testIdx] = oldVal; // Revert immediately

    if (!success) return false;

    // Check all spawners
    for (let i = 0; i < spawnerIndices.length; i++) {
      const spIdx = spawnerIndices[i];
      if (this.costField[spIdx] === 65535) {
        return false; // Spawner isolated!
      }
    }

    // Check active ground enemies
    if (activeEnemyPositions) {
      for (let i = 0; i < activeEnemyPositions.length; i++) {
        const ex = Math.floor(activeEnemyPositions[i].x);
        const ez = Math.floor(activeEnemyPositions[i].z);
        if (this.isInBounds(ex, ez)) {
          const eIdx = ez * this.width + ex;
          if (this.costField[eIdx] === 65535) {
            return false; // Active mob would be trapped!
          }
        }
      }
    }

    return true;
  }
}
