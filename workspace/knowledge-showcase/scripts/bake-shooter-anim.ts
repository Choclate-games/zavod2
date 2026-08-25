/**
 * Мокап Shooter Pack → ПРОЦЕДУРНАЯ анимация стрелка.
 *
 * Отличие от `bake-fight-anim.ts`: тот запекает клипы в JSON, который игра
 * грузит с сервера. Здесь результат — не ассет, а исходник: коэффициенты
 * рядов Фурье и десяток ключевых поз, которые попадают прямо в бандл
 * (`src/world/shooterAnimData.ts`). Причины ровно две:
 *
 * 1. **Вес.** Пять клипов Shooter Pack — 2.0 МБ FBX; после подгонки от них
 *    остаётся ~12 КБ чисел в TypeScript, которые ещё и жмутся gzip вместе с
 *    кодом. Ни отдельного запроса, ни ожидания загрузки, ни риска, что
 *    ассет не доедет.
 * 2. **Управляемость.** Цикл шага, заданный рядом Фурье, тянется по фазе, а
 *    не по времени: враг идёт медленно — цикл растягивается сам, без
 *    `timeScale` и рассинхрона со скоростью. Стрельбу и реакцию на попадание
 *    можно подмешивать как дельту к любой позе — с готовым `AnimationClip`
 *    так не получится без второго микшера.
 *
 * Метод ретаргета — направленческий, тот же, что в `bake-fight-anim.ts`
 * (см. его шапку): для каждого кадра берётся мировое направление сегмента
 * источника и решается поворот драйвера, при котором та же кость цели
 * смотрит туда же. Он не зависит от имён осей и от rest-позы, поэтому одним
 * кодом обрабатываются ОБА набора — Shooter Pack на скелете Mixamo и
 * `fight_anim` на своём собственном.
 *
 * Что откуда берётся:
 *
 * | Движение | Источник | Почему оттуда |
 * |---|---|---|
 * | стойка с винтовкой | `rifle aiming idle` | это и есть «как держат оружие» |
 * | бег с винтовкой | `rifle run` | цикл, ноги и корпус |
 * | приставной шаг | `strafe (2)` | враги обходят игрока боком |
 * | отход спиной | `walking backwards` | отступление на дистанции |
 * | выстрел | `firing rifle` | отдача уходит в плечи, а не в кадр |
 * | реакция на попадание | `fight_anim/hit_react_*` | в Shooter Pack их нет |
 * | смерть | `fight_anim/knockdown_fall` | `walking to dying.fbx` не читается |
 *
 * **Три файла Shooter Pack загрузчик three не разбирает** (`walking.fbx`,
 * `strafe.fbx`, `walking to dying.fbx`, `walk backwards stop.fbx`,
 * `jump forward.fbx` — «Unknown property type»). Формат у них тот же
 * FBX 7700 с тем же набором типов свойств, что и у читающихся файлов, —
 * значит дело в самом загрузчике, а не в ассетах. Здесь это не чинится:
 * у каждого сломанного файла есть работающая замена, и она выбрана выше.
 *
 * Запуск: `npm run bake:shooter-anim`
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { BOXER_MODELS, loadBoxerModel } from '../src/world/mixamoRig';
import { buildShooterRig } from '../src/world/shooterRig';
import { JOINTS, type JointKey } from '../src/world/shooterAnimTypes';

const SHOOTER_DIR = 'C:/Users/Eduard/Desktop/zavod2/assets/Shooter Pack';
const FIGHT_DIR = 'C:/Users/Eduard/Desktop/zavod2/assets/fight_anim';
const OUT = 'src/world/shooterAnimData.ts';
/** Частота съёма. Клипы пришли на 30 кадрах — больше взять неоткуда. */
const FPS = 30;
/** Гармоник в ряду Фурье. 3 — предел, где ошибка уже меньше 1.5°. */
const HARMONICS = 3;
/** Ключевых поз в одиночном клипе. */
const POSE_KEYS = 12;
const ROUND = 1e4;

