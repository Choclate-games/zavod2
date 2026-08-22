import * as THREE from 'three';
import type { DemoContext } from './core/Demo';
import { FightingDemo } from './demos/FightingDemo';
import { AnimDriver, FIGHT_ANIM_STATES, type AnimFighter } from './game/fightAnimStates';

/**
 * Витрина анимаций бойца: каждая анимация — полоса из шести кадров.
 *
 * Зачем отдельная страница, а не «посмотреть в игре»: в матче нужную позу
 * поймать нельзя. Удар живёт четыре кадра, подъём случается раз в полминуты,
 * а присед и блок выглядят одинаково на любом кадре. Ломаются анимации при
 * этом молча — остаток поворота от мокапа, перепутанная сторона, вывернутое
 * колено, шаг без сгиба колена. Всё это видно только если поставить бойца в
 * конкретную фазу и посмотреть.
 *
 * Открывается вручную (`anim.html`) и снимается автоматикой
 * (`scripts/anim-sheet.ts` → Playwright). Анимация проигрывается
 * по-настоящему: нажимаются клавиши, дальше крутится обычный игровой цикл, а
 * кадры снимаются в шести точках. Поза здесь — результат тех же
 * `fixedUpdate`/`update`, что и в игре, а не отдельный «предпросмотр».
 */

const COLS = 6;
const CELL_W = 230;
const CELL_H = 300;

const noop = (): void => {};

async function main(): Promise<void> {
  // Полос на одну больше, чем анимаций: последняя — нокдаун. Он не
  // анимация и в `FIGHT_ANIM_STATES` ему не место (в библиотеку клипов его
  // не выгрузить — это физика), но смотреть его надо ровно так же. Именно
  // здесь жил баг, которого не видел ни один замер позы: руки и ноги не
  // были сшиты с телом, корпус падал, а ноги оставались стоять.
  const rows = FIGHT_ANIM_STATES.length + 1;
  const canvas = document.getElementById('sheet') as HTMLCanvasElement;
  const width = COLS * CELL_W;
  const height = rows * CELL_H;
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.autoClear = false;
  renderer.setScissorTest(true);

  const driver = new AnimDriver();
  const ctx = {
    renderer,
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
    player: AnimFighter & { x: number; y: number; hp: number; ragdoll: unknown;
      lastHitZone: string; lastHitPower: number };
    bot: AnimFighter & { x: number; hp: number; rig: { root: THREE.Object3D } };
    knockDown(f: unknown, dir: 1 | -1): void;
  };
  const player = inner.player;

  const camera = new THREE.PerspectiveCamera(34, CELL_W / CELL_H, 0.1, 60);
  const labels = document.getElementById('labels') as HTMLDivElement;

  const step = (): void => {
    driver.step();
    // Соперника держим в углу неподвижным: его удары — это чужая анимация в
    // кадре, а его хитстан — не та поза, которую мы подписали.
    inner.bot.x = 6;
    inner.bot.enter('idle');
    inner.bot.hp = 1000;
    inner.bot.rig.root.visible = false;
    demo.fixedUpdate();
    demo.update(1 / 60);
  };

  renderer.setClearColor(0x0e1018, 1);
  renderer.clear();

  // Именно по списку анимаций, а не по `rows`: последняя полоса — нокдаун,
  // и его в списке нет.
  for (let row = 0; row < FIGHT_ANIM_STATES.length; row++) {
    const shot = FIGHT_ANIM_STATES[row];

    const tag = document.createElement('div');
    tag.className = 'label';
    tag.style.top = `${row * CELL_H + 6}px`;
    tag.textContent = `${shot.id} — ${shot.label}`;
    labels.appendChild(tag);

    // Сброс: полсекунды стойки, чтобы предыдущая анимация не тянулась в эту.
    driver.release();
    player.enter('idle');
    player.hp = 1000;
    for (let i = 0; i < 30; i++) step();
    player.x = -1.1;

    driver.begin(shot);
    shot.force?.(player, { hitBy: 'hook' });

    const marks = Array.from({ length: COLS }, (_, i) => Math.round((i / (COLS - 1)) * shot.frames));
    let frame = 0;
    for (let col = 0; col < COLS; col++) {
      while (frame < marks[col]) { step(); frame++; }
      const x = col * CELL_W;
      const y = height - (row + 1) * CELL_H;
      // Три четверти спереди — компромисс: в чистом профиле не виден уклон
      // (он уходит вбок, от камеры), а анфас не читается шаг и вынос ноги.
      // Высота едет за бойцом, иначе на вершине прыжка смотришь снизу вверх
      // и поджатые ноги выглядят как падение головой вниз.
      camera.position.set(player.x + 2.3, 1.3 + player.y * 0.65, 4.0);
      camera.lookAt(player.x, 1.0 + player.y * 0.75, 0);
      renderer.setViewport(x, y, CELL_W, CELL_H);
      renderer.setScissor(x, y, CELL_W, CELL_H);
      renderer.render(demo.scene, camera);
    }
  }

  // ─────────────────────────────────────────────────────────────── нокдаун
  {
    const row = rows - 1;
    const tag = document.createElement('div');
    tag.className = 'label';
    tag.style.top = `${row * CELL_H + 6}px`;
    tag.textContent = 'knockdown — нокдаун и рэгдолл';
    labels.appendChild(tag);

    driver.release();
    player.enter('idle');
    player.hp = 1000;
    for (let i = 0; i < 30; i++) step();
    player.x = -1.1;
    player.lastHitZone = 'head';
    player.lastHitPower = 40;
    inner.knockDown(player, 1);

    // Кадры чаще в начале: за первые полсекунды тело успевает всё, дальше
    // оно просто лежит.
    const marks = [0, 8, 18, 32, 55, 90];
    let frame = 0;
    for (let col = 0; col < COLS; col++) {
      while (frame < marks[col]) { step(); frame++; }
      const x = col * CELL_W;
      const y = height - (row + 1) * CELL_H;
      // Камера дальше и ниже: труп разъезжается по настилу на пару метров,
      // и в рамку стойки он не влезает.
      camera.position.set(player.x + 3.4, 1.5, 5.6);
      camera.lookAt(player.x + 0.6, 0.6, 0);
      renderer.setViewport(x, y, CELL_W, CELL_H);
      renderer.setScissor(x, y, CELL_W, CELL_H);
      renderer.render(demo.scene, camera);
    }
  }

  (window as unknown as { animSheetReady: boolean }).animSheetReady = true;
}

void main();
