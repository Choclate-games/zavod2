/**
 * Головная проверка стелса: конус, шкала подозрения, шум, бюджет рейкастов.
 *
 * CRITICAL_RULES §66. «Стелс ощущается нечестным» — это всегда конкретное
 * число: слишком быстрая шкала, отсутствие grace period или порог, на котором
 * охранник мигает между состояниями. Всё это проверяется без рендерера.
 *
 * Запуск: `npx tsx scripts/stealth-check.ts`
 */
import {
  NOISE, SHADOW_FACTOR, SuspicionGauge, VISION, inVisionCone, isAudible,
  raycastBudget, suspicionRate, timeToAlert,
} from '../src/game/stealthSensing';

let failed = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

console.log('Конус зрения:');
check('цель прямо перед охранником — в конусе', inVisionCone(0, 5, 0));
check('цель за спиной — вне конуса', inVisionCone(0, -5, 0) === false);
check('цель сбоку под 90° — вне конуса', inVisionCone(5, 0, 0) === false);
check('цель дальше дальности — вне конуса', inVisionCone(0, VISION.range + 1, 0) === false);
// Границы сектора.
const inside = VISION.halfAngle - 0.02;
const outside = VISION.halfAngle + 0.02;
check('цель у самого края сектора — в конусе',
  inVisionCone(Math.sin(inside) * 6, Math.cos(inside) * 6, 0));
check('цель чуть за краем сектора — вне конуса',
  inVisionCone(Math.sin(outside) * 6, Math.cos(outside) * 6, 0) === false);
// Конус поворачивается вместе с охранником.
check('конус поворачивается вместе с охранником', inVisionCone(6, 0, Math.PI / 2));

console.log('\nВремя до тревоги:');
for (const d of [2, 7, 14]) {
  console.log(`  ${String(d).padStart(2)} м: на свету ${timeToAlert(d, false).toFixed(2)} с`
    + `, в тени ${timeToAlert(d, true).toFixed(2)} с`);
}
// Игрок обязан успеть среагировать: минимум секунда даже в упор.
check('в упор на свету обнаружение занимает >= 1 с', timeToAlert(0.5, false) >= 1,
  `= ${timeToAlert(0.5, false).toFixed(2)} с`);
// Но и не бесконечность: стоять в конусе на краю дальности нельзя вечно.
check('на краю дальности тревога наступает за <= 8 с', timeToAlert(VISION.range, false) <= 8,
  `= ${timeToAlert(VISION.range, false).toFixed(2)} с`);
// Ближе — быстрее, строго монотонно.
let monotonic = true;
for (let d = 0; d < VISION.range; d += 0.5) {
  if (suspicionRate(d + 0.5, false) > suspicionRate(d, false)) monotonic = false;
}
check('чем ближе, тем быстрее растёт подозрение', monotonic);
// Тень обязана быть значимой, а не косметической.
check(`в тени обнаружение медленнее ровно в ${SHADOW_FACTOR} раза`,
  Math.abs(timeToAlert(5, true) - VISION.grace - (timeToAlert(5, false) - VISION.grace) * SHADOW_FACTOR) < 1e-9);

console.log('\nGrace period:');
const grace = new SuspicionGauge();
// Мелькнуть в конусе на 0.2 с — шкала не должна сдвинуться.
for (let i = 0; i < 12; i++) grace.update(1 / 60, true, 5, false);
check(`${(12 / 60).toFixed(2)} с в конусе не поднимают шкалу (grace ${VISION.grace} с)`,
  grace.value === 0, `= ${grace.value.toFixed(1)}`);
for (let i = 0; i < 12; i++) grace.update(1 / 60, true, 5, false);
check('после grace period шкала растёт', grace.value > 0, `= ${grace.value.toFixed(1)}`);
// Потеря цели сбрасывает накопленное время наблюдения.
grace.update(1 / 60, false, 5, false);
const before = grace.value;
for (let i = 0; i < 12; i++) grace.update(1 / 60, true, 5, false);
check('после потери цели grace period отсчитывается заново', grace.value <= before,
  `${before.toFixed(1)} → ${grace.value.toFixed(1)}`);

console.log('\nСостояния и гистерезис:');
const g = new SuspicionGauge();
let seconds = 0;
while (g.state !== 'alerted' && seconds < 20) { g.update(1 / 60, true, 3, false); seconds += 1 / 60; }
check('охранник доходит до тревоги', g.state === 'alerted', `за ${seconds.toFixed(2)} с`);
// Выход из тревоги — не на том же пороге, иначе состояние мигает.
g.update(1 / 60, false, 3, false);
check('на 99% охранник ещё в тревоге', g.state === 'alerted', `= ${g.value.toFixed(1)}%`);
let flips = 0;
let prev = g.state;
for (let i = 0; i < 60 * 5; i++) {
  // Цель то видна, то нет — ровно тот случай, когда без гистерезиса мигает.
  g.update(1 / 60, i % 4 === 0, 6, false);
  if (g.state !== prev) { flips++; prev = g.state; }
}
check('состояние не мигает при мерцающей видимости', flips <= 3, `переключений: ${flips}`);

// Спад: оставшись один, охранник обязан вернуться в патруль.
const calm = new SuspicionGauge();
calm.value = 100;
calm.state = 'alerted';
let calmSeconds = 0;
while (calm.state !== 'patrol' && calmSeconds < 30) { calm.update(1 / 60, false, 20, false); calmSeconds += 1 / 60; }
check('охранник успокаивается за <= 10 с', calm.state === 'patrol' && calmSeconds <= 10,
  `за ${calmSeconds.toFixed(1)} с`);

console.log('\nШум:');
check('крадущийся игрок не слышен вплотную', isAudible(0.5, NOISE.sneak) === false);
check('шаг слышен в 3 м', isAudible(3, NOISE.walk));
check('шаг не слышен в 5 м', isAudible(5, NOISE.walk) === false);
check('бег слышен в 8 м', isAudible(8, NOISE.run));
check('выстрел слышен дальше дальности зрения', NOISE.gunshot > VISION.range);
// Шум переводит в поиск, но не поднимает полную тревогу.
const noisy = new SuspicionGauge();
noisy.update(1 / 60, false, 10, false, true);
check('шум переводит в investigating, а не в тревогу',
  noisy.state === 'investigating' && noisy.value < 100, `${noisy.state} ${noisy.value.toFixed(0)}%`);

console.log('\nБюджет дорогих проверок:');
// Наивно: рейкаст каждым охранником каждый кадр.
const naive = 8 * 60;
const staged = raycastBudget(8, 0.35);
console.log(`  8 охранников: наивно ${naive} рейкастов/с, двухступенчато ${staged.toFixed(0)}/с`);
check('двухступенчатая фильтрация экономит хотя бы в 10 раз', staged * 10 <= naive,
  `${staged.toFixed(0)} против ${naive}`);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
