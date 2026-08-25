/**
 * Головной прогон вкладки FPS: проверяются ровно те свойства, отсутствие
 * которых видно игроку — направление движения, прыжок, огонь, смена стволов,
 * перезарядка, эффекты и анимация врагов.
 *
 * Всё это логика, а не картинка: WebGL здесь не нужен, Three.js прекрасно
 * строит сцены и считает матрицы в Node.
 *
 * Запуск: `npx tsx scripts/fps-check.ts`
 */
import * as THREE from 'three';
import type { DemoContext } from '../src/core/Demo';
import { FpsDemo } from '../src/demos/FpsDemo';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

interface Rig {
  ctx: DemoContext;
  keys: Set<string>;
  buttons: Set<number>;
  press(code: string): void;
  click(): void;
  /** Смещение мыши, которое демо прочитает следующим кадром. */
  look(dx: number, dy: number): void;
  wheel(dir: number): void;
  status: string;
  gunshots: number;
  explosions: number;
}

function makeRig(): Rig {
  const keys = new Set<string>();
  const buttons = new Set<number>();
  let keyHandler: ((code: string) => void) | null = null;
  let buttonHandler: ((button: number) => void) | null = null;
  let wheelHandler: ((dir: number) => void) | null = null;
  const lookDelta = new THREE.Vector2();
  const noop = (): void => {};

  const rig: Rig = {
    keys, buttons, status: '', gunshots: 0, explosions: 0,
    press: (code) => { keys.add(code); keyHandler?.(code); },
    click: () => { buttons.add(0); buttonHandler?.(0); },
    look: (dx, dy) => { lookDelta.set(dx, dy); },
    wheel: (dir) => { wheelHandler?.(dir); },
    ctx: null as unknown as DemoContext,
  };

  rig.ctx = {
    renderer: null as unknown as THREE.WebGLRenderer,
    tier: 'high',
    addTrauma: noop,
    setStatus: (html: string) => { rig.status = html; },
    rebuildPostFx: noop,
    audio: new Proxy({}, {
      get: (_t, prop: string) => (...args: unknown[]) => {
        if (prop === 'playGunshot') rig.gunshots++;
        if (prop === 'playExplosion' && (args[0] as number) >= 1) rig.explosions++;
      },
    }) as never,
    input: {
      isDown: (code: string) => keys.has(code),
      isButtonDown: (b: number) => buttons.has(b),
      moveVector: (out = new THREE.Vector2()) => {
        out.set(0, 0);
        if (keys.has('KeyA')) out.x -= 1;
        if (keys.has('KeyD')) out.x += 1;
        if (keys.has('KeyW')) out.y -= 1;
        if (keys.has('KeyS')) out.y += 1;
        return out;
      },
      onKey: (down: (code: string) => void) => { keyHandler = down; return noop; },
      onPointerButton: (h: (button: number) => void) => { buttonHandler = h; return noop; },
      onWheel: (h: (dir: number) => void) => { wheelHandler = h; return noop; },
      clearSubscribers: noop,
      releaseAll: noop,
      endFrame: noop,
      consumeLockDelta: (out = new THREE.Vector2()) => { out.copy(lookDelta); lookDelta.set(0, 0); return out; },
      requestPointerLock: noop,
      isPointerLocked: true,
      primary: { id: 1, ndc: new THREE.Vector2(), delta: new THREE.Vector2(), down: true, button: 0 },
      activePointers: [],
      vehicleSnapshot: () => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, pause: false }),
      vehicle: null,
    } as never,
  };
  return rig;
}

function tick(demo: FpsDemo, n: number): void {
  for (let i = 0; i < n; i++) {
    demo.fixedUpdate(1 / 60);
    demo.update(1 / 60, 0);
  }
}

/**
 * Свежая вкладка: у каждой проверки своё состояние.
 *
 * `init` асинхронный — вкладка грузит модели врагов. Ждать обязательно:
 * без этого первый же тик уходит в наполовину собранное демо.
 */
async function boot(tier: 'low' | 'high' = 'high'): Promise<{ demo: FpsDemo; rig: Rig }> {
  const rig = makeRig();
  (rig.ctx as { tier: string }).tier = tier;
  const demo = new FpsDemo();
  await demo.init(rig.ctx);
  demo.enter();
  tick(demo, 2);
  return { demo, rig };
}

