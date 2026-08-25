/**
 * Ближний бой: комбо-цепочка, окна отмены, парирование, hit-stop.
 *
 * Модуль не знает ни про Three.js, ни про Rapier — только кадры и числа.
 * Поэтому вся боёвка проверяется головно (`npm run check:melee`), а не
 * «на глаз в браузере», где рассинхрон на два кадра не видно.
 *
 * Единица времени здесь — КАДР фиксированного шага 1/60, а не секунда.
 * Причина в knowledge/mechanics/frame_data_combat.md: игрок ощущает разницу
 * между 5 и 7 кадрами замаха, а «0.1 секунды» на 58 FPS превращается в 5.8
 * кадра и приём внезапно становится другим приёмом.
 */

export type MeleeState =
  | 'idle'
  | 'startup'
  | 'active'
  | 'recovery'
  | 'parry'
  | 'riposte'
  | 'stagger'
  | 'dead';

export interface Swing {
  readonly id: string;
  /** Замах: приём уже нельзя отменить, но урона ещё нет. */
  readonly startup: number;
  /** Активные кадры: только здесь существует хитбокс. */
  readonly active: number;
  /** Восстановление: окно, в котором за промах наказывают. */
  readonly recovery: number;
  readonly damage: number;
  /** Дальность от груди бойца, метры. */
  readonly reach: number;
  /** Половина угла сектора поражения, радианы. */
  readonly arc: number;
  /** Импульс отброса, Н·с — уходит в рэгдолл при смерти. */
  readonly knockback: number;
  /** Заморозка обоих на N кадров при попадании. */
  readonly hitstop: number;
  /** Доводка вперёд за замах+актив, метры. */
  readonly lunge: number;
  /**
   * Кадр восстановления, с которого разрешён переход к следующему удару связки.
   * `Infinity` — завершающий приём, отменить его нельзя.
   */
  readonly cancelFrom: number;
}

/**
 * Связка из трёх ударов. Третий — завершающий: дорогой по кадрам, ломает
 * блок, но при промахе даёт врагу 30 кадров на наказание.
 */
export const COMBO: readonly Swing[] = [
  { id: 'slash-r', startup: 7, active: 5, recovery: 16, damage: 24, reach: 2.1, arc: 1.05, knockback: 5, hitstop: 4, lunge: 0.55, cancelFrom: 4 },
  { id: 'slash-l', startup: 5, active: 5, recovery: 18, damage: 30, reach: 2.2, arc: 1.15, knockback: 7, hitstop: 5, lunge: 0.60, cancelFrom: 5 },
  { id: 'slam', startup: 14, active: 7, recovery: 30, damage: 62, reach: 2.6, arc: 1.40, knockback: 17, hitstop: 9, lunge: 0.90, cancelFrom: Infinity },
];

/** Ответный удар после идеального парирования: быстрый и очень больный. */
export const RIPOSTE: Swing = {
  id: 'riposte', startup: 4, active: 6, recovery: 12, damage: 85, reach: 2.4, arc: 1.2,
  knockback: 21, hitstop: 11, lunge: 1.1, cancelFrom: Infinity,
};

/** Удар врага. Замах длинный намеренно — иначе парирование нечестное. */
export const ENEMY_SWING: Swing = {
  id: 'enemy-chop', startup: 26, active: 6, recovery: 34, damage: 18, reach: 2.0, arc: 0.9,
  knockback: 4, hitstop: 3, lunge: 0.7, cancelFrom: Infinity,
};

/** Сколько кадров связка «помнит» себя после конца восстановления. */
export const COMBO_LINGER = 22;
/** Насколько раньше выхода из приёма засчитывается нажатие. */
export const INPUT_BUFFER = 8;

export const PARRY = {
  /** Кадры 0..PERFECT-1 — идеальное парирование с риспостом. */
  perfect: 6,
  /** Кадры PERFECT..BLOCK-1 — обычный блок: урон режется, ответа нет. */
  block: 14,
  /** Полная длина стойки: хвост после `block` — чистая уязвимость. */
  total: 22,
} as const;

