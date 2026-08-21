/**
 * Забег в survivor-игре: кривая опыта, карточки апгрейдов, эскалация орды.
 *
 * Модуль не знает про Three.js и про bitECS — это чистые числа, поэтому весь
 * баланс проверяется головно (`npm run check:survivor`). Именно здесь живут
 * решения, которые «на глаз» не проверяются вообще: успевает ли игрок убивать
 * орду на пятой минуте и не ломается ли пул карточек, когда всё выкачано.
 *
 * knowledge/mechanics/wave_survival.md, knowledge/mechanics/upgrade_choices.md,
 * knowledge/patterns/survivor_loop.md.
 */

export interface RunStats {
  /** Урон одного снаряда. */
  damage: number;
  /** Выстрелов в секунду. */
  fireRate: number;
  /** Снарядов за выстрел. */
  projectiles: number;
  /** Множитель радиуса поражения и подбора. */
  area: number;
  /** Клинков на орбите. */
  orbitals: number;
  /** Урон клинка за касание. */
  orbitDamage: number;
  moveSpeed: number;
  /** Радиус притяжения кристаллов опыта, метры. */
  magnet: number;
  maxHp: number;
  /** Восстановление HP в секунду. */
  regen: number;
}

export const BASE_STATS: Readonly<RunStats> = {
  damage: 20,
  fireRate: 3.0,
  projectiles: 1,
  area: 1,
  orbitals: 0,
  orbitDamage: 9,
  moveSpeed: 6.2,
  magnet: 2.4,
  maxHp: 100,
  regen: 0,
};

export type Rarity = 'common' | 'rare' | 'epic';

export interface UpgradeCard {
  readonly id: string;
  readonly title: readonly [string, string];
  readonly text: readonly [string, string];
  readonly rarity: Rarity;
  /** Сколько раз карту можно взять за забег. */
  readonly maxStacks: number;
  /** Карта не появится в раздаче, пока не взята указанная. */
  readonly requires?: string;
  apply(stats: RunStats): void;
}

/** Вес раздачи по редкости: обычные встречаются в 6 раз чаще эпических. */
const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 25, epic: 10 };

export const UPGRADES: readonly UpgradeCard[] = [
  {
    id: 'might', rarity: 'common', maxStacks: 5,
    title: ['Мощь', 'Might'], text: ['Урон +25%', 'Damage +25%'],
    apply: (s) => { s.damage *= 1.25; },
  },
  {
    id: 'rapid', rarity: 'common', maxStacks: 5,
    title: ['Скорострельность', 'Rapid fire'], text: ['Темп стрельбы +20%', 'Fire rate +20%'],
    apply: (s) => { s.fireRate *= 1.2; },
  },
  {
    id: 'multishot', rarity: 'epic', maxStacks: 3,
    title: ['Веер', 'Multishot'], text: ['+1 снаряд за выстрел', '+1 projectile per shot'],
    apply: (s) => { s.projectiles += 1; },
  },
  {
    id: 'orbit', rarity: 'rare', maxStacks: 4,
    title: ['Клинок на орбите', 'Orbiting blade'], text: ['+1 вращающийся клинок', '+1 orbiting blade'],
    apply: (s) => { s.orbitals += 1; },
  },
  {
    id: 'edge', rarity: 'rare', maxStacks: 4, requires: 'orbit',
    title: ['Заточка', 'Sharpened edge'], text: ['Урон клинков +30%', 'Blade damage +30%'],
    apply: (s) => { s.orbitDamage *= 1.3; },
  },
  {
    id: 'area', rarity: 'rare', maxStacks: 4,
    title: ['Размах', 'Wider reach'], text: ['Радиус поражения +18%', 'Area +18%'],
    apply: (s) => { s.area *= 1.18; },
  },
  {
    id: 'boots', rarity: 'common', maxStacks: 4,
    title: ['Сапоги', 'Boots'], text: ['Скорость бега +12%', 'Move speed +12%'],
    apply: (s) => { s.moveSpeed *= 1.12; },
  },
  {
    id: 'magnet', rarity: 'common', maxStacks: 3,
    title: ['Магнит', 'Magnet'], text: ['Радиус сбора опыта +45%', 'Pickup radius +45%'],
    apply: (s) => { s.magnet *= 1.45; },
  },
  {
    id: 'vitality', rarity: 'common', maxStacks: 4,
    title: ['Живучесть', 'Vitality'], text: ['Максимум HP +25', 'Max HP +25'],
    apply: (s) => { s.maxHp += 25; },
  },
  {
    id: 'regen', rarity: 'epic', maxStacks: 3, requires: 'vitality',
    title: ['Регенерация', 'Regeneration'], text: ['+0.6 HP в секунду', '+0.6 HP per second'],
    apply: (s) => { s.regen += 0.6; },
  },
];

/**
 * Опыт до следующего уровня.
 *
 * Линейный рост, а не экспоненциальный: в 20-минутном забеге экспонента
 * означает, что после 12-го уровня карточек больше не будет, и вторая половина
 * забега проходит без единого решения игрока.
 */
export function xpForLevel(level: number): number {
  return 8 + level * 9;
}