/** Куда смотрит камера в плоскости XZ. */
function viewDir(demo: FpsDemo): THREE.Vector3 {
  return demo.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
}

console.log('Проверка вкладки FPS:');

// ── 1. W идёт ВПЕРЁД, S — назад, D — вправо. Инверсия здесь и была багом.
{
  const { demo, rig } = await boot();
  const dir = viewDir(demo);
  const start = demo.camera.position.clone();
  rig.press('KeyW');
  tick(demo, 60);
  const delta = demo.camera.position.clone().sub(start).setY(0);
  check('W уводит игрока ВПЕРЁД по взгляду', delta.dot(dir) > 1.5, `dot=${delta.dot(dir).toFixed(2)}`);

  rig.keys.clear();
  const mid = demo.camera.position.clone();
  rig.press('KeyS');
  tick(demo, 60);
  const back = demo.camera.position.clone().sub(mid).setY(0);
  check('S уводит НАЗАД', back.dot(dir) < -1.0, `dot=${back.dot(dir).toFixed(2)}`);

  rig.keys.clear();
  tick(demo, 40);
  const mid2 = demo.camera.position.clone();
  rig.press('KeyD');
  tick(demo, 60);
  const side = demo.camera.position.clone().sub(mid2).setY(0);
  const rightAxis = new THREE.Vector3(dir.z, 0, -dir.x).normalize().negate();
  check('D уводит ВПРАВО от взгляда', side.dot(rightAxis) > 1.0, `dot=${side.dot(rightAxis).toFixed(2)}`);
}

// ── 2. Мышь: движение вправо поворачивает вправо, вниз — опускает взгляд.
{
  const { demo, rig } = await boot();
  const before = viewDir(demo);
  rig.look(200, 0);
  tick(demo, 1);
  const after = viewDir(demo);
  const cross = before.clone().cross(after).y;
  check('мышь вправо поворачивает вправо', cross < -0.01, `cross.y=${cross.toFixed(3)}`);

  const y0 = demo.camera.getWorldDirection(new THREE.Vector3()).y;
  rig.look(0, 200);
  tick(demo, 1);
  const y1 = demo.camera.getWorldDirection(new THREE.Vector3()).y;
  check('мышь вниз опускает взгляд', y1 < y0, `${y0.toFixed(3)} → ${y1.toFixed(3)}`);
}

// ── 3. Прыжок: игрок отрывается от земли и возвращается.
{
  const { demo, rig } = await boot();
  const groundY = demo.camera.position.y;
  rig.press('Space');
  let peak = groundY;
  for (let i = 0; i < 40; i++) { tick(demo, 1); peak = Math.max(peak, demo.camera.position.y); }
  check('Space поднимает игрока', peak > groundY + 0.8, `+${(peak - groundY).toFixed(2)} м`);
  tick(demo, 90);
  check('игрок возвращается на землю', Math.abs(demo.camera.position.y - groundY) < 0.05,
    `y=${demo.camera.position.y.toFixed(3)} vs ${groundY.toFixed(3)}`);
}

// ── 4. Присед опускает камеру и отпускается обратно.
{
  const { demo, rig } = await boot();
  const stand = demo.camera.position.y;
  rig.press('ControlLeft');
  tick(demo, 60);
  const crouch = demo.camera.position.y;
  check('Ctrl опускает камеру', stand - crouch > 0.4, `Δ=${(stand - crouch).toFixed(2)}`);
  rig.keys.clear();
  tick(demo, 60);
  check('после отпускания игрок встаёт', Math.abs(demo.camera.position.y - stand) < 0.03);
}

// ── 5. Огонь: автомат стреляет на удержании, боезапас убывает, звук идёт.
{
  const { demo, rig } = await boot();
  tick(demo, 10);                     // HUD обновляется раз в 0.1 с
  const ammo0 = ammoOf(rig.status);
  rig.buttons.add(0);
  tick(demo, 60);
  const ammo1 = ammoOf(rig.status);
  check('автомат стреляет на удержании ЛКМ', rig.gunshots >= 8, `выстрелов=${rig.gunshots}`);
  check('патроны расходуются', ammo1 < ammo0, `${ammo0} → ${ammo1}`);
}

