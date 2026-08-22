/**
 * Headless test for Web Audio Timing, Beat Sync & Muting.
 * Checks mechanics from knowledge/audio/procedural_sound_synthesizer.md,
 * knowledge/audio/web_audio_and_muting.md, and knowledge/mechanics/rhythm_sync.md.
 *
 * Run: tsx scripts/audio-rhythm-check.ts
 */
import {
  computeBeat,
  computeEffectiveVolume,
  evaluateRhythmHit,
  GOOD_WINDOW,
  PERFECT_WINDOW,
} from '../src/game/rhythmAudio';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

console.log('Расчет долей такта (Beat Calculation):');
const bpm = 120; // 120 BPM = 2 доли в секунду (0.5с на долю)
check('0.0 сек = 0.0 долей', computeBeat(0.0, bpm) === 0.0);
check('0.5 сек = 1.0 доля', computeBeat(0.5, bpm) === 1.0);
check('1.0 сек = 2.0 доли', computeBeat(1.0, bpm) === 2.0);
check('15.0 сек = 30.0 долей', computeBeat(15.0, bpm) === 30.0);

console.log('\nОкна точности попадания в ритм (Accuracy Windows):');
// Доля наступает в t = 1.000 с
// Тест 1: Идеальное попадание (дельта 0.030 с <= 0.065 с)
const r1 = evaluateRhythmHit(1.030, bpm, 0);
check('дельта 30 мс -> PERFECT (+100 очков, комбо 1)', r1.rating === 'PERFECT' && r1.score === 100 && r1.combo === 1);

// Тест 2: Граничное попадание PERFECT (дельта 0.065 с)
const r2 = evaluateRhythmHit(1.065, bpm, 1);
check('дельта 65 мс -> PERFECT (+100 очков, комбо 2)', r2.rating === 'PERFECT' && r2.combo === 2);

// Тест 3: Хорошее попадание GOOD (дельта 0.090 с)
const r3 = evaluateRhythmHit(1.090, bpm, 2);
check('дельта 90 мс -> GOOD (+50 очков, комбо 3)', r3.rating === 'GOOD' && r3.score === 50 && r3.combo === 3);

// Тест 4: Граничное попадание GOOD (дельта 0.140 с)
const r4 = evaluateRhythmHit(1.140, bpm, 3);
check('дельта 140 мс -> GOOD', r4.rating === 'GOOD');

// Тест 5: Промах MISS (дельта 0.160 с > 0.140 с)
const r5 = evaluateRhythmHit(1.160, bpm, 15);
check('дельта 160 мс -> MISS (сброс комбо в 0)', r5.rating === 'MISS' && r5.combo === 0 && r5.score === 0);

console.log('\nМножители комбо:');
const c9 = evaluateRhythmHit(1.0, bpm, 9);
check('комбо 10 -> множитель 1.5x (очки 150)', c9.multiplier === 1.5 && c9.score === 150);

const c24 = evaluateRhythmHit(1.0, bpm, 24);
check('комбо 25 -> множитель 2.0x (очки 200)', c24.multiplier === 2.0 && c24.score === 200);

const c49 = evaluateRhythmHit(1.0, bpm, 49);
check('комбо 50 -> множитель 3.0x (очки 300)', c49.multiplier === 3.0 && c49.score === 300);

console.log('\nТаблица истинности системы глушения звука (Dual Mute Gate):');
const baseVol = 0.7;
check('все включено -> громкость 0.7', computeEffectiveVolume({ userMuted: false, platformMuted: false, tabHidden: false, masterVolume: baseVol }) === baseVol);
check('пользователь замьютил -> тишина (< 0.001)', computeEffectiveVolume({ userMuted: true, platformMuted: false, tabHidden: false, masterVolume: baseVol }) < 0.001);
check('платформа замьютила (реклама) -> тишина', computeEffectiveVolume({ userMuted: false, platformMuted: true, tabHidden: false, masterVolume: baseVol }) < 0.001);
check('вкладка скрыта (visibilitychange) -> тишина', computeEffectiveVolume({ userMuted: false, platformMuted: false, tabHidden: true, masterVolume: baseVol }) < 0.001);
check('возврат из рекламы не размьючивает пользователя, если он сам нажал mute',
  computeEffectiveVolume({ userMuted: true, platformMuted: false, tabHidden: false, masterVolume: baseVol }) < 0.001);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
