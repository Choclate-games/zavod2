/**
 * Числа игры. Единственный источник — balance.yaml в корне проекта;
 * здесь они превращены в типизированные константы. Литералы баланса
 * в остальном коде запрещены — правка баланса не должна быть правкой логики.
 */

export const BALANCE = {
  session: {
    /** Длительность дубля, с (верхняя граница окна 90–120 с). */
    timeLimitS: 120,
    pointsTotal: 4,
    transitionsTotal: 3,
    saboteursTotal: 6,
    /** Зарядов саботажников до провала и попаданий до провала. */
    maxCharges: 3,
    maxPlayerHits: 3,
    /** Пирозаряд активируется, если саботажник дошёл до станции и пилил её столько секунд. */
    chargeArmS: 4,
  },
  vystrelMontazh: {
    /** Дальність луча, м. */
    rayRangeM: 80,
    /** Радиус зоны хедшота, м. */
    headshotRadiusM: 0.22,
    /** Радиус узла цепной декорации, м. */
    nodeRadiusM: 0.18,
    /** Интервал между выстрелами, с. */
    shotIntervalS: 0.28,
    /** Сдвиг камеры от отдачи, градусы. */
    recoilKickDeg: 4,
    /** Возврат камеры после отдачи, с. */
    recoilReturnS: 0.2,
    /** Высота центра головы саботажника над полом, м. */
    headHeightM: 1.62,
    /** Полувысота/полуширина корпуса саботажника для попадания, м. */
    bodyHalfWidthM: 0.34,
    bodyHalfHeightM: 0.55,
    bodyCenterHeightM: 0.95,
  },
  emkostDublya: {
    startCapacity: 6,
    minCapacity: 1,
    /** Штраф за промах: минус патрон вместимости. */
    missCapacityPenalty: 1,
    startAmmo: 6,
    minAmmoToWin: 1,
  },
  tsepnayaDekoratsiya: {
    minLinks: 2,
    maxLinks: 4,
    /** Импульс разрушения звена, м/с. */
    impulseMs: 7.5,
    /** Задержка передачи силы соседнему звену, с. */
    forceDelayS: 0.35,
    /** Ширина создаваемого падением укрытия, м. */
    coverWidthM: 2.4,
    /** Блокировка маршрута неверным падением, с. */
    wrongFallBlockS: 3.5,
  },
  svetovoyBloking: {
    earlyWarningS: 0.85,
    lateWarningS: 0.35,
    coneAngleDeg: 28,
    expandedViewDeg: 110,
    secondEntryDelayS: 0.7,
    safeTransitionWindowS: 0.9,
    spotlightFallTimeS: 0.65,
  },
  player: {
    eyeHeightM: 1.6,
    moveSpeedMs: 4.2,
    aimFovDeg: 56,
    zoomFovDeg: 32,
    radiusM: 0.38,
  },
  saboteur: {
    runSpeedMs: 2.6,
    /** Время реакции перед первым выстрелом по игроку, с. */
    reactionTimeS: 0.9,
    /** Пауза между выстрелами саботажника, с. */
    fireCooldownS: 2.4,
    /** Промах первой очередью: первый выстрел саботажника всегда мимо. */
    firstShotMiss: true,
    /** Одновременно стреляют не больше двух саботажников (токены атаки). */
    maxSimultaneousAttackers: 2,
    corpseLifetimeS: 6,
  },
  rating: {
    completionBase: 1000,
    perSecondLeft: 8,
    perHeadshot: 120,
    perHitMarkPenalty: 180,
    headshotAccuracyWeight: 1.5,
  },
  performance: {
    targetFps: 60,
    maxDrawCalls: 80,
    maxTriangles: 45000,
    bundleBudgetMb: 4.5,
    /** Фиксированный шаг физики, с. */
    fixedStepS: 1 / 60,
    maxFrameDtS: 0.1,
  },
} as const