// ── 6. Полуавтомат: удержание НЕ даёт очередь, каждый выстрел — отдельный клик.
{
  const { demo, rig } = await boot();
  rig.press('Digit1');                 // пистолет
  tick(demo, 40);
  rig.buttons.add(0);
  tick(demo, 90);
  check('пистолет не стреляет от одного удержания', rig.gunshots <= 1, `выстрелов=${rig.gunshots}`);
  const before = rig.gunshots;
  for (let i = 0; i < 4; i++) { rig.click(); tick(demo, 20); }
  check('каждый клик даёт выстрел', rig.gunshots - before >= 3, `+${rig.gunshots - before}`);
}

// ── 7. Смена оружия: 1/2/3 и Q переключают, HUD показывает активный ствол.
{
  const { demo, rig } = await boot();
  tick(demo, 10);
  check('на старте — автомат', rig.status.includes('Автомат'), rig.status);
  rig.press('Digit3');
  tick(demo, 40);
  check('Digit3 даёт дробовик', rig.status.includes('Дробовик'), rig.status);
  rig.press('KeyQ');
  tick(demo, 40);
  check('Q переключает дальше по кругу', rig.status.includes('Пистолет'), rig.status);
  rig.press('Digit2');
  tick(demo, 40);
  check('Digit2 возвращает автомат', rig.status.includes('Автомат'), rig.status);
  rig.wheel(1);
  tick(demo, 40);
  check('колесо листает стволы', rig.status.includes('Дробовик'), rig.status);
}

// ── 8. Перезарядка: занимает время, пополняет магазин из запаса.
{
  const { demo, rig } = await boot();
  rig.buttons.add(0);
  tick(demo, 40);
  rig.buttons.clear();
  const before = ammoOf(rig.status);
  rig.press('KeyR');
  tick(demo, 20);
  check('во время перезарядки HUD это показывает', rig.status.includes('перезарядка'), rig.status);
  tick(demo, 130);
  const after = ammoOf(rig.status);
  check('после перезарядки магазин полон', after === 30, `${before} → ${after}`);
  check('запас уменьшился', reserveOf(rig.status) < 180, rig.status);
}

// ── 9. Дробовик кладёт в цель залп дробинок, а не одну пулю.
{
  const { demo, rig } = await boot();
  rig.press('Digit3');
  tick(demo, 40);
  rig.look(0, 700);                   // смотрим в пол: дробь обязана во что-то попасть
  tick(demo, 2);
  const before = decalCount(demo);
  rig.click();
  tick(demo, 4);
  check('выстрел дробью оставляет несколько отметин', decalCount(demo) - before >= 3,
    `+${decalCount(demo) - before}`);
}

// ── 10. Эффекты: трассер, частицы и вспышка появляются в кадре выстрела.
{
  const { demo, rig } = await boot();
  rig.buttons.add(0);
  tick(demo, 1);                      // вспышка живёт 45 мс — ровно кадр-другой
  check('трассеры рисуются', instancedActive(demo, 'tracer') > 0);
  check('частицы живут', particleCount(demo) > 0, `${particleCount(demo)}`);
  check('вспышка у дула видна', flashVisible(demo));
}

// ── 11. Взрыв бочки: цепная детонация и вспышка света.
{
  const { demo, rig } = await boot();
  detonateAll(demo);
  tick(demo, 30);
  check('взрыв бочки отработал', rig.explosions >= 1, `взрывов=${rig.explosions}`);
  check('свет взрыва загорелся', blastLight(demo) > 0, `${blastLight(demo).toFixed(1)}`);
}

