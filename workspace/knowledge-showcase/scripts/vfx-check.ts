/**
 * Headless test for Instanced Particle VFX Pool & Juice.
 * Checks mechanics from knowledge/threejs/juice_and_vfx_pool.md.
 *
 * Run: tsx scripts/vfx-check.ts
 */
import {
  CameraTraumaSystem,
  ParticlePoolSystem,
} from '../src/game/vfxJuice';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

console.log('Пул частиц (1000+ элементов без аллокаций):');
const pool = new ParticlePoolSystem(1000);
check('пул инициализирует ровно 1000 слотов', pool.particles.length === 1000);
check('все слоты изначально неактивны', pool.particles.every((p) => !p.active));

const spawned = pool.emitBurst(0, 0, 0, 50, 6.0, { r: 1, g: 0.5, b: 0 }, 'explosion');
check('спавн 50 частиц из пула', spawned === 50);

const state1 = pool.update(0.016);
check('активно ровно 50 частиц', state1.activeCount === 50);

// Проверяем спад масштаба
const sample = pool.particles.find((p) => p.active)!;
const initialScale = sample.currentScale;
pool.update(0.2);
check('масштаб частицы затухает по мере течения жизни (scale < initial)', sample.currentScale < initialScale);

// Проматываем 2.0 секунды (время жизни взрыва <= 0.8с)
pool.update(2.0);
const state2 = pool.update(0.016);
check('все частицы взрыва утилизированы обратно в пул (active = 0)', state2.activeCount === 0);

console.log('\nШейк камеры и спад травмы (Camera Shake):');
const shake = new CameraTraumaSystem();
check('начальная травма = 0', shake.trauma === 0);

shake.addTrauma(0.8);
check('добавление травмы 0.8', shake.trauma === 0.8);

shake.addTrauma(0.5);
check('травма ограничена потолком 1.0 (clamped)', shake.trauma === 1.0);

const offsets = shake.computeShake();
check('шейк при trauma=1.0 дает ненулевые смещения',
  Math.abs(offsets.yaw) > 0 || Math.abs(offsets.pitch) > 0 || Math.abs(offsets.offsetX) > 0);

// Затухание травмы за 0.5 сек (скорость 2.2 / с)
shake.update(0.5);
check('травма затухает во времени (1.0 - 0.5 * 2.2 = 0)', shake.trauma === 0);

const zeroOffsets = shake.computeShake();
check('при нулевой травме смещения строго равны 0',
  zeroOffsets.yaw === 0 && zeroOffsets.pitch === 0 && zeroOffsets.offsetX === 0 && zeroOffsets.offsetY === 0);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