// ─────────────────────────────────────────────── карта сустав → сегмент

/** Сустав, у которого важно только направление кости. */
interface AimJoint { driver: JointKey; from: string; to: string; rest: 'down' | 'up' }
/** Сустав, у которого нужна полная ориентация: иначе поедут дети. */
interface FullJoint { driver: JointKey; from: string; to: string; sideFrom: string; sideTo: string }

interface Skeleton {
  full: FullJoint[];
  aim: AimJoint[];
  hips: string;
  /** Стопы и кисти — по ним меряется энергия движения и длина шага. */
  probes: string[];
  footL: string;
  footR: string;
  /** Множитель в метры: и Mixamo, и fight_anim приходят в сантиметрах. */
  toMeters: number;
}

/**
 * Скелет Mixamo (Shooter Pack). «L» у рига — сторона −X, у Mixamo это
 * цепочка `Right*`. Перепутать стороны здесь дороже всего: враг будет
 * держать винтовку зеркально и стрелять «не той» рукой.
 */
const MIXAMO: Skeleton = {
  full: [
    { driver: 'body', from: 'mixamorigHips', to: 'mixamorigSpine', sideFrom: 'mixamorigLeftUpLeg', sideTo: 'mixamorigRightUpLeg' },
    { driver: 'waist', from: 'mixamorigSpine', to: 'mixamorigSpine1', sideFrom: 'mixamorigLeftUpLeg', sideTo: 'mixamorigRightUpLeg' },
    { driver: 'chest', from: 'mixamorigSpine1', to: 'mixamorigHead', sideFrom: 'mixamorigLeftShoulder', sideTo: 'mixamorigRightShoulder' },
  ],
  aim: [
    { driver: 'head', from: 'mixamorigNeck', to: 'mixamorigHead', rest: 'up' },
    { driver: 'shoulderL', from: 'mixamorigRightArm', to: 'mixamorigRightForeArm', rest: 'down' },
    { driver: 'elbowL', from: 'mixamorigRightForeArm', to: 'mixamorigRightHand', rest: 'down' },
    { driver: 'shoulderR', from: 'mixamorigLeftArm', to: 'mixamorigLeftForeArm', rest: 'down' },
    { driver: 'elbowR', from: 'mixamorigLeftForeArm', to: 'mixamorigLeftHand', rest: 'down' },
    { driver: 'thighL', from: 'mixamorigRightUpLeg', to: 'mixamorigRightLeg', rest: 'down' },
    { driver: 'shinL', from: 'mixamorigRightLeg', to: 'mixamorigRightFoot', rest: 'down' },
    { driver: 'thighR', from: 'mixamorigLeftUpLeg', to: 'mixamorigLeftLeg', rest: 'down' },
    { driver: 'shinR', from: 'mixamorigLeftLeg', to: 'mixamorigLeftFoot', rest: 'down' },
  ],
  hips: 'mixamorigHips',
  probes: ['mixamorigLeftHand', 'mixamorigRightHand', 'mixamorigLeftFoot', 'mixamorigRightFoot'],
  footL: 'mixamorigRightFoot',
  footR: 'mixamorigLeftFoot',
  toMeters: 0.01,
};