// ── 12. Анимация врагов: ноги двигаются на ходу, тело падает при смерти.
{
  const { demo } = await boot();
  tick(demo, 240);
  check('у врагов шевелятся ноги', legMoved(demo), 'ни одна нога не повернулась');
  check('у врагов винтовка в руках', rifleInHands(demo));
  // Оружие ставится по мировым позициям кистей, а лежит в ЛОКАЛЬНЫХ
  // координатах рига: перепутать их — и ствол улетает на позицию врага
  // от начала координат, то есть на десяток метров в сторону.
  check('оружие врага в руках, а не летает по арене', rifleGap(demo) < 0.6,
    `дальний ствол в ${rifleGap(demo).toFixed(2)} м от груди`);
  // Мокапная стойка бладированная: без компенсации ствол смотрит на 55°
  // мимо игрока, хотя сам враг развёрнут к нему.
  check('стреляющие враги целятся в игрока', worstAim(demo) > 0.985,
    `худший cos=${worstAim(demo).toFixed(3)}`);

  const standHip = peekHipY(demo);
  killFirst(demo);
  tick(demo, 120);
  check('убитый заваливается', deadTilted(demo), 'тело осталось стоять');
  check('таз убитого опускается на землю', standHip - peekHipY(demo) > 0.5,
    `${standHip.toFixed(2)} → ${peekHipY(demo).toFixed(2)}`);
}

// ── 12c. Низкий тир: рэгдолла нет, падение играется запечённым клипом.
{
  const { demo } = await boot('low');
  tick(demo, 60);
  const e = peek(demo).enemies[0];
  killFirst(demo);
  check('на низком тире рэгдолл не создаётся', e.ragdoll === null);
  tick(demo, 120);
  check('на низком тире тело всё равно падает', deadTilted(demo), 'осталось стоять');
  check('на низком тире поза без NaN',
    Number.isFinite(world(e.rig.head).y) && Number.isFinite(world(e.rig.hips).y));
}

// ── 12b. Рэгдолл: тело падает физикой, не складывается и не уезжает.
{
  const { demo } = await boot();
  tick(demo, 120);
  const e = peek(demo).enemies[0];
  const spot = e.pos.clone();
  const spineBefore = world(e.rig.head).distanceTo(world(e.rig.hips));
  killFirst(demo);
  check('в момент смерти появляется рэгдолл', e.ragdoll !== null);
  check('оружие выпадает из рук', e.rig.rifle === null && peek(demo).drops.length === 1,
    `стволов на полу: ${peek(demo).drops.length}`);

  tick(demo, 180);
  const hips = world(e.rig.hips);
  check('тело улеглось на пол', hips.y < 0.35, `таз на ${hips.y.toFixed(2)} м`);
  check('тело осталось у места смерти', hips.setY(0).distanceTo(spot.setY(0)) < 2.5,
    `уехало на ${hips.distanceTo(spot).toFixed(2)} м`);
  // Цепочка таз→грудь→голова свободно складывается вдвое: без связки на
  // разжатие на полу остаётся комок вместо тела.
  const spineAfter = world(e.rig.head).distanceTo(world(e.rig.hips));
  check('корпус не сложился в комок', spineAfter > spineBefore * 0.75,
    `${spineBefore.toFixed(2)} → ${spineAfter.toFixed(2)} м`);
  check('поза трупа без NaN', [
    world(e.rig.head), world(e.rig.hips), world(e.rig.chest), world(e.rig.thighL),
  ].every((v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)));
  check('улёгшееся тело перестаёт считаться', e.ragdoll?.asleep === true);
  const gun = peek(demo).drops[0].object.position;
  check('выпавший ствол лежит на полу', gun.y < 0.2, `y=${gun.y.toFixed(2)}`);
}

// ── 11a. Отдача камеры возвращает взгляд туда, куда игрок целился.
{
  const { demo, rig } = await boot();
  const before = demo.camera.getWorldDirection(new THREE.Vector3()).y;
  rig.buttons.add(0);
  tick(demo, 60);                     // секунда очереди
  const peak = demo.camera.getWorldDirection(new THREE.Vector3()).y;
  check('очередь задирает ствол', peak > before + 0.02, `${before.toFixed(3)} → ${peak.toFixed(3)}`);
  rig.buttons.clear();
  tick(demo, 240);                    // четыре секунды без огня
  const after = demo.camera.getWorldDirection(new THREE.Vector3()).y;
  check('после очереди взгляд возвращается', Math.abs(after - before) < 0.02,
    `${before.toFixed(3)} → ${after.toFixed(3)}`);
}

