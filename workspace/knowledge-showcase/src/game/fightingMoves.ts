/**
 * Фрейм-дата: единственный источник баланса файтинга.
 *
 * knowledge/threejs/fighting_game_core.md §1. Модуль намеренно НЕ импортирует
 * three: он проверяется головно (`npx tsx scripts/fighting-check.ts`) без
 * рендерера — так же, как спецификация транспорта (CRITICAL_RULES §66).
 *
 * Все длительности — в логических кадрах при 60 Гц.
 */

export type MoveId =
  | 'jab' | 'hook' | 'overhand' | 'uppercut' | 'body' | 'sweep'
  | 'frontKick' | 'roundhouse'
  | 'airPunch' | 'airKick';

/** Чем бьют. Определяет и позу (рука или нога), и половину раскладки. */
export type Limb = 'punch' | 'kick';

/** Сила удара: слабый — быстрый и безопасный, сильный — медленный и дорогой. */
export type Strength = 'light' | 'heavy';

/** Куда бьёт приём. Голова уходит от уклона, корпус — от приседа. */
export type Zone = 'head' | 'body';

/**
 * Высота приёма. Три уровня — минимум, при котором прыжок и присед становятся
 * решениями, а не кнопками: низкий бьёт по ногам и не достаёт прыгнувшего,
 * верхний уходит под приседом, средний ловит и того и другого.
 */
export type Height = 'low' | 'mid' | 'high';

/** Какой рукой. Передняя рука быстрее, задняя — тяжелее (стойка боксёра). */
export type Hand = 'lead' | 'rear';

export interface BoxSpec {
  /** Смещение центра вперёд от бойца (умножается на facing). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Move {
  id: MoveId;
  /** Подпись в HUD: [ru, en]. */
  label: readonly [string, string];
  hand: Hand;
  /**
   * Рука или нога. Не украшение: от этого зависит, чем поза машет (см.
   * `FightingDemo.poseStrike`), и на какую половину раскладки приём попадает.
   */
  limb: Limb;
  /**
   * Слабый или сильный. Раскладка — это две кнопки, и приём обязан честно
   * заявить, под какой из них лежит: иначе таблица «кнопка → приём» станет
   * вторым, независимым источником баланса.
   */
  strength: Strength;
  target: Zone;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  /** Урон сквозь блок. */
  chip: number;
  /** Урон по выносливости защищающегося при блоке: так ломается гард. */
  guardDamage: number;
  /** Сколько выносливости стоит сам замах. */
  stamina: number;
  hitstun: number;
  blockstun: number;
  /** Заморозка ОБОИХ бойцов при контакте. */
  hitstop: number;
  /** Откидывание, метров за срабатывание. */
  pushback: number;
  /** Вертикальный импульс: 0 — не подбрасывает. */
  launch: number;
  /**
   * Шаг вперёд за время замаха, метры. Бокс — это вход в дистанцию: удар с
   * места достаёт только того, кто уже стоит вплотную, и нейтраль
   * превращается в переглядывание на расстоянии вытянутой руки.
   */
  advance: number;
  /** Уровень: low — по ногам, high — в голову, mid — везде. */
  height: Height;
  /** Приём выполняется только в прыжке. */
  air: boolean;
  /** Достаёт ли летящего соперника (анти-эйр и удары сверху). */
  hitsAir: boolean;
  /** Сбивает с ног: попадание сразу переводит жертву в нокдаун. */
  knocksDown: boolean;
  /** Во что можно отменить приём при попадании (кадры recovery съедаются). */
  cancelInto: readonly MoveId[];
  hitbox: BoxSpec;
}

/**
 * Именованные приёмы вместо безымянных «лёгкий/средний/тяжёлый»: у ударного
 * боя есть словарь, и он же — обучающий материал. Джеб щупает дистанцию, хук
 * наказывает, оверхенд убивает, апперкот подбрасывает, удар по корпусу
 * выкачивает выносливость и не блокируется верхним гардом.
 *
 * Ноги — вторая половина словаря и вторая половина раскладки. Фронт-кик давит
 * на гард, хайкик сбивает с ног с дистанции, подсечка — то же, но по низу и
 * из приседа. Важно, что у ног ДРУГИЕ ответы: хайкик уходит под приседом,
 * подсечка — под прыжком, и одной кнопкой оба не закроешь.
 */
