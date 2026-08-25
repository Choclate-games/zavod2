/**
 * Формат процедурной анимации стрелка.
 *
 * Отдельный файл, потому что его читают обе стороны: скрипт запекания
 * (`scripts/bake-shooter-anim.ts`) и рантайм (`shooterPose.ts`). Сгенерированный
 * `shooterAnimData.ts` импортирует типы отсюда — так формат остаётся одним
 * и тем же для того, кто пишет числа, и для того, кто их читает.
 */

/**
 * Суставы в порядке, в котором их числа лежат в позе.
 *
 * Порядок — сверху вниз по скелету: ребёнок решается по уже выставленному
 * родителю. Менять его нельзя, не пересобрав `shooterAnimData.ts`.
 */
export const JOINTS = [
  'body', 'waist', 'chest', 'head',
  'shoulderL', 'elbowL', 'shoulderR', 'elbowR',
  'thighL', 'shinL', 'thighR', 'shinR',
] as const;

export type JointKey = typeof JOINTS[number];

/** Длина одной позы: 12 суставов × (x, y, z). */
export const POSE_SIZE = JOINTS.length * 3;

/**
 * Циклическое движение, заданное рядом Фурье по фазе.
 *
 * Фаза, а не время: враг идёт медленно — цикл растягивается сам. С готовым
 * `AnimationClip` пришлось бы крутить `timeScale`, и шаг всё равно ехал бы
 * относительно фактической скорости.
 */
export interface CycleClip {
  /** Длительность одного оборота в исходном мокапе, с. */
  period: number;
  /** Длина шага (разнос стоп), м. По ней фаза привязывается к скорости. */
  stride: number;
  /** Ряд для вертикального хода таза, 2 гармоники. */
  hipBob: number[];
  /** По одному ряду на каждое из `POSE_SIZE` чисел позы. */
  coef: number[][];
}

/** Одиночное движение: ключевые позы по времени. */
export interface PoseClip {
  duration: number;
  /**
   * Дельта к текущей позе (выстрел, реакция на попадание) или абсолютная
   * поза (смерть). Дельта позволяет стрелять и получать пули на бегу.
   */
  additive: boolean;
  /** Времена ключей, с. Возрастают, times[0] = 0. */
  times: number[];
  /** Ключевые позы, по `POSE_SIZE` чисел каждая. */
  pose: number[][];
}

export interface ShooterAnimData {
  harmonics: number;
  /** Стойка с винтовкой: ряды Фурье по времени клипа (дыхание в 1-2 гармониках). */
  aim: number[][];
  cycles: { run: CycleClip; strafe: CycleClip; backward: CycleClip };
  fire: PoseClip;
  hits: { chest: PoseClip; body: PoseClip; head: PoseClip };
  death: PoseClip;
  /** Высота таза по ключам смерти, м. */
  deathHip: number[];
}