/** Скелет боевого набора: другие имена, 76 костей, rest-поза — стойка. */
const FIGHT: Skeleton = {
  full: [
    { driver: 'body', from: 'Hips', to: 'Spine1', sideFrom: 'LeftLeg', sideTo: 'RightLeg' },
    { driver: 'waist', from: 'Spine1', to: 'Spine2', sideFrom: 'LeftLeg', sideTo: 'RightLeg' },
    { driver: 'chest', from: 'Spine2', to: 'Chest', sideFrom: 'LeftShoulder', sideTo: 'RightShoulder' },
  ],
  aim: [
    { driver: 'head', from: 'Neck1', to: 'Head', rest: 'up' },
    { driver: 'shoulderL', from: 'RightArm', to: 'RightForeArm', rest: 'down' },
    { driver: 'elbowL', from: 'RightForeArm', to: 'RightHand', rest: 'down' },
    { driver: 'shoulderR', from: 'LeftArm', to: 'LeftForeArm', rest: 'down' },
    { driver: 'elbowR', from: 'LeftForeArm', to: 'LeftHand', rest: 'down' },
    { driver: 'thighL', from: 'RightLeg', to: 'RightShin', rest: 'down' },
    { driver: 'shinL', from: 'RightShin', to: 'RightFoot', rest: 'down' },
    { driver: 'thighR', from: 'LeftLeg', to: 'LeftShin', rest: 'down' },
    { driver: 'shinR', from: 'LeftShin', to: 'LeftFoot', rest: 'down' },
  ],
  hips: 'Hips',
  probes: ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'],
  footL: 'RightFoot',
  footR: 'LeftFoot',
  toMeters: 0.01,
};

// ────────────────────────────────────────────────────────────── источник

const loader = new FBXLoader();

function loadSource(dir: string, file: string): { root: THREE.Group; clip: THREE.AnimationClip } {
  const b = fs.readFileSync(path.join(dir, file));
  const root = loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '') as THREE.Group;
  const clip = root.animations[0];
  if (!clip) throw new Error(`${file}: в файле нет анимации`);
  return { root, clip };
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);

function worldPos(root: THREE.Object3D, name: string, out: THREE.Vector3): THREE.Vector3 {
  const o = root.getObjectByName(name);
  if (!o) throw new Error(`в клипе нет узла ${name}`);
  return out.setFromMatrixPosition(o.matrixWorld);
}

function segment(root: THREE.Object3D, from: string, to: string, out: THREE.Vector3): THREE.Vector3 {
  worldPos(root, to, out);
  worldPos(root, from, _a);
  return out.sub(_a).normalize();
}

/** Полная ориентация из «куда смотрит» + «где бок». Ось up ведущая. */
function orientation(up: THREE.Vector3, side: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  const y = up.clone().normalize();
  const x = side.clone().projectOnPlane(y).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}

// ──────────────────────────────────────────────────────────────── съём

interface Sampled {
  /** [кадр][сустав * 3 + ось] — углы Эйлера драйвера, радианы. */
  frames: number[][];
  /** Высота таза относительно стоячей позы, метры. */
  rootY: number[];
  /** Длина шага: максимальный разнос стоп вдоль направления взгляда, метры. */
  stride: number;
  duration: number;
}

/**
 * Снять клип в пространство драйверов рига.
 *
 * `trim` — обрезать «актёр стоит» в начале и конце (нужно одиночным клипам:
 * реакция на попадание длится 0.6 с из 4 секунд файла). Циклы не обрезаются:
 * у них тишины нет, а обрезка сломала бы период.
 */