// ── 12a. Попадание по врагу: тело отыгрывает реакцию, на полу остаётся кровь.
{
  const { demo, rig } = await boot();
  // Врага ставим прямо перед игроком: попадание должно быть детерминированным,
  // а не «повезло с разбросом».
  const target = peek(demo).enemies[0];
  target.pos.set(0, 0, 12);
  tick(demo, 2);
  const bloodBefore = bloodCount(demo);
  rig.buttons.add(0);
  tick(demo, 6);
  check('попадание запускает реакцию тела', target.anim.hitT < 0.3, `hitT=${target.anim.hitT.toFixed(2)}`);
  check('на полу остаётся кровь', bloodCount(demo) > bloodBefore,
    `${bloodBefore} → ${bloodCount(demo)}`);
}

// ── 12b. Процедурная анимация: цикл шага и стойка — из мокапа, не из нулей.
{
  const dataMod = await import('../src/world/shooterAnimData');
  const A = dataMod.SHOOTER_ANIM;
  check('стойка с винтовкой снята', A.aim.length === 36 && A.aim.every((c) => c.length === 5));
  check('циклы хода имеют период и длину шага',
    A.cycles.run.period > 0.3 && A.cycles.run.stride > 0.4,
    `период ${A.cycles.run.period}, шаг ${A.cycles.run.stride}`);
  // Ноги в цикле бега обязаны РАЗМАХИВАТЬСЯ: нулевые гармоники означали бы,
  // что ретаргет отдал одну и ту же позу на все кадры.
  const thighL = A.cycles.run.coef[8 * 3];         // JOINTS[8] = thighL, ось x
  const swing = Math.hypot(thighL[1], thighL[2]);
  check('бедро в цикле бега размахивает', swing > 0.15, `амплитуда ${swing.toFixed(2)} рад`);
  check('стойка держит руки поднятыми',
    A.aim[4 * 3][0] < -0.3 && A.aim[6 * 3][0] < -0.3,
    `плечи ${A.aim[4 * 3][0].toFixed(2)} / ${A.aim[6 * 3][0].toFixed(2)}`);
}

// ── 13. Долгий прогон без NaN.
{
  const { demo, rig } = await boot();
  rig.press('KeyW');
  rig.buttons.add(0);
  for (let i = 0; i < 1200; i++) {
    if (i % 120 === 0) rig.press('Space');
    if (i % 200 === 0) rig.press('KeyQ');
    if (i % 90 === 0) rig.look(30, 10);
    tick(demo, 1);
  }
  let bad: string | null = null;
  demo.scene.traverse((o) => {
    const p = o.position;
    if (!bad && (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z))) {
      bad = `${o.type} → (${p.x}, ${p.y}, ${p.z})`;
    }
  });
  check('20 секунд боя без NaN', bad === null, bad ?? '');
  demo.exit();
  demo.dispose();
}

