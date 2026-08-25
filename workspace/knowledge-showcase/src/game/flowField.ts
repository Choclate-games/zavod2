/**
 * Флоу-филд и строй для RTS.
 *
 * knowledge/threejs/rts_selection_and_command.md §4-5. Это ровно тот случай,
 * где своя реализация уместна: recast `Crowd` не рассчитан на сотни агентов с
 * ОДНОЙ целью, а флоу-филд для этой задачи — один проход BFS и 60 строк.
 * Индивидуальный A* на каждого юнита не пишем никогда.
 *
 * Модуль renderer-free: проверяется головно (`npm run check:rts`).
 */

export interface Vec2 { x: number; z: number }

export class FlowField {
  readonly cols: number;
  readonly rows: number;
  /** Расстояние до цели в клетках; Infinity — недостижимо. */
  readonly dist: Float32Array;
  /** Направление к цели, нормализованное; пары (dx, dz). */
  readonly flow: Float32Array;
  private readonly blocked: Uint8Array;
  /** Кольцевая очередь SPFA + флаг «уже в очереди», чтобы не дублировать клетки. */
  private readonly queue: Int32Array;
  private readonly queued: Uint8Array;

  constructor(
    cols: number,
    rows: number,
    readonly cellSize: number,
    readonly originX: number,
    readonly originZ: number,
  ) {
    this.cols = cols;
    this.rows = rows;
    this.dist = new Float32Array(cols * rows);
    this.flow = new Float32Array(cols * rows * 2);
    this.blocked = new Uint8Array(cols * rows);
    this.queue = new Int32Array(cols * rows);
    this.queued = new Uint8Array(cols * rows);
  }

  setBlocked(cx: number, cz: number, value: boolean): void {
    if (!this.inside(cx, cz)) return;
    this.blocked[cz * this.cols + cx] = value ? 1 : 0;
  }

  isBlocked(cx: number, cz: number): boolean {
    return !this.inside(cx, cz) || this.blocked[cz * this.cols + cx] === 1;
  }

  inside(cx: number, cz: number): boolean {
    return cx >= 0 && cz >= 0 && cx < this.cols && cz < this.rows;
  }

  cellOf(x: number, z: number): { cx: number; cz: number } {
    return {
      cx: Math.floor((x - this.originX) / this.cellSize),
      cz: Math.floor((z - this.originZ) / this.cellSize),
    };
  }

  centerOf(cx: number, cz: number, out: Vec2): Vec2 {
    out.x = this.originX + (cx + 0.5) * this.cellSize;
    out.z = this.originZ + (cz + 0.5) * this.cellSize;
    return out;
  }

  /**
   * Пересчёт поля от цели. ОДИН раз на приказ, а не на юнита и не на кадр:
   * поле переиспользуется всеми юнитами этого приказа.
   */
  build(targetX: number, targetZ: number): boolean {
    this.dist.fill(Infinity);
    const { cx, cz } = this.cellOf(targetX, targetZ);
    if (this.isBlocked(cx, cz)) {
      // Цель в стене — берём ближайшую свободную клетку, иначе приказ молча
      // не выполняется и игрок думает, что юниты сломались.
      const free = this.nearestFree(cx, cz);
      if (!free) return false;
      return this.build(
        this.originX + (free.cx + 0.5) * this.cellSize,
        this.originZ + (free.cz + 0.5) * this.cellSize,
      );
    }

    const capacity = this.queue.length;
    this.queued.fill(0);
    let head = 0;
    let tail = 0;
    let size = 0;
    const push = (idx: number): void => {
      if (this.queued[idx] || size >= capacity) return;
      this.queued[idx] = 1;
      this.queue[tail] = idx;
      tail = (tail + 1) % capacity;
      size++;
    };

    const start = cz * this.cols + cx;
    this.dist[start] = 0;
    push(start);

    while (size > 0) {
      const idx = this.queue[head];
      head = (head + 1) % capacity;
      size--;
      this.queued[idx] = 0;
      const x = idx % this.cols;
      const z = (idx / this.cols) | 0;
      const d = this.dist[idx];
      for (let i = 0; i < 8; i++) {
        const nx = x + NEIGHBORS[i * 2];
        const nz = z + NEIGHBORS[i * 2 + 1];
        if (!this.inside(nx, nz)) continue;
        const nIdx = nz * this.cols + nx;
        if (this.blocked[nIdx]) continue;
        // Диагональ запрещена, если оба ортогональных соседа заняты: иначе
        // юниты «протискиваются» сквозь угол между двумя стенами.
        if (i >= 4 && (this.blocked[z * this.cols + nx] || this.blocked[nz * this.cols + x])) continue;
        const step = i >= 4 ? 1.4142 : 1;
        if (this.dist[nIdx] <= d + step) continue;
        this.dist[nIdx] = d + step;
        push(nIdx);
      }
    }

    this.buildFlow();
    return true;
  }

  /** Направление движения из клетки под мировой точкой. */
  sample(x: number, z: number, out: Vec2): Vec2 {
    const { cx, cz } = this.cellOf(x, z);
    if (!this.inside(cx, cz)) { out.x = 0; out.z = 0; return out; }
    const idx = (cz * this.cols + cx) * 2;
    out.x = this.flow[idx];
    out.z = this.flow[idx + 1];
    return out;
  }