function sample(
  dir: string, file: string, skel: Skeleton,
  drivers: Map<JointKey, THREE.Object3D>,
  opts: { trim?: boolean; standingHipY?: number; maxDuration?: number } = {},
): Sampled {
  const { root: src, clip } = loadSource(dir, file);
  const mixer = new THREE.AnimationMixer(src);
  mixer.clipAction(clip).play();
  const total = Math.max(1, Math.round(clip.duration * FPS));

  const at = (frame: number): void => {
    mixer.setTime(Math.min(frame, total) / FPS);
    src.updateMatrixWorld(true);
  };

  // Разворот актёра гасится по первому кадру: иначе к повороту, который
  // враг получает от игры, добавится ещё и мокапный, и весь строй встанет
  // вполоборота в пустой угол.
  at(0);
  const hipsQuat0 = new THREE.Quaternion()
    .setFromRotationMatrix(src.getObjectByName(skel.hips)!.matrixWorld);
  const e0 = new THREE.Euler().setFromQuaternion(hipsQuat0, 'YXZ');
  const correct = new THREE.Quaternion().setFromAxisAngle(UP, -e0.y);

  // Окно движения — по сумме смещений кистей и стоп.
  let first = 0;
  let last = total;
  if (opts.trim) {
    const energy: number[] = [];
    const prev = new Map<string, THREE.Vector3>();
    for (let f = 0; f <= total; f++) {
      at(f);
      let sum = 0;
      for (const name of skel.probes) {
        const p = worldPos(src, name, new THREE.Vector3());
        const was = prev.get(name);
        if (was) sum += p.distanceTo(was);
        prev.set(name, p);
      }
      energy.push(sum);
    }
    const peak = Math.max(...energy);
    first = Math.max(0, energy.findIndex((v) => v > peak * 0.12) - 2);
    last = energy.length - 1;
    while (last > first && energy[last] <= peak * 0.12) last--;
    last = Math.min(total, last + 2);
  }
  // Потолок длительности. `hit_react_face` — 4 секунды, из которых реакция
  // занимает полсекунды, а дальше актёр отыгрывает «приходит в себя». В
  // бою враг столько думать не может: он должен получить пулю и продолжить.
  if (opts.maxDuration) last = Math.min(last, first + Math.round(opts.maxDuration * FPS));

  const out: Sampled = { frames: [], rootY: [], stride: 0, duration: (last - first) / FPS };
  const up = new THREE.Vector3();
  const side = new THREE.Vector3();
  const dir3 = new THREE.Vector3();
  const want = new THREE.Quaternion();
  const parentQuat = new THREE.Quaternion();
  const prevEuler = new Array(JOINTS.length * 3).fill(0);
  const baseHipY = opts.standingHipY ?? (at(first), worldPos(src, skel.hips, _a).y);

  for (let f = first; f <= last; f++) {
    at(f);
    out.rootY.push((worldPos(src, skel.hips, _a).y - baseHipY) * skel.toMeters);

    // Разнос стоп вдоль +Z (после гашения разворота актёр смотрит в +Z).
    worldPos(src, skel.footL, _a).applyQuaternion(correct);
    worldPos(src, skel.footR, _b).applyQuaternion(correct);
    out.stride = Math.max(out.stride, Math.abs(_a.z - _b.z) * skel.toMeters);

    const row: number[] = new Array(JOINTS.length * 3).fill(0);
    JOINTS.forEach((key, ji) => {
      const driver = drivers.get(key)!;
      const full = skel.full.find((j) => j.driver === key);
      const aim = skel.aim.find((j) => j.driver === key);
      if (full) {
        segment(src, full.from, full.to, up).applyQuaternion(correct);
        worldPos(src, full.sideFrom, _a);
        worldPos(src, full.sideTo, _b);
        side.subVectors(_a, _b).applyQuaternion(correct);
        orientation(up, side, want);
      } else if (aim) {
        segment(src, aim.from, aim.to, dir3).applyQuaternion(correct);
        want.setFromUnitVectors(aim.rest === 'down' ? DOWN : UP, dir3);
      } else {
        return;
      }

      driver.parent!.updateWorldMatrix(true, false);
      parentQuat.setFromRotationMatrix(driver.parent!.matrixWorld);
      _q.copy(parentQuat).invert().multiply(want);
      driver.quaternion.copy(_q);
      driver.updateWorldMatrix(false, false);

      // Эйлер, а не кватернион: игра ставит позы через `rotation.set`, а
      // ряд Фурье считается по каждой оси отдельно. Углы разворачиваются
      // по предыдущему кадру — иначе на скачке через ±π цикл получает
      // разрыв, и Фурье размазывает его по всему шагу «дрожью».
      const eu = new THREE.Euler().setFromQuaternion(driver.quaternion, 'XYZ');
      const axes = [eu.x, eu.y, eu.z];
      for (let k = 0; k < 3; k++) {
        const idx = ji * 3 + k;
        let v = axes[k];
        const p = prevEuler[idx];
        while (v - p > Math.PI) v -= 2 * Math.PI;
        while (p - v > Math.PI) v += 2 * Math.PI;
        prevEuler[idx] = v;
        row[idx] = v;
      }
    });
    out.frames.push(row);
  }
  return out;
}