export type ParryResult = 'perfect' | 'block' | 'none';

/** Что получилось из парирования, если удар пришёл на кадре `frameInParry`. */
export function parryResult(frameInParry: number): ParryResult {
  if (frameInParry < PARRY.perfect) return 'perfect';
  if (frameInParry < PARRY.block) return 'block';
  return 'none';
}

/** Доля урона, проходящая сквозь обычный блок. */
export const BLOCK_CHIP = 0.25;

/**
 * Затухание урона по стану: пока враг шатается, каждый следующий удар слабее.
 *
 * Без этого связка из трёх ударов убивает любого врага «в упор» и весь бой
 * сводится к одной кнопке (knowledge/mechanics/juggle_combo.md).
 */
export function staggerScaling(hitsInStagger: number): number {
  if (hitsInStagger <= 0) return 1;
  return Math.max(0.35, 1 - hitsInStagger * 0.18);
}

/**
 * Боец ближнего боя: автомат состояний на кадрах.
 *
 * Один экземпляр — один участник боя (игрок или враг). Ни таймеров, ни
 * `setTimeout`: всё живёт в `tick()`, который вызывается ровно 60 раз в
 * игровую секунду и замирает вместе с hit-stop и паузой.
 */
export class MeleeFighter {
  state: MeleeState = 'idle';
  /** Кадров осталось в текущем состоянии. */
  timer = 0;
  /** Индекс текущего удара связки. */
  stepIndex = 0;
  /** Кадров осталось на продолжение связки. */
  linger = 0;
  /** Кадр в стойке парирования — по нему считается результат. */
  parryFrame = 0;
  /** Кадров осталось на риспост после идеального парирования. */
  riposteWindow = 0;
  swing: Swing | null = null;
  hp: number;
  /** Кого текущий взмах уже задел: один удар — одно попадание на цель. */
  readonly hitThisSwing = new Set<number>();
  /** Ударов, полученных за текущий стан. */
  staggerHits = 0;

  private bufferedAt = -999;

  constructor(readonly maxHp: number) {
    this.hp = maxHp;
  }