console.log(failed === 0 ? '\nFPS: все проверки пройдены.' : `\nFPS: провалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);

// ────────────────────────────────────────────────────────────── помощники
function ammoOf(status: string): number {
  return Number(/<b>(\d+)\/\d+<\/b>/.exec(status)?.[1] ?? -1);
}
function reserveOf(status: string): number {
  return Number(/запас (\d+)/.exec(status)?.[1] ?? -1);
}

/** Доступ к приватным полям демо: тест смотрит на состояние, а не на пиксели. */
type Internals = {
  decals: THREE.InstancedMesh;
  tracers: THREE.InstancedMesh;
  sparks: { particles: Array<{ active: boolean }> };
  smoke: { particles: Array<{ active: boolean }> };
  weapons: Array<{ flash: THREE.Mesh }>;
  weaponIndex: number;
  blasts: Array<{ light: THREE.PointLight }>;
  barrels: Array<{ fuse: number; exploded: boolean }>;
  enemies: Array<{
    hp: number;
    pos: THREE.Vector3;
    state: string;
    anim: { phase: number; moveBlend: number; hitT: number; deathT: number };
    ragdoll: { asleep: boolean; hipHeight(): number } | null;
    rig: {
      thighL: THREE.Object3D; body: THREE.Object3D; hips: THREE.Object3D;
      chest: THREE.Object3D; head: THREE.Object3D;
      rifle: THREE.Object3D | null; muzzle: THREE.Object3D | null;
    };
  }>;
  drops: Array<{ object: THREE.Object3D }>;
  pos: THREE.Vector3;
  eyeHeight: number;
  bloodDecals: THREE.InstancedMesh;
};
function peek(demo: FpsDemo): Internals { return demo as unknown as Internals; }

function decalCount(demo: FpsDemo): number { return peek(demo).decals.count; }
function instancedActive(demo: FpsDemo, _kind: 'tracer'): number {
  // Живой трассер — инстанс с ненулевым масштабом.
  const m = peek(demo).tracers;
  const arr = m.instanceMatrix.array as ArrayLike<number>;
  let n = 0;
  for (let i = 0; i < m.count; i++) if (Math.abs(arr[i * 16]) > 1e-6) n++;
  return n;
}
function particleCount(demo: FpsDemo): number {
  const p = peek(demo);
  return p.sparks.particles.filter((x) => x.active).length
    + p.smoke.particles.filter((x) => x.active).length;
}
function flashVisible(demo: FpsDemo): boolean {
  const p = peek(demo);
  return p.weapons[p.weaponIndex].flash.visible;
}
function detonateAll(demo: FpsDemo): void {
  for (const b of peek(demo).barrels) if (!b.exploded) { b.fuse = 0.001; break; }
}
function blastLight(demo: FpsDemo): number {
  return Math.max(...peek(demo).blasts.map((b) => b.light.intensity));
}
function legMoved(demo: FpsDemo): boolean {
  return peek(demo).enemies.some((e) => Math.abs(e.rig.thighL.rotation.x) > 0.05);
}
function killFirst(demo: FpsDemo): void {
  const e = peek(demo).enemies[0];
  e.hp = 0;
  (demo as unknown as {
    killEnemy(x: unknown, impulse: THREE.Vector3, zone: string): void;
  }).killEnemy(e, new THREE.Vector3(2.5, 0.4, 1.5), 'body');
}
/** Мировая позиция объекта — рэгдолл двигает кости, а не корень рига. */
function world(o: THREE.Object3D): THREE.Vector3 {
  return o.getWorldPosition(new THREE.Vector3());
}
function deadTilted(demo: FpsDemo): boolean {
  // Тело завалилось, если голова опустилась почти до уровня таза: у стоящего
  // врага между ними полметра по вертикали.
  const rig = peek(demo).enemies[0].rig;
  return world(rig.head).y - world(rig.hips).y < 0.25;
}
/** Насколько далеко ствол от груди своего хозяина. */
function rifleGap(demo: FpsDemo): number {
  let worst = 0;
  for (const e of peek(demo).enemies) {
    if (!e.rig.rifle) continue;
    worst = Math.max(worst, world(e.rig.rifle).distanceTo(world(e.rig.chest)));
  }
  return worst;
}
/** Косинус между осью ствола и направлением на игрока, худший по живым. */
function worstAim(demo: FpsDemo): number {
  const p = peek(demo);
  const eye = new THREE.Vector3(p.pos.x, p.pos.y + p.eyeHeight, p.pos.z);
  let worst = 1;
  for (const e of p.enemies) {
    if (!e.rig.rifle || e.state !== 'engage') continue;
    const dir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(e.rig.rifle.getWorldQuaternion(new THREE.Quaternion()));
    worst = Math.min(worst, dir.dot(eye.clone().sub(world(e.rig.muzzle!)).normalize()));
  }
  return worst;
}
function bloodCount(demo: FpsDemo): number { return peek(demo).bloodDecals.count; }
function peekHipY(demo: FpsDemo): number {
  return (peek(demo).enemies[0].rig as unknown as { hips: THREE.Object3D }).hips.position.y;
}
function rifleInHands(demo: FpsDemo): boolean {
  // Мёртвые не в счёт: труп оружие роняет.
  return peek(demo).enemies
    .filter((e) => e.state !== 'dead')
    .every((e) => e.rig.rifle !== null && e.rig.muzzle !== null);
}