// ────────────────────────────────────────────────────────────── подгонка

/**
 * Ряд Фурье по фазе цикла: `a0 + Σ aₖ·cos(kφ) + bₖ·sin(kφ)`.
 *
 * Шаг — периодическое движение, и коэффициентов на него нужно на порядок
 * меньше, чем кадров: 7 чисел на ось против 21 кадра. Заодно исчезает шов
 * между последним и первым кадром — ряд периодичен по построению.
 */
function fourier(values: number[], harmonics: number): number[] {
  const n = values.length;
  const coef: number[] = [];
  let a0 = 0;
  for (const v of values) a0 += v;
  coef.push(a0 / n);
  for (let k = 1; k <= harmonics; k++) {
    let ac = 0;
    let as = 0;
    for (let i = 0; i < n; i++) {
      const phi = (2 * Math.PI * k * i) / n;
      ac += values[i] * Math.cos(phi);
      as += values[i] * Math.sin(phi);
    }
    coef.push((2 * ac) / n, (2 * as) / n);
  }
  return coef;
}

function evalFourier(coef: number[], phase: number): number {
  let v = coef[0];
  const h = (coef.length - 1) / 2;
  for (let k = 1; k <= h; k++) {
    v += coef[k * 2 - 1] * Math.cos(k * phase) + coef[k * 2] * Math.sin(k * phase);
  }
  return v;
}

/** Средняя и максимальная ошибка подгонки, градусы. */
function fitError(frames: number[][], coefs: number[][]): { mean: number; max: number } {
  const n = frames.length;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const phase = (2 * Math.PI * i) / n;
    for (let c = 0; c < coefs.length; c++) {
      const err = Math.abs(frames[i][c] - evalFourier(coefs[c], phase));
      sum += err;
      max = Math.max(max, err);
    }
  }
  return { mean: THREE.MathUtils.radToDeg(sum / (n * coefs.length)), max: THREE.MathUtils.radToDeg(max) };
}

const r = (v: number): number => Math.round(v * ROUND) / ROUND;

/** Ключевые позы: равномерная выборка по времени клипа. */
function keyframes(s: Sampled, count: number, subtract?: number[]): { times: number[]; pose: number[][] } {
  const times: number[] = [];
  const pose: number[][] = [];
  const n = s.frames.length;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const f = Math.min(n - 1, Math.round(t * (n - 1)));
    times.push(r(t * s.duration));
    pose.push(s.frames[f].map((v, k) => r(subtract ? v - subtract[k] : v)));
  }
  return { times, pose };
}

// ────────────────────────────────────────────────────────────────── main

const rig = buildShooterRig({
  source: await loadBoxerModel(BOXER_MODELS.x),
  body: 0xffffff, gear: 0xffffff, withRifle: false,
});
rig.root.updateMatrixWorld(true);
const drivers = new Map<JointKey, THREE.Object3D>();
for (const key of JOINTS) drivers.set(key, rig[key] as THREE.Object3D);

console.log('Съём клипов Shooter Pack:');

/** Циклы: период = длительность клипа, фаза 0..2π. */
const CYCLES: Array<{ name: string; file: string }> = [
  { name: 'run', file: 'rifle run.fbx' },
  { name: 'strafe', file: 'strafe (2).fbx' },
  { name: 'backward', file: 'walking backwards.fbx' },
];