  /** Занят ли боец: во время приёма новый ввод только буферизуется. */
  get busy(): boolean {
    return this.state !== 'idle';
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  /** Кадры, в которые по бойцу можно попасть при промахе — для ИИ. */
  get punishable(): boolean {
    return this.state === 'recovery' || (this.state === 'parry' && this.parryFrame >= PARRY.block);
  }

  reset(): void {
    this.state = 'idle';
    this.timer = 0;
    this.stepIndex = 0;
    this.linger = 0;
    this.parryFrame = 0;
    this.riposteWindow = 0;
    this.swing = null;
    this.hp = this.maxHp;
    this.hitThisSwing.clear();
    this.staggerHits = 0;
    this.bufferedAt = -999;
  }

  /** Запрос удара. Буферизуется всегда — решение принимает `tick`. */
  requestAttack(frame: number): void {
    this.bufferedAt = frame;
  }

  requestParry(): boolean {
    if (this.state !== 'idle') return false;
    this.state = 'parry';
    this.parryFrame = 0;
    this.timer = PARRY.total;
    return true;
  }

  /** Немедленный приём в обход буфера (риспост, ИИ). */
  start(swing: Swing): void {
    this.swing = swing;
    this.state = 'startup';
    this.timer = swing.startup;
    this.hitThisSwing.clear();
  }

  /**
   * Один кадр логики.
   *
   * `frame` — глобальный счётчик кадров, нужен только буферу ввода.
   * Возвращает `true`, если в этот кадр начался новый приём (для звука).
   */
  tick(frame: number): boolean {
    if (this.state === 'dead') return false;

    // Память связки тратится ТОЛЬКО в простое. Иначе длинный финишный удар
    // съедает окно сам собой, и третий удар физически невозможно собрать.
    if (this.state === 'idle') {
      if (this.linger > 0) this.linger--;
      if (this.linger === 0) this.stepIndex = 0;
    }
    if (this.riposteWindow > 0) this.riposteWindow--;

    if (this.state === 'parry') this.parryFrame++;

    if (this.timer > 0) this.timer--;

    // Переход из буфера в приём возможен и до конца восстановления —
    // ровно это делает связку связкой, а не тремя отдельными ударами.
    if (this.canStartFromBuffer(frame)) {
      const next = this.pickNextStep();
      this.bufferedAt = -999;
      this.start(next.swing);
      this.stepIndex = next.index;
      this.linger = COMBO_LINGER;
      return true;
    }

    if (this.timer > 0) return false;

    switch (this.state) {
      case 'startup':
        this.state = 'active';
        this.timer = this.swing!.active;
        break;
      case 'active':
        this.state = 'recovery';
        this.timer = this.swing!.recovery;
        break;
      case 'recovery':
      case 'stagger':
        this.swing = null;
        this.state = 'idle';
        this.staggerHits = 0;
        break;
      case 'parry':
        this.state = 'idle';
        this.parryFrame = 0;
        break;
      case 'riposte':
        this.state = 'idle';
        break;
      default:
        break;
    }
    return false;
  }

  /** Пропустить приём и перейти в стан (получен удар). */
  stagger(frames: number): void {
    this.state = 'stagger';
    this.timer = frames;
    this.swing = null;
    this.linger = 0;
    this.stepIndex = 0;
    this.hitThisSwing.clear();
    this.staggerHits++;
  }

  kill(): void {
    this.state = 'dead';
    this.timer = 0;
    this.swing = null;
    this.hp = 0;
  }

  /** Открыть окно риспоста — вызывается стороной, поймавшей идеальный парри. */
  grantRiposte(frames = 45): void {
    this.state = 'idle';
    this.timer = 0;
    this.parryFrame = 0;
    this.riposteWindow = frames;
  }

  private canStartFromBuffer(frame: number): boolean {
    if (frame - this.bufferedAt > INPUT_BUFFER) return false;
    if (this.state === 'idle') return true;
    if (this.state !== 'recovery' || !this.swing) return false;
    // Отмена восстановления в следующий удар связки, но не раньше `cancelFrom`.
    const elapsed = this.swing.recovery - this.timer;
    return elapsed >= this.swing.cancelFrom;
  }

  private pickNextStep(): { swing: Swing; index: number } {
    if (this.riposteWindow > 0) {
      this.riposteWindow = 0;
      return { swing: RIPOSTE, index: 0 };
    }
    // Связка продолжается, пока жив `linger` и есть куда продолжать.
    // После финишного удара цепочка всегда начинается заново — иначе игрок
    // зацикливает самый сильный приём.
    const canChain = this.linger > 0 && this.stepIndex + 1 < COMBO.length;
    const index = canChain ? this.stepIndex + 1 : 0;
    return { swing: COMBO[index], index };
  }
}

/**
 * Попадание сектором: расстояние + угол, а не AABB.
 *
 * В 3D-слэшере коробка вокруг меча промахивается мимо врага, стоящего чуть
 * сбоку, и при этом задевает того, кто за спиной. Сектор (дальность + арка)
 * совпадает с тем, что игрок видит по анимации взмаха.
 *
 * @param dx,dz    вектор от атакующего к цели (мировые координаты)
 * @param facing   направление атакующего, радианы (0 = +Z)
 */
export function inSwingArc(
  dx: number, dz: number, facing: number, swing: Swing, targetRadius: number,
): boolean {
  const distSq = dx * dx + dz * dz;
  const reach = swing.reach + targetRadius;
  if (distSq > reach * reach) return false;
  if (distSq < 1e-6) return true;
  const dist = Math.sqrt(distSq);
  // Косинус угла между направлением взгляда и направлением на цель.
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  const cos = (fx * dx + fz * dz) / dist;
  return cos >= Math.cos(swing.arc);
}

/** Кадры стана от урона: тяжёлый удар держит дольше лёгкого. */
export function staggerFrames(damage: number): number {
  return Math.round(10 + Math.min(damage, 90) * 0.28);
}
