/**
 * Стелс: конус зрения, шкала подозрения, шум.
 *
 * Модуль не знает про Three.js — только математика и состояния, поэтому вся
 * механика обнаружения проверяется головно (`npm run check:stealth`). Именно
 * здесь живут числа, из-за которых стелс ощущается честным или нечестным:
 * сколько секунд до тревоги, насколько помогает тень, слышно ли бег.
 *
 * knowledge/mechanics/stealth_detection.md, knowledge/threejs/stealth_and_vision_cones.md.
 */

export const VISION = {
  /** Половина угла обзора, радианы (полный конус — 90°). */
  halfAngle: Math.PI / 4,
  /** Дальность зрения, метры. */
  range: 14,
  /**
   * Пауза между «попал в конус» и началом заполнения шкалы, секунды.
   *
   * Без неё игрок, мелькнувший в углу конуса на два кадра, уже подозрителен —
   * и это читается как несправедливость, а не как сложность.
   */
  grace: 0.25,
  /** Частота дорогого рейкаста на охранника, Гц. */
  rayHz: 10,
} as const;

/** Радиус слышимости действия, метры. */
export const NOISE = {
  sneak: 0,
  walk: 3.5,
  run: 9,
  gunshot: 22,
} as const;

/** Во сколько раз медленнее копится подозрение в тени. */
export const SHADOW_FACTOR = 2.5;

export type GuardState = 'patrol' | 'suspicious' | 'investigating' | 'alerted';

/**
 * Дешёвая проверка: цель в секторе и в пределах дальности.
 *
 * Вызывается КАЖДЫЙ кадр для каждого охранника — это скалярное произведение,
 * а не рейкаст. Дорогая проверка препятствий запускается только после того,
 * как эта вернула `true` (knowledge/mechanics/stealth_detection.md §2).
 *
 * @param facing направление взгляда, радианы (0 = +Z)
 */
export function inVisionCone(
  dx: number, dz: number, facing: number,
  range = VISION.range, halfAngle = VISION.halfAngle,
): boolean {
  const distSq = dx * dx + dz * dz;
  if (distSq > range * range) return false;
  if (distSq < 1e-6) return true;
  const dist = Math.sqrt(distSq);
  const cos = (Math.sin(facing) * dx + Math.cos(facing) * dz) / dist;
  return cos >= Math.cos(halfAngle);
}

/**
 * Скорость набора подозрения, процентов в секунду.
 *
 * Ближе — быстрее, в тени — медленнее. Линейная зависимость от дистанции
 * (а не ступенька «видит/не видит») даёт игроку читаемую обратную связь:
 * отойти на два шага реально помогает.
 */
export function suspicionRate(distance: number, inShadow: boolean, range = VISION.range): number {
  const closeness = 1 - 0.6 * Math.min(distance / range, 1);
  return (60 * closeness) / (inShadow ? SHADOW_FACTOR : 1);
}

/** Секунд до полной тревоги при непрерывном наблюдении. */
export function timeToAlert(distance: number, inShadow: boolean): number {
  return VISION.grace + 100 / suspicionRate(distance, inShadow);
}

/** Слышно ли действие с такого расстояния. */
export function isAudible(distance: number, noiseRadius: number): boolean {
  return distance <= noiseRadius;
}

/**
 * Шкала подозрения одного охранника.
 *
 * Отдельный класс, а не поле в охраннике: состояние обнаружения — это то, что
 * чаще всего ломается при рефакторинге ИИ, и его удобно проверять отдельно.
 */
export class SuspicionGauge {
  /** 0..100. */
  value = 0;
  state: GuardState = 'patrol';
  /** Сколько секунд цель уже в конусе (для grace period). */
  private seenFor = 0;

  reset(): void {
    this.value = 0;
    this.state = 'patrol';
    this.seenFor = 0;
  }

  /**
   * Кадр наблюдения.
   *
   * @param visible прошли ли ОБЕ проверки: конус и рейкаст
   * @param heard   услышан ли шум в этот кадр
   */
  update(dt: number, visible: boolean, distance: number, inShadow: boolean, heard = false): GuardState {
    if (visible) {
      this.seenFor += dt;
      // Grace period: первые кадры в конусе не заполняют шкалу.
      if (this.seenFor > VISION.grace) {
        this.value += suspicionRate(distance, inShadow) * dt;
      }
    } else {
      this.seenFor = 0;
      // Шум не поднимает тревогу до максимума — только переводит в поиск.
      if (heard) this.value = Math.max(this.value, 45);
      else this.value -= 25 * dt;
    }
    this.value = Math.max(0, Math.min(100, this.value));

    // Гистерезис: из тревоги охранник выходит не на том же пороге, на котором
    // вошёл, иначе на границе он мигает между состояниями каждый кадр.
    if (this.value >= 100) this.state = 'alerted';
    else if (this.state === 'alerted' && this.value > 55) this.state = 'alerted';
    else if (this.value > 40) this.state = 'investigating';
    else if (this.value > 5) this.state = 'suspicious';
    else this.state = 'patrol';
    return this.state;
  }
}

/**
 * Бюджет дорогих проверок за секунду при двухступенчатой фильтрации.
 *
 * Считает, сколько рейкастов в секунду сделают `guards` охранников, если
 * доля `coneHitShare` времени цель находится в конусе. Нужен для честного
 * ответа на вопрос «сколько это стоит», а не «вроде быстро».
 */
export function raycastBudget(guards: number, coneHitShare: number): number {
  return guards * VISION.rayHz * coneHitShare;
}