const cycles: Record<string, { period: number; stride: number; coef: number[][]; hipBob: number[] }> = {};
for (const { name, file } of CYCLES) {
  const s = sample(SHOOTER_DIR, file, MIXAMO, drivers);
  // Последний кадр цикла дублирует первый — в ряд он не идёт, иначе один
  // кадр из тридцати получает двойной вес и цикл едет.
  const frames = s.frames.slice(0, -1);
  const coefs: number[][] = [];
  for (let c = 0; c < JOINTS.length * 3; c++) {
    coefs.push(fourier(frames.map((f) => f[c]), HARMONICS).map(r));
  }
  const err = fitError(frames, coefs);
  cycles[name] = {
    period: r(s.duration),
    stride: r(s.stride),
    coef: coefs,
    hipBob: fourier(s.rootY.slice(0, -1), 2).map(r),
  };
  console.log(`  ${name.padEnd(10)} ${String(frames.length).padStart(3)} кадров`
    + ` период ${s.duration.toFixed(2)} с, шаг ${s.stride.toFixed(2)} м`
    + ` · ошибка ряда: средняя ${err.mean.toFixed(2)}°, макс ${err.max.toFixed(2)}°`);
}

/** Стойка: усреднение по всему клипу + первая гармоника «дыхания». */
const idleSample = sample(SHOOTER_DIR, 'rifle aiming idle.fbx', MIXAMO, drivers);
const idleCoef: number[][] = [];
for (let c = 0; c < JOINTS.length * 3; c++) {
  idleCoef.push(fourier(idleSample.frames.map((f) => f[c]), 2).map(r));
}
const aimBase = idleCoef.map((c) => c[0]);
console.log(`  ${'aim'.padEnd(10)} ${String(idleSample.frames.length).padStart(3)} кадров`
  + ` период ${idleSample.duration.toFixed(2)} с (стойка с винтовкой)`);

/**
 * Одиночные клипы — дельтой от стойки.
 *
 * Дельта, а не абсолютная поза: выстрел и реакция на попадание обязаны
 * подмешиваться ПОВЕРХ бега, иначе стреляющий на ходу враг замирает.
 */
const fireSample = sample(SHOOTER_DIR, 'firing rifle.fbx', MIXAMO, drivers, { trim: true, maxDuration: 0.5 });
const fire = keyframes(fireSample, POSE_KEYS, aimBase);
console.log(`  ${'fire'.padEnd(10)} ${String(fireSample.frames.length).padStart(3)} кадров`
  + ` → ${POSE_KEYS} ключей, ${fireSample.duration.toFixed(2)} с`);

/** Реакции и смерть — из боевого набора: в Shooter Pack их нет. */
const HITS: Array<{ name: string; file: string }> = [
  { name: 'hitChest', file: 'hit_react_chest.fbx' },
  { name: 'hitBody', file: 'hit_react_body.fbx' },
  { name: 'hitHead', file: 'hit_react_face.fbx' },
];
const hits: Record<string, { duration: number; times: number[]; pose: number[][] }> = {};
for (const { name, file } of HITS) {
  const s = sample(FIGHT_DIR, file, FIGHT, drivers, { trim: true, maxDuration: 0.6 });
  // Дельта от ПЕРВОГО кадра самой реакции, а не от стойки стрелка: у
  // боевого набора rest-поза — боксёрская стойка, и вычитание прицельной
  // позы стрелка дало бы врагу опущенные руки в момент попадания.
  const k = keyframes(s, 8, s.frames[0]);
  hits[name] = { duration: r(s.duration), times: k.times, pose: k.pose };
  console.log(`  ${name.padEnd(10)} ${String(s.frames.length).padStart(3)} кадров → 8 ключей, ${s.duration.toFixed(2)} с`);
}

const deathSample = sample(FIGHT_DIR, 'knockdown_fall.fbx', FIGHT, drivers, { trim: true, maxDuration: 1.6 });
const death = keyframes(deathSample, 14);
console.log(`  ${'death'.padEnd(10)} ${String(deathSample.frames.length).padStart(3)} кадров → 14 ключей,`
  + ` ${deathSample.duration.toFixed(2)} с, таз ${Math.min(...deathSample.rootY).toFixed(2)} м`);

