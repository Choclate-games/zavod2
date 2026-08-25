/**
 * Tower defense: контракт волн, приоритет целей, экономика.
 *
 * knowledge/threejs/tower_defense_core.md §2, §4, §5. Модуль renderer-free и
 * проверяется головно (`npm run check:td`): «волна 12 непроходима» ловится за
 * секунды вместо получаса ручной игры.
 */

export type EnemyKind = 'grunt' | 'runner' | 'shield' | 'flyer' | 'healer';

export interface EnemySpec {
  kind: EnemyKind;
  hp: number;
  speed: number;      // м/с
  armor: number;      // 0..0.8 — доля поглощаемого урона
  flying: boolean;
  bounty: number;
  cost: number;       // «стоимость» в бюджете волны
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  grunt:  { kind: 'grunt',  hp: 100, speed: 3.2, armor: 0.0,  flying: false, bounty: 6,  cost: 10 },
  runner: { kind: 'runner', hp: 60,  speed: 6.4, armor: 0.0,  flying: false, bounty: 7,  cost: 12 },
  shield: { kind: 'shield', hp: 260, speed: 2.4, armor: 0.55, flying: false, bounty: 14, cost: 26 },
  flyer:  { kind: 'flyer',  hp: 90,  speed: 5.0, armor: 0.1,  flying: true,  bounty: 11, cost: 20 },
  healer: { kind: 'healer', hp: 180, speed: 2.8, armor: 0.2,  flying: false, bounty: 18, cost: 30 },
};

export type TowerKind = 'gun' | 'cannon' | 'laser';

export interface TowerSpec {
  kind: TowerKind;
  cost: number;
  range: number;
  /** Выстрелов в секунду. */
  fireRate: number;
  damage: number;
  splash: number;        // радиус, 0 = одиночная цель
  hitsAir: boolean;
  /** Пробитие брони: сколько брони игнорируется. */
  pierce: number;
  projectileSpeed: number;   // 0 = hitscan
}

export const TOWERS: Record<TowerKind, TowerSpec> = {
  gun:    { kind: 'gun',    cost: 50,  range: 11, fireRate: 3.4, damage: 14, splash: 0,   hitsAir: true,  pierce: 0.0, projectileSpeed: 0 },
  cannon: { kind: 'cannon', cost: 110, range: 13, fireRate: 0.8, damage: 62, splash: 3.2, hitsAir: false, pierce: 0.3, projectileSpeed: 26 },
  laser:  { kind: 'laser',  cost: 145, range: 16, fireRate: 1.6, damage: 48, splash: 0,   hitsAir: true,  pierce: 0.55, projectileSpeed: 0 },
};

export type Priority = 'first' | 'last' | 'strongest' | 'weakest' | 'closest';
export const PRIORITIES: Priority[] = ['first', 'last', 'strongest', 'weakest', 'closest'];

export interface TargetCandidate {
  eid: number;
  /** Пройденное расстояние вдоль пути, метры — «ближе к базе» = больше. */
  dist: number;
  hp: number;
  flying: boolean;
  /** Квадрат расстояния до башни. */
  d2: number;
}

/**
 * Выбор цели. Гистерезис ОБЯЗАТЕЛЕН: без него башня перебирает цели каждый кадр
 * и не наносит урона — самый частый дефект жанра.
 */
export function pickTarget(
  priority: Priority,
  range: number,
  hitsAir: boolean,
  candidates: TargetCandidate[],
  currentEid: number,
): number {
  const r2 = range * range;
  const valid = (c: TargetCandidate) => c.d2 <= r2 && (hitsAir || !c.flying) && c.hp > 0;

  const current = candidates.find((c) => c.eid === currentEid);
  if (current && valid(current)) return currentEid;

  let best = -1;
  let bestScore = -Infinity;
  for (const c of candidates) {
    if (!valid(c)) continue;
    const score = priority === 'first' ? c.dist
      : priority === 'last' ? -c.dist
      : priority === 'strongest' ? c.hp
      : priority === 'weakest' ? -c.hp
      : -c.d2;
    if (score > bestScore) { bestScore = score; best = c.eid; }
  }
  return best;
}

