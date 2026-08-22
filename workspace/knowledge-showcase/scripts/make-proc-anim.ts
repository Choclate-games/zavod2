/**
 * Библиотека процедурных анимаций: `assets/proc_anim/*.json`.
 *
 * Зачем она нужна, если анимацию и так считает код игры: код живёт внутри
 * одной вкладки и завязан на её состояния, физику и фрейм-дату. Другой игре
 * (и другому агенту) из него ничего не достать. Здесь тот же самый код
 * **записывается в клипы** — в тот же формат, в котором лежит запечённый
 * мокап, — и получается набор нормализованных анимаций, который подключается
 * одной функцией и не тянет за собой ни файтинг, ни Rapier.
 *
 * Запись честная: демо крутится по-настоящему (`fixedUpdate` + `update`),
 * клавиши нажимаются те же, что нажал бы игрок, а мокап на время записи
 * выключается — библиотека обязана быть чисто процедурной, иначе её нельзя
 * взять в проект, где чужих клипов нет.
 *
 * Запуск: `npm run make:proc-anim`
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as THREE from 'three';
import type { DemoContext } from '../src/core/Demo';
import { FightingDemo } from '../src/demos/FightingDemo';
import { AnimDriver, FIGHT_ANIM_STATES, type AnimFighter } from '../src/game/fightAnimStates';
import type { BoxerRig } from '../src/world/boxerRig';

const OUT_DIR = 'C:/Users/Eduard/Desktop/zavod2/assets/proc_anim';
/** Игровой тик — 60 Гц, и клипы пишутся в нём же: пересчёт тут только вредит. */
const FPS = 60;
const ROUND = 1e3;

/** Суставы, которые пишутся в клип. Порядок — сверху вниз по иерархии. */
const JOINTS: Array<keyof BoxerRig> = [
  'body', 'hips', 'waist', 'chest', 'head',
  'shoulderL', 'elbowL', 'shoulderR', 'elbowR',
  'thighL', 'shinL', 'thighR', 'shinR',
];

const noop = (): void => {};
const driver = new AnimDriver();

const ctx = {
  renderer: null,
  tier: 'high',
  addTrauma: noop,
  setStatus: noop,
  rebuildPostFx: noop,
  audio: new Proxy({}, { get: () => noop }),
  input: {
    isDown: (code: string) => driver.isDown(code),
    moveVector: (out = new THREE.Vector2()) => out.set(0, 0),
    onKey: (down: (code: string) => void) => { driver.onKey = down; return noop; },
    // Мышь головным прогонам не нужна: приёмы вызываются клавишами.
    onPointerButton: () => noop,
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
  },
} as unknown as DemoContext;

const demo = new FightingDemo();
await demo.init(ctx);
demo.enter();

const inner = demo as unknown as {
  player: AnimFighter & { rig: BoxerRig; x: number; y: number; hp: number };
  bot: AnimFighter & { x: number; hp: number };
  clips: Map<string, unknown>;
};
// Мокап выключаем: библиотека должна работать там, где клипов из
// `assets/fight_anim/` нет вовсе.
inner.clips = new Map();

const player = inner.player;
const rig = player.rig;

function step(): void {
  driver.step();
  inner.bot.x = 3.4;
  inner.bot.enter('idle');
  inner.bot.hp = 1000;
  demo.fixedUpdate();
  demo.update(1 / 60);
}

const round = (v: number): number => Math.round(v * ROUND) / ROUND;

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log('Запись процедурных клипов:');

const index: Array<{ id: string; frames: number; label: string }> = [];

for (const shot of FIGHT_ANIM_STATES) {
  driver.release();
  player.enter('idle');
  player.hp = 1000;
  for (let i = 0; i < 30; i++) step();
  player.x = -0.6;

  driver.begin(shot);
  shot.force?.(player, { hitBy: 'hook' });

  const joints: Record<string, number[]> = {};
  for (const key of JOINTS) joints[key as string] = [];
  const rootY: number[] = [];

  for (let f = 0; f < shot.frames; f++) {
    step();
    for (const key of JOINTS) {
      const q = (rig[key] as THREE.Object3D).quaternion;
      joints[key as string].push(round(q.x), round(q.y), round(q.z), round(q.w));
    }
    // Высота таза считается от стойки — как и в запечённом мокапе, иначе
    // клипы из двух источников нельзя проигрывать одной функцией.
    rootY.push(round(rig.body.position.y - rig.defaults.bodyPos.y));
  }

  const file = path.join(OUT_DIR, `${shot.id}.json`);
  fs.writeFileSync(file, JSON.stringify({
    id: shot.id,
    label: shot.label,
    source: 'procedural',
    fps: FPS,
    frames: shot.frames,
    rootY,
    joints,
  }));
  index.push({ id: shot.id, frames: shot.frames, label: shot.label });
  console.log(`  ${shot.id.padEnd(14)} ${String(shot.frames).padStart(3)} кадров`
    + ` (${(shot.frames / FPS).toFixed(2)} с)`);
}

const total = index.reduce((sum, c) => sum + c.frames, 0);
console.log(`\n${index.length} клипов, ${total} кадров → ${OUT_DIR}`);

demo.exit();
demo.dispose();
