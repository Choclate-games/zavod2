/**
 * Головная проверка забега survivor: кривая опыта, пул карточек, баланс.
 *
 * CRITICAL_RULES §66. Баланс survivor-игры невозможно проверить глазами: чтобы
 * узнать, доживает ли игрок до десятой минуты, нужно сыграть десять минут — и
 * так после каждой правки числа. Головной прогон делает это за миллисекунды.
 *
 * Запуск: `npx tsx scripts/survivor-check.ts`
 */
import {
  BASE_STATS, RunState, UPGRADES, hordeAt, killsPerSecond, makeRng, ringCapacity,
  xpForKill, xpForLevel,
} from '../src/game/survivorRun';

let failed = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

console.log('Кривая опыта:');
let monotonic = true;
for (let l = 1; l < 40; l++) if (xpForLevel(l + 1) <= xpForLevel(l)) monotonic = false;
check('стоимость уровня строго растёт', monotonic);
let toL20 = 0;
for (let l = 1; l < 20; l++) toL20 += xpForLevel(l);
check('20-й уровень стоит 800..3000 кристаллов', toL20 >= 800 && toL20 <= 3000, `= ${toL20}`);

console.log('\nПул карточек:');
const hand = new RunState(makeRng(7)).draw(3);
check('раздача даёт 3 карты', hand.length === 3, `= ${hand.length}`);
check('в раздаче нет дублей', new Set(hand.map((c) => c.id)).size === hand.length);

// Карта с требованием не появляется, пока требование не выполнено.
let sawLocked = false;
for (let i = 0; i < 400; i++) {
  const fresh = new RunState(makeRng(i));
  for (const c of fresh.draw(3)) {
    if (c.requires && (fresh.taken.get(c.requires) ?? 0) === 0) sawLocked = true;
  }
}
check('карта с требованием не выпадает раньше требования', sawLocked === false);

const a = new RunState(makeRng(42)).draw(3).map((c) => c.id).join(',');
const b = new RunState(makeRng(42)).draw(3).map((c) => c.id).join(',');
check('раздача детерминирована по seed', a === b, `${a} против ${b}`);

// Выкачать всё: раздача обязана деградировать, а не зациклиться и не задублить.
const maxed = new RunState(makeRng(3));
let guard = 0;
let sawShortHand = false;
let sawDuplicate = false;
while (guard++ < 200) {
  const cards = maxed.draw(3);
  if (cards.length === 0) break;
  if (cards.length < 3) sawShortHand = true;
  if (new Set(cards.map((c) => c.id)).size !== cards.length) { sawDuplicate = true; break; }
  for (const c of cards) if (maxed.available(c)) { maxed.take(c); break; }
}
const totalStacks = UPGRADES.reduce((n, c) => n + c.maxStacks, 0);
const takenTotal = [...maxed.taken.values()].reduce((n, v) => n + v, 0);
check('пул исчерпаем за конечное число выборов', guard < 200, `итераций: ${guard}`);
check('раздача не дублирует карты при исчерпании пула', sawDuplicate === false);
check('перед исчерпанием раздача укорачивается', sawShortHand);
check('взято ровно столько карт, сколько позволяют стеки', takenTotal === totalStacks,
  `${takenTotal} из ${totalStacks}`);
let overStack = false;
for (const card of UPGRADES) if ((maxed.taken.get(card.id) ?? 0) > card.maxStacks) overStack = true;
check('лимиты стеков соблюдены', overStack === false);
console.log(`  (выкачанный билд: DPS по одной цели ${maxed.singleTargetDps.toFixed(0)}`
  + `, кольцо ${ringCapacity(maxed.stats)} целей, HP ${maxed.stats.maxHp})`);

console.log('\nДва уровня с одного подбора:');
const jump = new RunState(makeRng(1));
const levels = jump.addXp(xpForLevel(1) + xpForLevel(2) + 1);
check('пачка опыта даёт оба уровня, а не один', levels === 2, `= ${levels}`);
check('невыбранные карты копятся', jump.pendingLevels === 2, `= ${jump.pendingLevels}`);

console.log('\nБаланс забега (модель killsPerSecond: стрельба по одному + клинки по кольцу):');

/** Предельное число врагов на экране — тот же потолок, что в демо. */
const MAX_ENEMIES = 1200;

interface Mark {
  t: number;
  /** Фактические убийства в секунду в этот момент. */
  kps: number;
  /**
   * Пропускная способность: сколько игрок УБИЛ БЫ при плотной толпе.
   *
   * Именно она сравнивается со спавном. Фактический `kps` для этого не годится:
   * пока игрок справляется, он равен спавну по определению, а сразу после
   * зачистки экрана проваливается в ноль — метрика мерила бы момент замера,
   * а не силу билда.
   */
  cap: number;
  spawn: number; level: number; dps: number; ring: number; alive: number;
}

const DAMAGE_CARDS = ['might', 'rapid', 'multishot', 'orbit', 'edge', 'area'];

/**
 * Как игрок выбирает карту из раздачи.
 *
 * `sensible` — то, что делает живой человек: видит, что орда наступает, и
 * берёт урон. `random` — жмёт наугад. Разница между ними и есть ответ на
 * вопрос «решает ли что-нибудь выбор карточек»; проверять забег только на
 * случайном выборе бессмысленно — он мерит удачу, а не дизайн.
 */
type Policy = 'sensible' | 'random';

/**
 * Прогон забега на 20 минут.
 *
 * `allow` ограничивает выбор карт: так проверяется, что урон вообще решает.
 * Игрок, берущий только «полезности» (скорость, магнит, HP), обязан быть
 * погребён ордой — иначе выбор карточек это украшение, а не механика.
 */