/** Урон с учётом брони и пробития. */
export function applyArmor(damage: number, armor: number, pierce: number): number {
  return damage * (1 - Math.max(0, armor - pierce));
}

// ─────────────────────────────────────────────────────────── волны

export interface WaveEntry { kind: EnemyKind; count: number }
export interface Wave {
  index: number;
  budget: number;
  entries: WaveEntry[];
  interval: number;
  /** Награда за вызов волны раньше таймера. */
  earlyBonus: number;
  /** Новый тип угрозы в этой волне — есть что объяснить игроку. */
  newThreat: EnemyKind | null;
}

/** Нелинейный рост: линейный даёт скучную середину и невозможный конец. */
export function waveBudget(index: number): number {
  return Math.round(100 * Math.pow(index, 1.35));
}

/**
 * Состав волны детерминирован от номера: случайный состав делает баланс
 * невоспроизводимым, а игрока — неспособным учиться.
 */
export function buildWave(index: number): Wave {
  const budget = waveBudget(index);
  const unlocked: EnemyKind[] = ['grunt'];
  let newThreat: EnemyKind | null = null;

  // Каждая 5-я волна меняет ТИП угрозы, а не толщину прежней.
  if (index >= 3) unlocked.push('runner');
  if (index >= 5) unlocked.push('flyer');
  if (index >= 10) unlocked.push('shield');
  if (index >= 15) unlocked.push('healer');
  if (index === 3) newThreat = 'runner';
  if (index === 5) newThreat = 'flyer';
  if (index === 10) newThreat = 'shield';
  if (index === 15) newThreat = 'healer';

  // Раскладываем бюджет по разблокированным типам с фиксированными весами.
  const weights = unlocked.map((k, i) => (i === unlocked.length - 1 && newThreat ? 0.45 : 1 / unlocked.length));
  const total = weights.reduce((a, b) => a + b, 0);
  const entries: WaveEntry[] = [];
  unlocked.forEach((kind, i) => {
    const share = (weights[i] / total) * budget;
    const count = Math.max(1, Math.round(share / ENEMIES[kind].cost));
    entries.push({ kind, count });
  });

  return {
    index,
    budget,
    entries,
    interval: Math.max(0.28, 0.8 - index * 0.02),
    earlyBonus: 20 + index * 5,
    newThreat,
  };
}

/** Разворачивает волну в порядок спавна: типы чередуются, а не идут блоками. */
export function spawnOrder(wave: Wave): EnemyKind[] {
  const pools = wave.entries.map((e) => ({ kind: e.kind, left: e.count }));
  const out: EnemyKind[] = [];
  let guard = 0;
  while (pools.some((p) => p.left > 0) && guard++ < 5000) {
    for (const p of pools) {
      if (p.left > 0) { out.push(p.kind); p.left--; }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────── экономика

export const START_GOLD = 260;
export const START_LIVES = 20;
export const SELL_RATIO = 0.7;

/** Улучшение: ×1.8 урона за ×2 цены, но без нового слота. */
export function upgradeCost(spec: TowerSpec, level: number): number {
  return Math.round(spec.cost * Math.pow(2, level));
}

export function upgradedDamage(spec: TowerSpec, level: number): number {
  return spec.damage * Math.pow(1.8, level);
}

/**
 * Равномерная сетка для поиска целей: 40 башен × 300 врагов перебором — это
 * 12 000 проверок в кадр (§2 документа).
 */
export class SpatialGrid<T> {
  private readonly cells = new Map<number, T[]>();

  constructor(readonly cellSize: number) {}

  private key(x: number, z: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return (cx & 0xffff) << 16 | (cz & 0xffff);
  }

  clear(): void { this.cells.clear(); }

  insert(x: number, z: number, item: T): void {
    const k = this.key(x, z);
    const bucket = this.cells.get(k);
    if (bucket) bucket.push(item);
    else this.cells.set(k, [item]);
  }

  /** Все элементы в квадрате радиуса `radius` вокруг точки. */
  query(x: number, z: number, radius: number, out: T[]): T[] {
    out.length = 0;
    const r = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        const bucket = this.cells.get(((cx + i) & 0xffff) << 16 | ((cz + j) & 0xffff));
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }
}