/** Детерминированный ГПСЧ: одинаковый seed — одинаковая раздача карт. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RunState {
  level = 1;
  xp = 0;
  xpNeeded = xpForLevel(1);
  readonly stats: RunStats = { ...BASE_STATS };
  hp = BASE_STATS.maxHp;
  /** Сколько раз взята каждая карта. */
  readonly taken = new Map<string, number>();
  /** Накопленные уровни, за которые ещё не выбрана карта. */
  pendingLevels = 0;
  kills = 0;
  /** Секунд с начала забега. */
  time = 0;

  constructor(private readonly rng: () => number = makeRng(1)) {}

  /** Добавить опыт. Возвращает число новых уровней. */
  addXp(amount: number): number {
    let levels = 0;
    this.xp += amount;
    // Цикл, а не `if`: подбор пачки кристаллов может дать два уровня разом,
    // и второй нельзя терять.
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level++;
      this.xpNeeded = xpForLevel(this.level);
      this.pendingLevels++;
      levels++;
    }
    return levels;
  }

  /** Доступна ли карта: не выкачана и выполнено требование. */
  available(card: UpgradeCard): boolean {
    if ((this.taken.get(card.id) ?? 0) >= card.maxStacks) return false;
    if (card.requires && (this.taken.get(card.requires) ?? 0) === 0) return false;
    return true;
  }

  /**
   * Раздача карт на выбор.
   *
   * Возвращает МЕНЬШЕ `count` карт, если пул исчерпан — вызывающий обязан это
   * пережить. Классический баг жанра: раздача пытается набрать ровно три карты
   * из двух доступных и либо зацикливается, либо выдаёт дубль, который игрок
   * берёт и не получает ничего.
   */
  draw(count = 3): UpgradeCard[] {
    const pool = UPGRADES.filter((c) => this.available(c));
    const picked: UpgradeCard[] = [];
    const weights = pool.map((c) => RARITY_WEIGHT[c.rarity]);

    while (picked.length < count && pool.length > 0) {
      let total = 0;
      for (const w of weights) total += w;
      let roll = this.rng() * total;
      let idx = 0;
      while (idx < pool.length - 1 && roll >= weights[idx]) { roll -= weights[idx]; idx++; }
      picked.push(pool[idx]);
      pool.splice(idx, 1);
      weights.splice(idx, 1);
    }
    return picked;
  }

  take(card: UpgradeCard): void {
    card.apply(this.stats);
    this.taken.set(card.id, (this.taken.get(card.id) ?? 0) + 1);
    if (this.pendingLevels > 0) this.pendingLevels--;
    // Прибавка к максимуму лечит на ту же величину — иначе апгрейд живучести,
    // взятый на 5 HP, не спасает и ощущается как обман.
    this.hp = Math.min(this.stats.maxHp, this.hp + 25 * (card.id === 'vitality' ? 1 : 0));
  }

  /** Урон в секунду по ОДНОЙ цели: только стрельба. */
  get singleTargetDps(): number {
    const s = this.stats;
    return s.damage * s.projectiles * s.fireRate;
  }
}

/** Сколько врагов одновременно достаёт кольцо клинков. */
export function ringCapacity(stats: RunStats): number {
  return Math.round(5 * stats.area) * stats.orbitals;
}

/**
 * Оценка убийств в секунду — модель баланса, по которой считается забег.
 *
 * Ключевая мысль жанра: стрельба бьёт по одной цели, а клинки на орбите бьют
 * по ВСЕМ, кто в кольце. Поэтому урон игрока растёт вместе с плотностью толпы,
 * и именно это позволяет одному персонажу выкашивать десятки врагов в секунду.
 *
 * Считать общий «DPS» без учёта площади — та самая ошибка, из-за которой
 * баланс сходится к «игрок убивает 3 врага в секунду при спавне 27» и забег
 * выглядит безнадёжным уже на третьей минуте.
 */
export function killsPerSecond(stats: RunStats, enemyHp: number, nearby: number): number {
  const single = stats.damage * stats.projectiles * stats.fireRate;
  // Клинок задевает цель примерно дважды в секунду.
  const sweep = stats.orbitDamage * 2 * Math.min(nearby, ringCapacity(stats));
  return (single + sweep) / enemyHp;
}

export interface HordeBudget {
  /** Врагов в секунду. */
  spawnRate: number;
  hp: number;
  speed: number;
  /** Доля элитных врагов, 0..1. */
  eliteShare: number;
}

/**
 * Эскалация орды по времени забега.
 *
 * ⚠️ **Оба параметра растут ЛИНЕЙНО.** Первая версия множила здоровье врага на
 * 1.55 за минуту, и головной прогон показал спираль смерти: к третьей минуте
 * игрок перестаёт убивать → не получает опыт → не получает карточки → его DPS
 * замирает навсегда, пока орда продолжает расти. На экране это выглядит как
 * «игра резко стала невозможной», и причину не видно.
 *
 * Правило: рост орды не должен обгонять рост игрока раньше запланированного
 * финала забега. Проверяется в `check:survivor` тремя контрольными точками
 * (1-я, 5-я и 15-я минута).
 */
export function hordeAt(seconds: number): HordeBudget {
  const m = seconds / 60;
  return {
    spawnRate: 2 + m * 1.4,
    hp: 12 * (1 + m * 0.45),
    speed: 2.6 + Math.min(m * 0.22, 1.6),
    eliteShare: Math.min(0.3, Math.max(0, (m - 2) * 0.05)),
  };
}

/** Опыт за врага: элита даёт втрое больше. */
export function xpForKill(elite: boolean): number {
  return elite ? 3 : 1;
}