  reachable(x: number, z: number): boolean {
    const { cx, cz } = this.cellOf(x, z);
    return this.inside(cx, cz) && Number.isFinite(this.dist[cz * this.cols + cx]);
  }

  private buildFlow(): void {
    for (let z = 0; z < this.rows; z++) {
      for (let x = 0; x < this.cols; x++) {
        const idx = z * this.cols + x;

        // Занятая клетка получает направление ВЫТАЛКИВАНИЯ на ближайшую
        // свободную с наименьшей дистанцией. Без этого юнит, срезавший угол
        // по диагонали, попадает в стену, читает нулевое направление и
        // застревает навсегда — это ловила головная проверка.
        if (this.blocked[idx]) {
          let escapeD = Infinity;
          let ex = 0;
          let ez = 0;
          for (let i = 0; i < 8; i++) {
            const nx = x + NEIGHBORS[i * 2];
            const nz = z + NEIGHBORS[i * 2 + 1];
            if (!this.inside(nx, nz)) continue;
            const nIdx = nz * this.cols + nx;
            if (this.blocked[nIdx] || this.dist[nIdx] >= escapeD) continue;
            escapeD = this.dist[nIdx];
            ex = NEIGHBORS[i * 2];
            ez = NEIGHBORS[i * 2 + 1];
          }
          const eLen = Math.hypot(ex, ez) || 1;
          this.flow[idx * 2] = ex / eLen;
          this.flow[idx * 2 + 1] = ez / eLen;
          continue;
        }

        if (!Number.isFinite(this.dist[idx])) { this.flow[idx * 2] = 0; this.flow[idx * 2 + 1] = 0; continue; }
        let bestD = this.dist[idx];
        let bx = 0;
        let bz = 0;
        for (let i = 0; i < 8; i++) {
          const nx = x + NEIGHBORS[i * 2];
          const nz = z + NEIGHBORS[i * 2 + 1];
          if (!this.inside(nx, nz)) continue;
          const nIdx = nz * this.cols + nx;
          if (this.blocked[nIdx] || this.dist[nIdx] >= bestD) continue;
          bestD = this.dist[nIdx];
          bx = NEIGHBORS[i * 2];
          bz = NEIGHBORS[i * 2 + 1];
        }
        const len = Math.hypot(bx, bz) || 1;
        this.flow[idx * 2] = bx / len;
        this.flow[idx * 2 + 1] = bz / len;
      }
    }
  }

  private nearestFree(cx: number, cz: number): { cx: number; cz: number } | null {
    for (let r = 1; r < Math.max(this.cols, this.rows); r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          if (!this.isBlocked(cx + dx, cz + dz)) return { cx: cx + dx, cz: cz + dz };
        }
      }
    }
    return null;
  }
}

const NEIGHBORS = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1];

/**
 * Слоты строя вокруг точки приказа, ориентированные по направлению движения.
 * Отправить 20 юнитов в ОДНУ точку — значит получить дрожащую кучу.
 */
export function formationSlots(
  center: Vec2,
  dir: Vec2,
  count: number,
  spacing = 1.9,
): Vec2[] {
  const len = Math.hypot(dir.x, dir.z) || 1;
  const fx = dir.x / len;
  const fz = dir.z / len;
  const rx = fz;
  const rz = -fx;

  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const out: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const offR = (c - (cols - 1) / 2) * spacing;
    const offF = -(r - (rows - 1) / 2) * spacing;
    out.push({ x: center.x + rx * offR + fx * offF, z: center.z + rz * offR + fz * offF });
  }
  return out;
}

/**
 * Жадное назначение слотов по близости. Без него отряд перекрещивается сам с
 * собой по дороге и приходит к цели вдвое дольше.
 */
export function assignSlots(units: Vec2[], slots: Vec2[]): number[] {
  const result = new Array<number>(units.length).fill(-1);
  const takenSlot = new Uint8Array(slots.length);
  const pairs: Array<{ u: number; s: number; d: number }> = [];

  for (let u = 0; u < units.length; u++) {
    for (let s = 0; s < slots.length; s++) {
      const dx = units[u].x - slots[s].x;
      const dz = units[u].z - slots[s].z;
      pairs.push({ u, s, d: dx * dx + dz * dz });
    }
  }
  pairs.sort((a, b) => a.d - b.d);

  let assigned = 0;
  for (const p of pairs) {
    if (assigned === units.length) break;
    if (result[p.u] !== -1 || takenSlot[p.s]) continue;
    result[p.u] = p.s;
    takenSlot[p.s] = 1;
    assigned++;
  }
  return result;
}

/** Урон по таблице «тип атаки × тип брони» — источник камня-ножниц-бумаги. */
export type UnitClass = 'infantry' | 'armored' | 'air';
const DAMAGE_TABLE: Record<UnitClass, Record<UnitClass, number>> = {
  // Замкнутый цикл: пехота → авиация → бронетехника → пехота.
  // У каждого класса есть и жертва, и хищник, иначе «камень-ножницы-бумага»
  // вырождается в один доминирующий юнит.
  infantry: { infantry: 1.0,  armored: 0.5, air: 1.5 },
  armored:  { infantry: 1.5,  armored: 1.0, air: 0.5 },
  air:      { infantry: 0.75, armored: 1.5, air: 1.0 },
};

export function damageMultiplier(attacker: UnitClass, defender: UnitClass): number {
  return DAMAGE_TABLE[attacker][defender];
}
