export interface SpatialEntity<T = any> {
  id: number | string;
  x: number;
  z: number;
  radius: number;
  data: T;
}

export class SpatialHashGrid<T = any> {
  private cellSize: number;
  private grid: Map<string, SpatialEntity<T>[]> = new Map();
  private entityMap: Map<number | string, SpatialEntity<T>> = new Map();

  constructor(cellSize = 6.0) {
    this.cellSize = cellSize;
  }

  private getKey(cx: number, cz: number): string {
    return `${cx}:${cz}`;
  }

  public clear(): void {
    this.grid.clear();
    this.entityMap.clear();
  }

  public insert(entity: SpatialEntity<T>): void {
    this.entityMap.set(entity.id, entity);

    const minCx = Math.floor((entity.x - entity.radius) / this.cellSize);
    const maxCx = Math.floor((entity.x + entity.radius) / this.cellSize);
    const minCz = Math.floor((entity.z - entity.radius) / this.cellSize);
    const maxCz = Math.floor((entity.z + entity.radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this.getKey(cx, cz);
        let bucket = this.grid.get(key);
        if (!bucket) {
          bucket = [];
          this.grid.set(key, bucket);
        }
        bucket.push(entity);
      }
    }
  }

  public queryRadius(x: number, z: number, radius: number): SpatialEntity<T>[] {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);

    const results: SpatialEntity<T>[] = [];
    const seen = new Set<number | string>();
    const radiusSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this.getKey(cx, cz);
        const bucket = this.grid.get(key);
        if (!bucket) continue;

        for (let i = 0; i < bucket.length; i++) {
          const entity = bucket[i];
          if (!seen.has(entity.id)) {
            seen.add(entity.id);

            const dx = entity.x - x;
            const dz = entity.z - z;
            const totalR = radius + entity.radius;
            if (dx * dx + dz * dz <= totalR * totalR) {
              results.push(entity);
            }
          }
        }
      }
    }

    return results;
  }
}