export const MOVES: Record<MoveId, Move> = {
  jab: {
    id: 'jab',
    label: ['джеб', 'jab'],
    limb: 'punch', strength: 'light',
    hand: 'lead', target: 'head',
    startup: 4, active: 3, recovery: 7,
    damage: 40, chip: 4, guardDamage: 5, stamina: 4,
    hitstun: 14, blockstun: 9, hitstop: 5,
    pushback: 0.06, launch: 0,
    advance: 0.16,
    height: 'high', air: false, hitsAir: false, knocksDown: false,
    cancelInto: ['hook', 'body', 'uppercut'],
    hitbox: { x: 0.72, y: 1.55, w: 0.7, h: 0.34 },
  },
  hook: {
    id: 'hook',
    label: ['хук', 'hook'],
    limb: 'punch', strength: 'heavy',
    hand: 'rear', target: 'head',
    startup: 7, active: 4, recovery: 12,
    damage: 75, chip: 8, guardDamage: 10, stamina: 8,
    hitstun: 19, blockstun: 12, hitstop: 7,
    pushback: 0.11, launch: 0,
    advance: 0.22,
    height: 'high', air: false, hitsAir: false, knocksDown: false,
    cancelInto: ['overhand', 'uppercut'],
    hitbox: { x: 0.85, y: 1.5, w: 0.85, h: 0.45 },
  },
  overhand: {
    id: 'overhand',
    label: ['оверхенд', 'overhand'],
    limb: 'punch', strength: 'heavy',
    hand: 'rear', target: 'head',
    startup: 14, active: 5, recovery: 22,
    damage: 130, chip: 14, guardDamage: 22, stamina: 16,
    hitstun: 26, blockstun: 15, hitstop: 11,
    pushback: 0.2, launch: 0,
    advance: 0.3,
    height: 'high', air: false, hitsAir: false, knocksDown: false,
    cancelInto: [],
    hitbox: { x: 1.0, y: 1.58, w: 1.05, h: 0.6 },
  },
  uppercut: {
    id: 'uppercut',
    label: ['апперкот', 'uppercut'],
    limb: 'punch', strength: 'heavy',
    hand: 'rear', target: 'head',
    startup: 9, active: 4, recovery: 26,
    damage: 100, chip: 10, guardDamage: 16, stamina: 13,
    hitstun: 30, blockstun: 13, hitstop: 9,
    pushback: 0.08, launch: 0.34,
    advance: 0.12,
    height: 'mid', air: false, hitsAir: true, knocksDown: false,
    cancelInto: [],
    hitbox: { x: 0.6, y: 1.42, w: 0.7, h: 1.1 },
  },
  body: {
    id: 'body',
    label: ['по корпусу', 'body shot'],
    limb: 'punch', strength: 'light',
    hand: 'lead', target: 'body',
    startup: 6, active: 3, recovery: 11,
    damage: 55, chip: 6, guardDamage: 18, stamina: 7,
    hitstun: 17, blockstun: 10, hitstop: 6,
    pushback: 0.07, launch: 0,
    advance: 0.24,
    height: 'mid', air: false, hitsAir: false, knocksDown: false,
    cancelInto: ['hook', 'overhand'],
    hitbox: { x: 0.74, y: 1.12, w: 0.78, h: 0.42 },
  },
  /**
   * Подсечка: единственный низкий приём. Сбивает с ног — значит, у прыжка
   * появляется цена, а у сидящего в блоке соперника заканчиваются варианты.
   */
  sweep: {
    id: 'sweep',
    label: ['подсечка', 'sweep'],
    limb: 'kick', strength: 'heavy',
    hand: 'lead', target: 'body',
    startup: 8, active: 4, recovery: 21,
    damage: 60, chip: 6, guardDamage: 14, stamina: 10,
    hitstun: 22, blockstun: 11, hitstop: 8,
    pushback: 0.14, launch: 0,
    advance: 0.26,
    height: 'low', air: false, hitsAir: false, knocksDown: true,
    cancelInto: [],
    hitbox: { x: 0.86, y: 0.34, w: 0.95, h: 0.38 },
  },
  /**
   * Фронт-кик: слабая нога из стойки, прямой удар стопой в корпус.
   *
   * Раньше это был лоу-кик по бедру, и он им остался бы, если бы не мокап:
   * в наборе есть `front_kick`, и это прямой удар стопой на высоту пояса.
   * Приём назван по тому, что видно в кадре, а не наоборот — подгонять
   * анимацию под название значит получить третий источник правды после
   * фрейм-даты и позы.
   *
   * Отсюда и `mid`: прямой в корпус не уходит под приседом, но и
   * прыгнувшего не достаёт. Низкий уровень остался за подсечкой — так у
   * трёх ударов ногами три разные высоты и три разных ответа.
   */
  frontKick: {
    id: 'frontKick',
    label: ['фронт-кик', 'front kick'],
    limb: 'kick', strength: 'light',
    hand: 'lead', target: 'body',
    startup: 6, active: 3, recovery: 13,
    damage: 50, chip: 5, guardDamage: 15, stamina: 6,
    hitstun: 15, blockstun: 9, hitstop: 5,
    pushback: 0.14, launch: 0,
    advance: 0.2,
    height: 'mid', air: false, hitsAir: false, knocksDown: false,
    cancelInto: ['roundhouse', 'sweep'],
    // Коробка стоит там, где реально оказывается стопа: см. замер
    // «стопа доходит до своего хитбокса» в `check:fight-anim`.
    hitbox: { x: 0.86, y: 0.95, w: 0.92, h: 0.5 },
  },
  /**
   * Хайкик с задней ноги: самый дальний и самый дорогой приём на земле.
   * Сбивает с ног, как подсечка, но уходит под приседом — то есть у тяжёлой
   * ноги и у подсечки разные ответы, и выбор между ними что-то значит.
   */
  roundhouse: {
    id: 'roundhouse',
    label: ['хайкик', 'roundhouse'],
    limb: 'kick', strength: 'heavy',
    hand: 'rear', target: 'head',
    startup: 15, active: 5, recovery: 24,
    damage: 120, chip: 12, guardDamage: 24, stamina: 17,
    hitstun: 26, blockstun: 14, hitstop: 12,
    pushback: 0.24, launch: 0,
    advance: 0.28,
    height: 'high', air: false, hitsAir: false, knocksDown: true,
    cancelInto: [],
    // Коробка сидит на реальной стопе: поза доносит её до 1.33 м, и хитбокс
    // на уровне головы (1.5) висел бы выше ноги, которая его «наносит».
    hitbox: { x: 1.06, y: 1.42, w: 1.1, h: 0.55 },
  },
  /** Удар в прыжке: быстрый, чтобы успеть до приземления. */
  airPunch: {
    id: 'airPunch',
    label: ['удар в прыжке', 'air punch'],
    limb: 'punch', strength: 'light',
    hand: 'lead', target: 'head',
    startup: 4, active: 6, recovery: 8,
    damage: 55, chip: 6, guardDamage: 9, stamina: 6,
    hitstun: 18, blockstun: 10, hitstop: 6,
    pushback: 0.08, launch: 0,
    advance: 0,
    height: 'mid', air: true, hitsAir: true, knocksDown: false,
    cancelInto: [],
    hitbox: { x: 0.6, y: 0.9, w: 0.8, h: 0.6 },
  },
  /**
   * Прыжковый ногой: бьёт вниз-вперёд и сбивает с ног. Это и есть «прыжок —
   * не бесплатный проход, а атака», без которой воздух в файтинге пустой.
   */
  airKick: {
    id: 'airKick',
    label: ['нога в прыжке', 'air kick'],
    limb: 'kick', strength: 'heavy',
    hand: 'rear', target: 'body',
    startup: 6, active: 8, recovery: 12,
    damage: 85, chip: 10, guardDamage: 16, stamina: 11,
    hitstun: 24, blockstun: 12, hitstop: 9,
    pushback: 0.18, launch: 0,
    advance: 0,
    height: 'mid', air: true, hitsAir: true, knocksDown: true,
    cancelInto: [],
    hitbox: { x: 0.72, y: 0.55, w: 0.95, h: 0.7 },
  },
};

