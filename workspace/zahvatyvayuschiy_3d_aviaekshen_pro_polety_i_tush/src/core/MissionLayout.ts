/**
 * Плоские данные миссии: очаги пожара вдоль русла каньона. Читаются и рендером
 * (расстановка мешей), и логикой (проверка попадания сброса) — без THREE-типов.
 */

export interface FireTarget {
  /** Смещение вбок от оси реки, метры. */
  offsetX: number
  /** Дистанция по реке от старта, метры. */
  distanceM: number
  /** Сколько литров нужно для ликвидации. */
  requiredWaterL: number
}

export const FIRES: readonly FireTarget[] = [
  { offsetX: -12, distanceM: 900, requiredWaterL: 2600 },
  { offsetX: 10, distanceM: 1900, requiredWaterL: 3200 },
  { offsetX: -6, distanceM: 2900, requiredWaterL: 4200 },
]

/** Радиус поражения сброса вдоль реки, метры (половина пятна водяного удара). */
export const DROP_HIT_HALF_LENGTH_M = 16

/** Высота, выше которой сброс размазывается и не тушит очаг. */
export const DROP_MAX_ALTITUDE_M = 45

/** Стартовая высота вылета над водой, метры. */
export const START_ALTITUDE_M = 28

/** Боковые границы русла, в которых ещё можно глиссировать, метры. */
export const RIVER_HALF_WIDTH_M = 26
