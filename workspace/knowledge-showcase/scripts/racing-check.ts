/**
 * Головная проверка гонки: бот проезжает круги без рендерера.
 *
 * CRITICAL_RULES §66. Ловит «бот вылетает в первом же повороте» и «трасса
 * скручена» за секунды вместо десяти минут смотрения в экран.
 * Запуск: `npx tsx scripts/racing-check.ts`
 */
import * as THREE from 'three';
import { RaceTrack, CHECKPOINTS, defaultTrackPoints } from '../src/game/raceTrack';
import { ArcadeCar, DEFAULT_TUNING, rubberBandFactor, cornerSpeed } from '../src/game/arcadeCar';
import { driveBot } from '../src/game/botDriver';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

const track = new RaceTrack(defaultTrackPoints());
console.log(`Трасса: длина ${track.length.toFixed(1)} м, ${CHECKPOINTS} чекпойнтов,`
  + ` шаг ${track.checkpointSpacing.toFixed(1)} м`);

// ─────────────────────────────────────────────────── геометрия трассы
check('трасса замкнута', track.curve.closed);
check('длина трассы разумна (200..1500 м)', track.length > 200 && track.length < 1500,
  `= ${track.length.toFixed(0)}`);

let minHw = Infinity, maxHw = 0;
for (let i = 0; i < 200; i++) {
  const hw = track.halfWidthAt(i / 200);
  minHw = Math.min(minHw, hw); maxHw = Math.max(maxHw, hw);
}
check('ширина переменная (шпильки шире прямых)', maxHw - minHw > 0.5,
  `= ${minHw.toFixed(1)}..${maxHw.toFixed(1)}`);

// Репер не должен переворачиваться: соседние «right» смотрят в одну сторону.
let flips = 0;
const prev = new THREE.Vector3();
const cur = new THREE.Vector3();
track.rightAt(0, prev);
for (let i = 1; i < 400; i++) {
  track.rightAt(i / 400, cur);
  if (prev.dot(cur) < 0) flips++;
  prev.copy(cur);
}
check('репер полотна не переворачивается', flips === 0, `переворотов: ${flips}`);

// Гоночная линия смещена внутрь поворотов, а не совпадает с осевой.
let maxOffset = 0;
for (let i = 0; i < 200; i++) maxOffset = Math.max(maxOffset, Math.abs(track.racingOffsetAt(i / 200)));
check('гоночная линия отличается от осевой', maxOffset > 0.15, `max |offset| = ${maxOffset.toFixed(2)}`);

// ─────────────────────────────────────────────────── заезд бота
const car = new ArcadeCar();
const slot = track.gridSlot(0);
car.reset(slot.pos.x, slot.pos.z, Math.atan2(slot.heading.x, slot.heading.z));

let t = track.nearestT(new THREE.Vector3(car.x, 0, car.z));
let cp = CHECKPOINTS - 1;
let laps = 0;
let offTrackFrames = 0;
let maxOffTrack = 0;
let lapFrames: number[] = [];
let frameOfLastLap = 0;

const DT = 1 / 60;
const MAX_FRAMES = 60 * 240;      // 4 минуты симуляции
const pos = new THREE.Vector3();
const sample = { point: new THREE.Vector3(), tangent: new THREE.Vector3(), right: new THREE.Vector3(), halfWidth: 8 };

for (let frame = 0; frame < MAX_FRAMES && laps < 3; frame++) {
  const input = driveBot(track, car, { t, laneBias: 0, maxSpeed: DEFAULT_TUNING.maxSpeed });
  car.step(DT, input, 'asphalt');

  pos.set(car.x, 0, car.z);
  t = track.nearestT(pos, t);

  track.sample(t, sample);
  const off = Math.abs((car.x - sample.point.x) * sample.right.x + (car.z - sample.point.z) * sample.right.z);
  if (off > sample.halfWidth) { offTrackFrames++; maxOffTrack = Math.max(maxOffTrack, off - sample.halfWidth); }

  const next = (cp + 1) % CHECKPOINTS;
  if (track.checkpoints[next].distanceTo(pos) < track.checkpointSpacing * 0.9) {
    cp = next;
    if (next === 0) {
      // Первое пересечение — это старт круга, а не завершённый круг.
      if (frameOfLastLap > 0 || laps > 0) lapFrames.push(frame - frameOfLastLap);
      if (frameOfLastLap > 0) laps++;
      frameOfLastLap = frame;
    }
  }
}

console.log(`\nЗаезд: кругов ${laps}, времена ${lapFrames.map((f) => (f / 60).toFixed(1) + ' с').join(', ')}`);
console.log(`Вне полотна: ${(offTrackFrames / 60).toFixed(1)} с, максимальный вылет ${maxOffTrack.toFixed(1)} м`);

console.log('\nПроверки:');
check('бот проехал 3 круга', laps >= 3, `= ${laps}`);
check('бот держится трассы (вылет < 4 м)', maxOffTrack < 4, `= ${maxOffTrack.toFixed(1)} м`);
check('время вне полотна < 15 % заезда', offTrackFrames < frameOfLastLap * 0.15,
  `= ${offTrackFrames} кадров из ${frameOfLastLap}`);
check('круг быстрее 90 с', lapFrames.every((f) => f < 60 * 90),
  `= ${lapFrames.map((f) => (f / 60).toFixed(1)).join(', ')}`);
check('круги стабильны (разброс < 25 %)',
  lapFrames.length >= 2 && Math.max(...lapFrames) / Math.min(...lapFrames) < 1.25,
  `= ${(Math.max(...lapFrames) / Math.min(...lapFrames)).toFixed(2)}`);

// ─────────────────────────────────────────────────── резинка и физика
check('резинка не выходит за −8 %', rubberBandFactor(-999) === -0.08);
check('резинка не выходит за +12 %', rubberBandFactor(999) === 0.12);
check('без разрыва резинка нейтральна', rubberBandFactor(0) === 0);
check('скорость в повороте растёт с радиусом',
  cornerSpeed(80, 16) > cornerSpeed(20, 16));

const straight = new ArcadeCar();
straight.reset(0, 0, 0);
for (let i = 0; i < 180; i++) straight.step(DT, { throttle: 1, brake: 0, steer: 0, handbrake: false });
check('машина разгоняется', straight.speed > 20, `= ${(straight.speed * 3.6).toFixed(0)} км/ч`);
check('машина едет вперёд, а не назад', straight.z > 0, `z = ${straight.z.toFixed(1)}`);

const drifting = new ArcadeCar();
drifting.reset(0, 0, 0);
for (let i = 0; i < 120; i++) drifting.step(DT, { throttle: 1, brake: 0, steer: 0, handbrake: false });
for (let i = 0; i < 60; i++) drifting.step(DT, { throttle: 1, brake: 0, steer: 1, handbrake: true });
check('ручник даёт занос', drifting.slipAngle > 0.15, `= ${drifting.slipAngle.toFixed(2)} рад`);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
