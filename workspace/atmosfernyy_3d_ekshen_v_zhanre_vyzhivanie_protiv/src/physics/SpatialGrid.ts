/**
 * Равномерная сетка для соседских запросов орды: разделение роя, радиусы
 * детонаций и парового кольца ищутся по ячейкам, а не полным перебором.
 * Все буферы выделяются один раз, в кадре аллокаций нет.
 */
export class SpatialGrid {
  private readonly cells: Int32Array
  private readonly cellCounts: Int32Array
  private readonly cols: number
  private readonly cellSize: number

  constructor(
    private readonly extent: number,
    resolution: number,
    private readonly capacity: number,
  ) {
    this.cellSize = (extent * 2) / resolution
    this.cols = resolution
    this.cells = new Int32Array(resolution * resolution * capacity)
    this.cellCounts = new Int32Array(resolution * resolution)
  }

  clear(): void {
    this.cellCounts.fill(0)
  }

  insert(index: number, x: number, z: number): void {
    const cx = this.colAt(x)
    const cz = this.colAt(z)
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.cols) return
    const cell = cz * this.cols + cx
    const count = this.cellCounts[cell]
    if (count >= this.capacity) return
    this.cells[cell * this.capacity + count] = index
    this.cellCounts[cell] = count + 1
  }

  /** Пишет индексы кандидатов из ячеек вокруг точки в `out`, возвращает количество. */
  query(x: number, z: number, radius: number, out: Int32Array): number {
    const minX = this.colAt(x - radius)
    const maxX = this.colAt(x + radius)
    const minZ = this.colAt(z - radius)
    const maxZ = this.colAt(z + radius)
    let found = 0
    for (let cz = minZ; cz <= maxZ; cz++) {
      if (cz < 0 || cz >= this.cols) continue
      for (let cx = minX; cx <= maxX; cx++) {
        if (cx < 0 || cx >= this.cols) continue
        const cell = cz * this.cols + cx
        const count = this.cellCounts[cell]
        const base = cell * this.capacity
        for (let i = 0; i < count; i++) {
          if (found >= out.length) return found
          out[found++] = this.cells[base + i]
        }
      }
    }
    return found
  }

  private colAt(value: number): number {
    return Math.floor((value + this.extent) / this.cellSize)
  }
}
