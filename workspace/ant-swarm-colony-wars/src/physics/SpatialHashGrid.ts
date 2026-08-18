export class SpatialHashGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private worldWidth: number;
  private worldHeight: number;

  // Pre-allocated flat bucket arrays to avoid GC
  private head: Int32Array; // Head index for each cell linked list (-1 if empty)
  private next: Int32Array; // Next index for each entity (-1 if end of list)
  private cellCounts: Int32Array; // Count of entities in each cell

  // Query result buffer
  public queryBuffer: Int32Array;
  public queryCount = 0;

  constructor(worldWidth: number, worldHeight: number, cellSize = 64, maxEntities = 2000) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;

    this.cols = Math.ceil(worldWidth / cellSize) + 1;
    this.rows = Math.ceil(worldHeight / cellSize) + 1;

    const totalCells = this.cols * this.rows;
    this.head = new Int32Array(totalCells);
    this.next = new Int32Array(maxEntities);
    this.cellCounts = new Int32Array(totalCells);
    this.queryBuffer = new Int32Array(maxEntities);

    this.clear();
  }

  public clear(): void {
    this.head.fill(-1);
    this.cellCounts.fill(0);
  }

  public insert(entityIndex: number, x: number, y: number): void {
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) {
      return;
    }

    const c = Math.floor(x / this.cellSize);
    const r = Math.floor(y / this.cellSize);
    const cellIdx = r * this.cols + c;

    if (cellIdx >= 0 && cellIdx < this.head.length && entityIndex < this.next.length) {
      this.next[entityIndex] = this.head[cellIdx];
      this.head[cellIdx] = entityIndex;
      this.cellCounts[cellIdx]++;
    }
  }

  public query(x: number, y: number, radius: number): number {
    this.queryCount = 0;
    const minC = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxC = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minR = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxR = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));

    for (let r = minR; r <= maxR; r++) {
      const rowOffset = r * this.cols;
      for (let c = minC; c <= maxC; c++) {
        const cellIdx = rowOffset + c;
        let curr = this.head[cellIdx];

        while (curr !== -1) {
          if (this.queryCount < this.queryBuffer.length) {
            this.queryBuffer[this.queryCount++] = curr;
          }
          curr = this.next[curr];
        }
      }
    }

    return this.queryCount;
  }
}