// ──────────────────────────────────────────────────────────────── запись

const lines: string[] = [];
lines.push('/* eslint-disable */');
lines.push('/**');
lines.push(' * СГЕНЕРИРОВАННЫЙ ФАЙЛ. Правки затрёт `npm run bake:shooter-anim`.');
lines.push(' *');
lines.push(' * Процедурная анимация стрелка, снятая с мокапа `assets/Shooter Pack`');
lines.push(' * и `assets/fight_anim`. Циклы — ряды Фурье по фазе шага, одиночные');
lines.push(' * движения — ключевые позы дельтой от стойки. Ни одного байта ассетов');
lines.push(' * в рантайме: всё, что нужно игре, лежит числами прямо здесь.');
lines.push(' *');
lines.push(' * Порядок чисел в позе: JOINTS[i] × (x, y, z), см. `shooterAnimTypes.ts`.');
lines.push(' */');
lines.push("import type { CycleClip, PoseClip, ShooterAnimData } from './shooterAnimTypes';");
lines.push('');

const fmt = (rows: number[][]): string => `[\n${rows.map((row) => `  [${row.join(',')}],`).join('\n')}\n]`;

lines.push(`const AIM: number[][] = ${fmt(idleCoef)};`);
lines.push('');
for (const [name, c] of Object.entries(cycles)) {
  lines.push(`const ${name.toUpperCase()}: CycleClip = {`);
  lines.push(`  period: ${c.period}, stride: ${c.stride},`);
  lines.push(`  hipBob: [${c.hipBob.join(',')}],`);
  lines.push(`  coef: ${fmt(c.coef)},`);
  lines.push('};');
  lines.push('');
}
const poseClip = (name: string, d: { duration: number; times: number[]; pose: number[][] }, additive: boolean): void => {
  lines.push(`const ${name.toUpperCase()}: PoseClip = {`);
  lines.push(`  duration: ${d.duration}, additive: ${additive},`);
  lines.push(`  times: [${d.times.join(',')}],`);
  lines.push(`  pose: ${fmt(d.pose)},`);
  lines.push('};');
  lines.push('');
};
poseClip('fire', { duration: r(fireSample.duration), times: fire.times, pose: fire.pose }, true);
for (const [name, h] of Object.entries(hits)) poseClip(name, h, true);
poseClip('death', { duration: r(deathSample.duration), times: death.times, pose: death.pose }, false);
lines.push(`const DEATH_HIP: number[] = [${death.times
  .map((_, i) => r(deathSample.rootY[Math.min(deathSample.rootY.length - 1,
    Math.round((i / (death.times.length - 1)) * (deathSample.rootY.length - 1)))]))
  .join(',')}];`);
lines.push('');
lines.push('export const SHOOTER_ANIM: ShooterAnimData = {');
lines.push('  harmonics: ' + HARMONICS + ',');
lines.push('  aim: AIM,');
lines.push('  cycles: { run: RUN, strafe: STRAFE, backward: BACKWARD },');
lines.push('  fire: FIRE,');
lines.push('  hits: { chest: HITCHEST, body: HITBODY, head: HITHEAD },');
lines.push('  death: DEATH,');
lines.push('  deathHip: DEATH_HIP,');
lines.push('};');
lines.push('');

const text = lines.join('\n');
fs.writeFileSync(OUT, text);
console.log(`\n→ ${OUT}, ${(text.length / 1024).toFixed(1)} КБ`
  + ` (источники: ${(sizeOf(SHOOTER_DIR) / 1024 / 1024).toFixed(1)} МБ FBX)`);

function sizeOf(dir: string): number {
  return fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.fbx') && f !== 'X Bot.fbx')
    .reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0);
}
