/**
 * Фрейм-дата: единственный источник баланса файтинга.
 *
 * knowledge/threejs/fighting_game_core.md §1. Модуль намеренно НЕ импортирует
 * three: он проверяется головно (`npx tsx scripts/fighting-check.ts`) без
 * рендерера — так же, как спецификация транспорта (CRITICAL_RULES §66).
 *
 * Все длительности — в логических кадрах при 60 Гц.
 */

export type MoveId = 'light' | 'medium' | 'heavy' | 'uppercut';

export interface BoxSpec {
  /** Смещение центра вперёд от бойца (умножается на facing). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Move {
  id: MoveId;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  /** Урон сквозь блок. */
  chip: number;
  hitstun: number;
  blockstun: number;
  /** Заморозка ОБОИХ бойцов при контакте. */
  hitstop: number;
  /** Откидывание, метров за срабатывание. */
  pushback: number;
  /** Вертикальный импульс: 0 — не подбрасывает. */
  launch: number;
  hitbox: BoxSpec;
}

export const MOVES: Record<MoveId, Move> = {
  light: {
    id: 'light',
    startup: 4, active: 3, recovery: 7,
    damage: 40, chip: 4, hitstun: 14, blockstun: 9, hitstop: 5,
    pushback: 0.06, launch: 0,
    hitbox: { x: 0.72, y: 1.3, w: 0.7, h: 0.34 },
  },
  medium: {
    id: 'medium',
    startup: 7, active: 4, recovery: 12,
    damage: 75, chip: 8, hitstun: 19, blockstun: 12, hitstop: 7,
    pushback: 0.11, launch: 0,
    hitbox: { x: 0.85, y: 1.15, w: 0.85, h: 0.45 },
  },
  heavy: {
    id: 'heavy',
    startup: 14, active: 5, recovery: 22,
    damage: 130, chip: 14, hitstun: 26, blockstun: 15, hitstop: 11,
    pushback: 0.2, launch: 0,
    hitbox: { x: 1.0, y: 1.2, w: 1.05, h: 0.6 },
  },
  uppercut: {
    id: 'uppercut',
    startup: 9, active: 4, recovery: 26,
    damage: 100, chip: 10, hitstun: 30, blockstun: 13, hitstop: 9,
    pushback: 0.08, launch: 0.34,
    hitbox: { x: 0.6, y: 1.5, w: 0.7, h: 1.1 },
  },
};

/**
 * Преимущество в кадрах при блоке. Отрицательное значение = приём наказуем:
 * соперник успевает ответить более быстрым ударом.
 */
export function frameAdvantageOnBlock(move: Move): number {
  return move.blockstun - (move.active + move.recovery);
}

export function frameAdvantageOnHit(move: Move): number {
  return move.hitstun - (move.active + move.recovery);
}

/**
 * Затухание урона в комбо. Без него одно удачное попадание = полная полоса
 * здоровья, и матч перестаёт существовать.
 */
export function comboScaling(hits: number): number {
  return Math.max(0.25, 1 - hits * 0.09);
}

/** Самый быстрый приём, которым можно наказать приём соперника. */
export function punisherFor(move: Move): Move | null {
  const window = -frameAdvantageOnBlock(move);
  const candidates = Object.values(MOVES)
    .filter((m) => m.startup <= window)
    .sort((a, b) => b.damage - a.damage);
  return candidates[0] ?? null;
}
