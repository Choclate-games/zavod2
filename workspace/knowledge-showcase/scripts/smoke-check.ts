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
import { MeleeDemo } from '../src/demos/MeleeDemo';
import { SurvivorDemo } from '../src/demos/SurvivorDemo';
import { StealthDemo } from '../src/demos/StealthDemo';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

interface Script {
  /** Держать ЛКМ зажатой. */
  pointerDown?: boolean;
  /** Нажимать клавишу `code` каждые `every` тиков. */
  key?: { code: string; every: number };
  /** Водить персонажа по кругу — нужно там, где игрок обязан двигаться. */
  move?: boolean;
}

/** Куда стенд отдал обработчик клавиш демо — по нему прогон «нажимает». */
let keyHandler: ((code: string) => void) | null = null;
/** Номер текущего тика: по нему считается «движение» в сценарии. */
let tick = 0;

/**
 * Заглушка контекста: звук и HUD — пустышки, ввод задаётся сценарием.
 *
 * Без ввода демо не доходит до интересных веток: в слэшере никто не атакует,
 * значит не срабатывают ни смерть врага, ни рэгдолл, ни смена волны — и
 * прогон «зелёный» ровно потому, что ничего не произошло.
 */
function stubContext(script: Script): DemoContext {
  const noop = (): void => {};
  keyHandler = null;
  return {
    renderer: null as unknown as THREE.WebGLRenderer,
    tier: 'high',
    addTrauma: noop,
    setStatus: noop,
    rebuildPostFx: noop,
    audio: new Proxy({}, { get: () => noop }) as never,
    input: {
      isDown: () => false,
      moveVector: (out = new THREE.Vector2()) => (script.move
        ? out.set(Math.cos(tick / 90), Math.sin(tick / 90))
        : out.set(0, 0)),
      onKey: (down: (code: string) => void) => { keyHandler = down; return noop; },
      clearSubscribers: noop,
      releaseAll: noop,
      endFrame: noop,
      consumeLockDelta: (out = new THREE.Vector2()) => out.set(0, 0),
      requestPointerLock: noop,
      isPointerLocked: false,
      primary: script.pointerDown
        ? { id: 1, ndc: new THREE.Vector2(), delta: new THREE.Vector2(), down: true }
        : null,
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

async function run(name: string, demo: Demo, ticks: number, script: Script = {}): Promise<void> {
  const ctx = stubContext(script);
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
      tick = i;
      if (script.key && i % script.key.every === 0) keyHandler?.(script.key.code);
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
// Слэшер: зажатая атака + периодический захват цели. Без захвата игрок машет
// в пустоту, никто не умирает и ветки «смерть → рэгдолл → новая волна»
// остаются непроверенными — прогон зелёный просто потому, что ничего не было.
// Со сценарием за 1800 тиков набирается ~17 убийств и 5-я волна.
await run('слэшер', new MeleeDemo(), 1800, { pointerDown: true, key: { code: 'Tab', every: 30 } });
// Рой: 3600 тиков = минута забега. Карточки выбираются нажатием «1», иначе
// забег встанет на первом же уровне и орда никогда не дорастёт до сотен.
await run('рой', new SurvivorDemo(), 3600, { key: { code: 'Digit1', every: 20 }, move: true });
// Стелс: игрок ходит по кругу и попадает в конусы — иначе охранники патрулируют
// пустую карту и ни один переход состояния не проверяется.
await run('стелс', new StealthDemo(), 1800, { move: true });

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