/**
 * Досягаемость приёма: от центра бойца до дальнего края хитбокса плюс
 * половина корпуса жертвы. Единственное честное число для ИИ — «с какой
 * дистанции этот удар вообще может попасть».
 */
export function reach(move: Move, victimHalfWidth = 0.31): number {
  return move.hitbox.x + move.hitbox.w / 2 + victimHalfWidth + move.advance;
}

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

/**
 * Отмена в связку: только по попаданию и только в разрешённый приём.
 * Отмена по блоку сделала бы блокирующего бесправным — он бы никогда не
 * получал ход обратно.
 */
export function canCancel(from: Move, into: MoveId): boolean {
  return from.cancelInto.includes(into);
}

/**
 * Множитель от выносливости: пустой бак не отнимает управление, но забирает
 * половину урона и делает бойца тяжелее. Так «загнать» соперника становится
 * тактикой, а не просто индикатором.
 */
export function staminaScale(stamina: number, max: number): number {
  return 0.55 + 0.45 * Math.min(1, Math.max(0, stamina / max));
}

/** Состояние защищающегося, от которого зависит, попадёт ли приём вообще. */
export type Defense = 'stand' | 'crouch' | 'slip' | 'air';

/**
 * Уходит ли приём в молоко. Три правила, из которых складывается вся
 * «камень-ножницы-бумага» файтинга:
 *
 * * присед и уклон уводят голову — верхний приём проходит мимо;
 * * низкий приём (подсечка) не достаёт того, кто в воздухе;
 * * летящего вообще берут только анти-эйр и удары сверху (`hitsAir`).
 *
 * Промах — не блок: кадры восстановления остаются целиком, и за него платят.
 */
