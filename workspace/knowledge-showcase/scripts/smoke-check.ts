/**
 * Дымовой прогон демо без браузера и без WebGL.
 *
 * Three.js создаёт сцены, меши и инстансы в Node — контекст нужен только для
 * `render()`. Поэтому логику вкладки (`init` → N тиков `fixedUpdate`/`update`)
 * можно прогнать головно и поймать исключения, деление на ноль и NaN в
 * координатах до того, как их увидит человек.
 *
 * Здесь НЕ проверяется, что картинка правильная — только что демо не падает и
 * не разъезжается в NaN. Визуальную часть проверяет человек, открыв стенд.
 *
 * Запуск: `npx tsx scripts/smoke-check.ts`
 */
import * as THREE from 'three';
import type { Demo, DemoContext } from '../src/core/Demo';
import { RacingDemo } from '../src/demos/RacingDemo';
import { FightingDemo } from '../src/demos/FightingDemo';
import { TowerDefenseDemo } from '../src/demos/TowerDefenseDemo';
import { YukaDemo } from '../src/demos/YukaDemo';
import { RecastDemo } from '../src/demos/RecastDemo';
import { FpsDemo } from '../src/demos/FpsDemo';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

/** Заглушка контекста: ввод «ничего не нажато», звук и HUD — пустышки. */
function stubContext(): DemoContext {
  const noop = (): void => {};
  return {
    renderer: null as unknown as THREE.WebGLRenderer,
    tier: 'high',
    addTrauma: noop,
    setStatus: noop,
    rebuildPostFx: noop,
    audio: new Proxy({}, { get: () => noop }) as never,
    input: {
      isDown: () => false,
      moveVector: (out = new THREE.Vector2()) => out.set(0, 0),
      onKey: () => noop,
      clearSubscribers: noop,
      releaseAll: noop,
      endFrame: noop,
      consumeLockDelta: (out = new THREE.Vector2()) => out.set(0, 0),
      requestPointerLock: noop,
      isPointerLocked: false,
      primary: null,
      activePointers: [],
      vehicleSnapshot: () => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, pause: false }),
      vehicle: null,
    } as never,
  };
}

/** Ищет NaN/Infinity в позициях сцены — «разъехалось» видно сразу. */
function hasBadTransform(scene: THREE.Object3D): string | null {
  let bad: string | null = null;
  scene.traverse((o) => {
    if (bad) return;
    const p = o.position;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      bad = `${o.type} ${o.name || '(без имени)'} → (${p.x}, ${p.y}, ${p.z})`;
    }
  });
  return bad;
}

async function run(name: string, demo: Demo, ticks: number): Promise<void> {
  const ctx = stubContext();
  const t0 = performance.now();
  try {
    await demo.init(ctx);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}: init упал — ${(err as Error).message}`);
    return;
  }
  const initMs = performance.now() - t0;

  try {
    demo.enter?.();
    for (let i = 0; i < ticks; i++) {
      demo.fixedUpdate?.(1 / 60);
      demo.update(1 / 60, 0);
    }
    demo.exit?.();
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}: упал на тике — ${(err as Error).stack}`);
    return;
  }

  const bad = hasBadTransform(demo.scene);
  check(`${name}: ${ticks} тиков без исключений (init ${initMs.toFixed(0)} мс)`, true);
  check(`${name}: нет NaN в трансформах`, bad === null, bad ?? '');
}

console.log('Дымовой прогон демо (без WebGL):');
await run('гонка', new RacingDemo(), 600);          // 10 секунд заезда
await run('файтинг', new FightingDemo(), 600);      // 10 секунд боя
await run('tower defense', new TowerDefenseDemo(), 1800);  // 30 секунд: волна успевает пойти
await run('yuka', new YukaDemo(), 600);
// Recast тянет WASM и строит навмеш — самый вероятный кандидат на падение при старте.
await run('recast', new RecastDemo(), 600);
await run('fps', new FpsDemo(), 900);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