function simulate(seed: number, allow?: (id: string) => boolean, policy: Policy = 'sensible'): Mark[] {
  const state = new RunState(makeRng(seed));
  const rng = makeRng(seed * 31 + 7);
  const dt = 1;
  const marks: Mark[] = [];
  let alive = 0;
  for (let t = 0; t < 1200; t += dt) {
    state.time = t;
    const horde = hordeAt(t);
    alive = Math.min(MAX_ENEMIES, alive + horde.spawnRate * dt);
    const kps = Math.min(killsPerSecond(state.stats, horde.hp, alive), alive / dt);
    alive = Math.max(0, alive - kps * dt);
    state.kills += kps * dt;
    state.addXp(kps * dt * xpForKill(false) * (1 + horde.eliteShare * 2));
    while (state.pendingLevels > 0) {
      const cards = state.draw(3).filter((c) => !allow || allow(c.id));
      if (cards.length === 0) { state.pendingLevels--; continue; }
      const damage = cards.filter((c) => DAMAGE_CARDS.includes(c.id));
      const capacity = killsPerSecond(state.stats, horde.hp, MAX_ENEMIES);
      const pool = policy === 'sensible' && capacity < horde.spawnRate * 2 && damage.length > 0
        ? damage
        : cards;
      state.take(pool[Math.floor(rng() * pool.length)]);
    }
    if (t % 60 === 0) {
      marks.push({
        t, kps, cap: killsPerSecond(state.stats, horde.hp, MAX_ENEMIES),
        spawn: horde.spawnRate, level: state.level,
        dps: state.singleTargetDps, ring: ringCapacity(state.stats), alive,
      });
    }
  }
  return marks;
}

const marks = simulate(11);
for (const m of marks) {
  if (m.t % 180 !== 0) continue;
  console.log(
    `  ${String(m.t / 60).padStart(2)} мин: уровень ${String(m.level).padStart(2)}`
    + `  DPS ${String(Math.round(m.dps)).padStart(5)}`
    + `  кольцо ${String(m.ring).padStart(2)}`
    + `  потолок ${m.cap.toFixed(0).padStart(4)}/с`
    + `  спавн ${m.spawn.toFixed(1).padStart(5)}/с`
    + `  на экране ${Math.round(m.alive)}`,
  );
}

const at = (t: number): Mark => marks.find((m) => m.t === t)!;

// Форма забега: игрок, который берёт карты, обязан держать орду всю дистанцию.
for (const minute of [1, 5, 12]) {
  const m = at(minute * 60);
  check(`${minute}-я минута: игрок держит орду`, m.cap >= m.spawn,
    `потолок ${m.cap.toFixed(1)}/с против спавна ${m.spawn.toFixed(1)}/с`);
}

// Толпа не должна упираться в потолок пула: если упирается, сложность задаёт
// лимит массива, а не дизайн, и кривая спавна дальше ни на что не влияет.
const peak = Math.max(...marks.map((m) => m.alive));
check('орда не упирается в потолок пула', peak < MAX_ENEMIES * 0.9,
  `пик ${Math.round(peak)} из ${MAX_ENEMIES}`);

// Урон обязан решать: билд без единой боевой карты хоронит забег.
const utility = simulate(11, (id) => ['boots', 'magnet', 'vitality', 'regen'].includes(id));
const utilityAt8 = utility.find((m) => m.t === 480)!;
check('билд без урона тонет к 8-й минуте', utilityAt8.cap < utilityAt8.spawn,
  `потолок ${utilityAt8.cap.toFixed(1)}/с против спавна ${utilityAt8.spawn.toFixed(1)}/с,`
  + ` на экране ${Math.round(utilityAt8.alive)}`);

check('к 5-й минуте выбрано минимум 8 карт', at(300).level >= 9, `уровень ${at(300).level}`);

// Устойчивость к раздаче: осмысленный игрок не должен зависеть от везения.
let worst = Infinity;
let worstSeed = 0;
for (let seed = 1; seed <= 40; seed++) {
  const m5 = simulate(seed).find((m) => m.t === 300)!;
  if (m5.cap / m5.spawn < worst) { worst = m5.cap / m5.spawn; worstSeed = seed; }
}
check('на 40 раздачах осмысленный игрок держит 5-ю минуту', worst >= 1,
  `худший запас ${(worst * 100).toFixed(0)}% (seed ${worstSeed})`);

// Игрок, жмущий наугад, обязан отставать — но не умирать мгновенно. Если
// случайный выбор идёт наравне с осмысленным, карточки ничего не решают.
let worstRandom = Infinity;
let avgRandom = 0;
for (let seed = 1; seed <= 40; seed++) {
  const m5 = simulate(seed, undefined, 'random').find((m) => m.t === 300)!;
  const ratio = m5.cap / m5.spawn;
  worstRandom = Math.min(worstRandom, ratio);
  avgRandom += ratio / 40;
}
check('случайный выбор карт заметно слабее осмысленного', avgRandom < worst,
  `наугад в среднем ${(avgRandom * 100).toFixed(0)}%, осмысленно минимум ${(worst * 100).toFixed(0)}%`);
// Нижняя граница: даже самая неудачная случайная раздача оставляет игроку
// четверть нужной пропускной способности. Ниже — значит в пуле слишком много
// карт, которые не влияют на выживание, и забег решает не игрок, а раздача.
check('худшая случайная раздача оставляет хотя бы четверть потолка', worstRandom >= 0.25,
  `худший запас ${(worstRandom * 100).toFixed(0)}%`);

console.log('\nСтартовые статы:');
console.log(`  DPS ${(BASE_STATS.damage * BASE_STATS.fireRate).toFixed(0)}`
  + `, HP ${BASE_STATS.maxHp}, магнит ${BASE_STATS.magnet} м, скорость ${BASE_STATS.moveSpeed} м/с`);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