export function whiffsAgainst(move: Move, defense: Defense): boolean {
  if (defense === 'air') return !move.hitsAir;
  if (move.height === 'low') return false;
  if (move.height === 'high') return defense === 'crouch' || defense === 'slip';
  return false;
}

/** Стойка, из которой нажали кнопку. В воздухе сила удара уже не важна. */
export type Stance = 'stand' | 'crouch' | 'air';

/**
 * Раскладка: две кнопки, два модификатора, десять приёмов.
 *
 * Здесь она живёт целиком и в чистом виде — без `three`, без DOM, без
 * событий мыши. Причина та же, по которой фрейм-дата лежит в этом файле:
 * «какой приём выйдет на эту кнопку» — вопрос баланса, а не ввода. Демо
 * только сообщает, что нажали (`light`/`heavy`, `punch`/`kick`, из какой
 * стойки), и получает `MoveId`; проверить всю раскладку можно головно.
 *
 * |            | слабый (ЛКМ)  | сильный (ПКМ)  |
 * |------------|---------------|----------------|
 * | стоя, рука | джеб          | оверхенд       |
 * | стоя, нога | фронт-кик       | хайкик         |
 * | сидя, рука | по корпусу    | апперкот       |
 * | сидя, нога | фронт-кик       | подсечка       |
 * | в воздухе  | удар с воздуха| нога с воздуха |
 *
 * Хук в таблицу не попал, и это не пропуск: он — связующий приём, из
 * которого собирается связка (см. `resolveCancel`). Прямого «слота» ему бы
 * не хватило всё равно, а как продолжение джеба он на той же кнопке.
 */
export function resolveInput(strength: Strength, limb: Limb, stance: Stance): MoveId {
  if (stance === 'air') return limb === 'kick' ? 'airKick' : 'airPunch';
  if (limb === 'kick') {
    if (strength === 'light') return 'frontKick';
    // Из приседа тяжёлая нога идёт по настилу — это и есть подсечка.
    return stance === 'crouch' ? 'sweep' : 'roundhouse';
  }
  if (stance === 'crouch') return strength === 'light' ? 'body' : 'uppercut';
  return strength === 'light' ? 'jab' : 'overhand';
}

/**
 * Тот же нажим, но внутри окна отмены: связка обязана собираться теми же
 * двумя кнопками, что и одиночные удары.
 *
 * Прямой ответ `resolveInput` в отмену чаще всего не проходит — из джеба
 * оверхенд не отменяется. Поэтому здесь выбор идёт не по таблице, а по
 * списку `cancelInto` самого приёма: берётся продолжение той же конечности,
 * при равенстве — совпадающее по силе. Так «ЛКМ, ПКМ, ПКМ» даёт
 * джеб → хук → оверхенд, и учить отдельную кнопку под хук не нужно.
 *
 * Возвращает `null`, если продолжений нужной конечности нет: тогда отмены
 * не происходит и приём доигрывает восстановление, как и должен.
 */
export function resolveCancel(from: Move, strength: Strength, limb: Limb): MoveId | null {
  const options = from.cancelInto.map((id) => MOVES[id]).filter((m) => m.limb === limb);
  if (options.length === 0) return null;
  const exact = options.find((m) => m.strength === strength);
  return (exact ?? options[0]).id;
}
