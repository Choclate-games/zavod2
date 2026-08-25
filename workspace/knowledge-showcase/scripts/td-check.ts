/**
 * Головная проверка tower defense: 20 волн без рендерера.
 *
 * knowledge/threejs/tower_defense_core.md §5: «волна 12 непроходима» ловится за
 * секунды вместо получаса ручной игры.
 * Запуск: `npx tsx scripts/td-check.ts`
 */
import {
  ENEMIES, TOWERS, applyArmor, buildWave, pickTarget, spawnOrder, upgradeCost,
  upgradedDamage, waveBudget, START_GOLD, type TargetCandidate,
} from '../src/game/towerDefense';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

// ───────────────────────────────────────────────────────── контракт волн
console.log('Волны:');
for (const i of [1, 3, 5, 10, 15, 20]) {
  const w = buildWave(i);
  const composition = w.entries.map((e) => `${e.kind}×${e.count}`).join(', ');
  console.log(`  ${String(i).padStart(2)}: бюджет ${String(w.budget).padStart(5)}`
    + ` · ${composition}${w.newThreat ? `  ← новая угроза: ${w.newThreat}` : ''}`);
}

console.log('\nПроверки:');
check('бюджет растёт нелинейно', waveBudget(20) / waveBudget(10) > 2.2,
  `= ${(waveBudget(20) / waveBudget(10)).toFixed(2)}`);
check('бюджет монотонен', Array.from({ length: 30 }, (_, i) => waveBudget(i + 1))
  .every((v, i, a) => i === 0 || v > a[i - 1]));

const threats = [3, 5, 10, 15].map((i) => buildWave(i).newThreat);
check('каждая веха вводит новый тип угрозы', threats.every((t) => t !== null),
  `= ${threats.join(', ')}`);
check('до 3-й волны только пехота', buildWave(2).entries.every((e) => e.kind === 'grunt'));
check('волна 6 содержит воздух', buildWave(6).entries.some((e) => e.kind === 'flyer'));

// Типы чередуются, а не идут блоками: иначе волна ощущается как три волны.
const order = spawnOrder(buildWave(12));
let blocks = 0;
for (let i = 1; i < order.length; i++) if (order[i] === order[i - 1]) blocks++;
check('типы в волне чередуются', blocks < order.length * 0.5,
  `подряд одинаковых: ${blocks} из ${order.length}`);
check('интервал спавна сокращается с номером', buildWave(20).interval < buildWave(2).interval);
check('интервал не падает ниже 0.28 с', buildWave(60).interval >= 0.28);

// ─────────────────────────────────────────────────────── приоритет целей
const candidates: TargetCandidate[] = [
  { eid: 1, dist: 10, hp: 100, flying: false, d2: 4 },
  { eid: 2, dist: 40, hp: 30, flying: false, d2: 64 },
  { eid: 3, dist: 25, hp: 300, flying: true, d2: 25 },
];
const R = 11;
check("'first' берёт ближайшего к базе", pickTarget('first', R, true, candidates, -1) === 2);
check("'last' берёт хвост", pickTarget('last', R, true, candidates, -1) === 1);
check("'strongest' берёт самого живучего", pickTarget('strongest', R, true, candidates, -1) === 3);
check("'weakest' берёт самого слабого", pickTarget('weakest', R, true, candidates, -1) === 2);
check("'closest' берёт ближайшего к башне", pickTarget('closest', R, true, candidates, -1) === 1);
check('наземная башня игнорирует воздух',
  pickTarget('strongest', R, false, candidates, -1) === 1);
check('гистерезис держит текущую цель',
  pickTarget('first', R, true, candidates, 1) === 1);
check('цель вне радиуса сбрасывается',
  pickTarget('first', 3, true, candidates, 2) === 1);
check('без валидных целей возвращается -1',
  pickTarget('first', 0.5, true, candidates, -1) === -1);

// ────────────────────────────────────────────────────────────── броня
check('броня режет урон', Math.abs(applyArmor(100, 0.55, 0) - 45) < 1e-9);
check('пробитие компенсирует броню', applyArmor(100, 0.55, 0.55) === 100);
check('пробитие сверх брони не усиливает урон', applyArmor(100, 0.2, 0.9) === 100);

// ────────────────────────────────────────────────── улучшения и экономика
const gun = TOWERS.gun;
check('улучшение дороже вдвое', upgradeCost(gun, 1) === gun.cost * 2);
check('улучшение даёт ×1.8 урона',
  Math.abs(upgradedDamage(gun, 1) / gun.damage - 1.8) < 1e-9);
check('улучшение выгоднее второй башни по урону на слот',
  upgradedDamage(gun, 1) > gun.damage * 1.5);

/**
 * Симуляция «разумной стратегии»: перед каждой волной игрок тратит золото —
 * сначала добирает башни до комфортного числа, затем улучшает. Считаем
 * суммарный урон за волну против её суммарного HP.
 */
const MAX_SLOTS = 24;
let gold = START_GOLD;
let towers = 0;
let level = 0;
let firstUnbeatable = 0;
let peakGold = 0;

for (let i = 1; i <= 20; i++) {
  // Фаза постройки ДО волны: игрок строит в паузе, а не после боя.
  let spent = true;
  while (spent) {
    spent = false;
    if (towers < MAX_SLOTS && gold >= TOWERS.gun.cost) { gold -= TOWERS.gun.cost; towers++; spent = true; }
    else if (towers >= 6 && gold >= upgradeCost(TOWERS.gun, level)) {
      gold -= upgradeCost(TOWERS.gun, level); level++; spent = true;
    }
  }

  const w = buildWave(i);
  const waveHp = w.entries.reduce(
    (sum, e) => sum + e.count * ENEMIES[e.kind].hp * (1 + i * 0.06), 0,
  );
  // Только часть башен достаёт до врага одновременно — считаем половину.
  const dps = towers * 0.5 * TOWERS.gun.fireRate * upgradedDamage(TOWERS.gun, level);
  const waveSeconds = w.entries.reduce((n, e) => n + e.count, 0) * w.interval + 6;
  if (dps * waveSeconds < waveHp && firstUnbeatable === 0) firstUnbeatable = i;

  gold += w.entries.reduce((sum, e) => sum + e.count * ENEMIES[e.kind].bounty, 0) + 25 + i * 4;
  peakGold = Math.max(peakGold, gold);
}

console.log(`
Прогон 20 волн «разумной» стратегией: ${towers} башен ур.${level + 1},`
  + ` остаток ${gold} золота (пик ${peakGold})`);
check('20 волн проходимы базовой стратегией', firstUnbeatable === 0,
  `первая непроходимая: ${firstUnbeatable}`);
check('золото тратится, а не копится мёртвым грузом', gold < peakGold * 0.9 || towers >= MAX_SLOTS,
  `остаток ${gold}, пик ${peakGold}`);
check('к 20-й волне игрок вышел на потолок слотов', towers >= 12, `= ${towers}`);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
