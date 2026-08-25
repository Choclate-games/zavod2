/**
 * Ретаргет боевых клипов из `assets/fight_anim/` на риг бойца.
 *
 * Зачем отдельный шаг сборки, а не загрузка FBX в игре:
 *
 * 1. **Вес.** 40 клипов — это 26 МБ FBX, и в каждом лежит ещё и скиненный
 *    стикмен, который игре не нужен. После запекания остаётся один файл
 *    ~0.5 МБ с одними поворотами.
 * 2. **Скелет чужой.** В клипах не `mixamorig*`, а `Spine1 / Chest / Neck1 /
 *    LeftArm`, 76 костей, и rest-поза у них — боевая стойка, а не T-поза.
 *    Прямое переименование костей тут не работает: одинаковые имена не
 *    означают одинаковые оси, а разные rest-позы ломают обычный
 *    «дельта-ретаргет» (`клип минус rest`), потому что вычитается стойка.
 * 3. **Мусор в начале и конце.** Клипы по 3–6 секунд, из них движения —
 *    0.5–1.5 с, остальное актёр стоит. В игре это выглядело бы как задержка
 *    перед каждым ударом.
 *
 * Поэтому ретаргет идёт **по направлениям, а не по кватернионам костей**:
 * для каждого кадра берётся мировое направление сегмента источника (плечо →
 * локоть) и решается поворот драйвера, при котором та же кость цели смотрит
 * туда же. Такой ретаргет не зависит ни от имён осей, ни от rest-позы, и
 * работает с любым скелетом, где можно назвать пары «сустав → ребёнок».
 * Расплата — скручивание вокруг самой кости не переносится; для торса и
 * головы, где это видно, ориентация решается полностью (по линии плеч и
 * линии глаз), для рук в перчатках хватает направления.
 *
 * Запуск: `npx tsx scripts/bake-fight-anim.ts`
 * Результат: `public/models/fight_anim.json` (читает `src/world/fightClips.ts`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { BOXER_MODELS, buildMixamoBoxer, loadBoxerModel } from '../src/world/mixamoRig';
import type { BoxerRig } from '../src/world/boxerRig';
import { HIT_CLIPS, MOVE_CLIPS, STATE_CLIPS } from '../src/world/fightClips';

/**
 * Клипы, у которых игра берёт таз и ноги (`layer: 'full'`).
 *
 * Список нужен ровно для одного решения — выпрямлять клип по удару или нет.
 * И берётся он из самого `fightClips.ts`, а не переписывается сюда руками:
 * иначе появится второй источник правды, и первый же новый клип с полным
 * слоем окажется выпрямлен молча.
 */
const FULL_LAYER = new Set(
  [...Object.values(MOVE_CLIPS), ...Object.values(STATE_CLIPS), ...Object.values(HIT_CLIPS)]
    .filter((u) => u.layer === 'full')
    .map((u) => u.clip),
);

const SRC_DIR = 'C:/Users/Eduard/Desktop/zavod2/assets/fight_anim';
const OUT = 'public/models/fight_anim.json';
/** Частота запекания. Клипы пришли на 30 кадрах — больше взять неоткуда. */
const FPS = 30;
/** Порог обрезки: доля от пика движения, ниже которой кадр считается «стоит». */
const TRIM = 0.12;
/** Точность записи кватернионов: 0.001 — это 0.06°, глазом не видно. */
const ROUND = 1e3;

// ─────────────────────────────────────────────────── карта сустав → сегмент
//
// «L» у бойца — сторона −X (передняя рука в стойке). В клипах, как и у
// Mixamo, −X — это цепочка Right*. Перепутать стороны здесь дороже всего:
// матч идёт, удары считаются, а боец бьёт зеркально.

/** Сустав, у которого важно только направление кости. */
interface AimJoint {
  driver: keyof BoxerRig;
  from: string;
  to: string;
  /** Куда смотрит кость цели в позе покоя. */
  rest: 'down' | 'up';
}

/** Сустав, у которого нужна полная ориентация: иначе поедут дети. */
interface FullJoint {
  driver: keyof BoxerRig;
  from: string;
  to: string;
  /** Пара точек, задающая поперечную ось (сторона +X минус сторона −X). */
  sideFrom: string;
  sideTo: string;
}

const FULL: FullJoint[] = [
  // Таз: от него зависит, куда вообще развёрнут боец.
  { driver: 'body', from: 'Hips', to: 'Spine1', sideFrom: 'LeftLeg', sideTo: 'RightLeg' },
  { driver: 'waist', from: 'Spine1', to: 'Spine2', sideFrom: 'LeftLeg', sideTo: 'RightLeg' },
  // Грудь несёт плечи: ошибка в скручивании здесь уводит руки целиком.
  { driver: 'chest', from: 'Spine2', to: 'Chest', sideFrom: 'LeftShoulder', sideTo: 'RightShoulder' },
  { driver: 'head', from: 'Neck1', to: 'Head', sideFrom: 'LeftEye', sideTo: 'RightEye' },
];

const AIM: AimJoint[] = [
  { driver: 'shoulderL', from: 'RightArm', to: 'RightForeArm', rest: 'down' },
  { driver: 'elbowL', from: 'RightForeArm', to: 'RightHand', rest: 'down' },
  { driver: 'shoulderR', from: 'LeftArm', to: 'LeftForeArm', rest: 'down' },
  { driver: 'elbowR', from: 'LeftForeArm', to: 'LeftHand', rest: 'down' },
  { driver: 'thighL', from: 'RightLeg', to: 'RightShin', rest: 'down' },
  { driver: 'shinL', from: 'RightShin', to: 'RightFoot', rest: 'down' },
  { driver: 'thighR', from: 'LeftLeg', to: 'LeftShin', rest: 'down' },
  { driver: 'shinR', from: 'LeftShin', to: 'LeftFoot', rest: 'down' },
];

/** Порядок решения — строго сверху вниз: ребёнок считается по готовому родителю. */
const ORDER: Array<keyof BoxerRig> = [
  'body', 'waist', 'chest', 'head',
  'shoulderL', 'elbowL', 'shoulderR', 'elbowR',
  'thighL', 'shinL', 'thighR', 'shinR',
];

// ──────────────────────────────────────────────────────────────── источник

const loader = new FBXLoader();

function loadSource(file: string): { root: THREE.Group; clip: THREE.AnimationClip } {
  const b = fs.readFileSync(path.join(SRC_DIR, file));
  const root = loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '') as THREE.Group;
  const clip = root.animations[0];
  if (!clip) throw new Error(`${file}: в файле нет анимации`);
  return { root, clip };
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

function worldPos(root: THREE.Object3D, name: string, out: THREE.Vector3): THREE.Vector3 {
  const o = root.getObjectByName(name);
  if (!o) throw new Error(`в клипе нет узла ${name}`);
  return out.setFromMatrixPosition(o.matrixWorld);
}

/** Направление сегмента в мировых координатах источника. */
function segment(root: THREE.Object3D, from: string, to: string, out: THREE.Vector3): THREE.Vector3 {
  worldPos(root, to, out);
  worldPos(root, from, _a);
  return out.sub(_a).normalize();
}

// ────────────────────────────────────────────────────────────────── запекание

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);

interface Baked {
  frames: number;
  /** Смещение таза по вертикали относительно первого кадра, метры. */
  rootY: number[];
  joints: Record<string, number[]>;
}

/**
 * Полная ориентация из «куда смотрит» + «где бок».
 * Ось up ведущая: боковая ортогонализуется по ней, иначе кривая мокап-поза
 * даёт неортогональный базис и кватернион уезжает.
 */
function orientation(up: THREE.Vector3, side: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  const y = up.clone().normalize();
  const x = side.clone().projectOnPlane(y).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}

/**
 * Высота таза стоящего актёра, см. Смещение по вертикали во всех клипах
 * считается от неё, а не от первого кадра клипа: `get_up` и `knockdown_fall`
 * НАЧИНАЮТСЯ лёжа, и «относительно первого кадра» означало бы, что боец
 * лежит на высоте стойки и потом взлетает.
 */
let standingHipY = 0;

function bake(file: string, rig: BoxerRig, drivers: Map<string, THREE.Object3D>): Baked {
  const { root: src, clip } = loadSource(file);
  const mixer = new THREE.AnimationMixer(src);
  mixer.clipAction(clip).play();

  const total = Math.round(clip.duration * FPS);
  const sample = (frame: number): void => {
    mixer.setTime(frame / FPS);
    src.updateMatrixWorld(true);
  };

  // Разворот стойки актёра гасится один раз по первому кадру: иначе к
  // повороту, который боец получает от игры, добавится ещё и мокапный, и
  // соперники встанут вполоборота к пустому углу.
  sample(0);
  const hips = src.getObjectByName('Hips')!;
  const hipsQuat0 = new THREE.Quaternion().setFromRotationMatrix(hips.matrixWorld);
  const e = new THREE.Euler().setFromQuaternion(hipsQuat0, 'YXZ');
  const correct = new THREE.Quaternion().setFromAxisAngle(UP, -e.y);

  // ...но для УДАРНОГО клипа одного таза мало, и это стоило самых странных
  // кадров в игре.
  //
  // В ударной стойке таз развёрнут к сопернику боком — на то она и стойка.
  // Угол разворота свой в каждом клипе и в каждом дубле, поэтому «погасить
  // поворот таза» не значит «повернуть бойца лицом туда, куда он бьёт».
  // Вторая половина той же проблемы: локальный поворот драйвера считается
  // как `родитель⁻¹ · мировая_цель`, то есть предполагает, что в игре
  // родитель встанет как у актёра. Для таза это неверно по построению —
  // тазом распоряжается игра, и мокапный таз в неё не приезжает (он вне
  // слоя `upper`). Разница уходила в плечо: апперкот вылетал на 57 см вбок
  // при 29 см вперёд, то есть боец бил мимо соперника.
  //
  // Лечится двумя согласованными действиями: клип доворачивается так, чтобы
  // сам удар смотрел в +Z, а таз в цепочке решается без поворота вокруг
  // вертикали — тогда рука решается относительно таза, смотрящего вперёд,
  // как оно и будет в игре. Замер после: апперкот 62 см вперёд, 28 вбок.
  //
  // И только для ударных клипов. У подъёма с настила и блоков поворот таза
  // — часть самой позы (боец переворачивается), их слой `full` берёт таз из
  // клипа, и «выпрямление» ломало им ноги: колено выгибалось назад, стопа
  // уходила на 21 см под настил.
  const STRIKE_LIMBS: Array<[string, string, string]> = [
    ['RightArm', 'RightForeArm', 'RightHand'],
    ['LeftArm', 'LeftForeArm', 'LeftHand'],
    ['RightLeg', 'RightShin', 'RightFoot'],
    ['LeftLeg', 'LeftShin', 'LeftFoot'],
  ];
  const restLen = STRIKE_LIMBS.map(([a, b, c]) =>
    worldPos(src, a, _a).distanceTo(worldPos(src, b, _b))
    + worldPos(src, b, _a).distanceTo(worldPos(src, c, _b)));

  let bestScore = 0;
  const strike = new THREE.Vector3();
  for (let f = 0; f <= total; f++) {
    sample(f);
    STRIKE_LIMBS.forEach(([root, , tip], i) => {
      const d = worldPos(src, tip, _b).sub(worldPos(src, root, _a)).applyQuaternion(correct);
      // Именно горизонтальная вытянутость: у стоящего бойца нога вытянута
      // на всю длину, но вниз, и «самой длинной конечностью» была бы она.
      const score = Math.hypot(d.x, d.z) / Math.max(1e-6, restLen[i]);
      if (score > bestScore) { bestScore = score; strike.copy(d); }
    });
  }
  // 0.72 — примерно «конечность выпрямлена и вынесена вперёд». Блок,
  // реакция и подъём до этого не дотягивают, любой удар — перекрывает.
  //
  // Порог не отделяет удар от подъёма с настила: лежащий боец вытягивается
  // не хуже бьющего (0.99 против 0.93 у бэк-кика). Поэтому вторым условием
  // идёт способ применения: клипы, у которых игра берёт таз и ноги, не
  // выпрямляются — у них поворот таза и есть часть позы.
  const isStrike = bestScore > 0.72 && !FULL_LAYER.has(path.parse(file).name);
  if (isStrike) {
    correct.premultiply(
      new THREE.Quaternion().setFromAxisAngle(UP, -Math.atan2(strike.x, strike.z)),
    );
  }

  /** Клипы в сантиметрах, как и модели. */
  const toMeters = 0.01;

  // Окно движения: сумма смещений кистей и стоп по кадрам.
  const energy: number[] = [];
  const prev = new Map<string, THREE.Vector3>();
  const probes = ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot', 'Head'];
  for (let f = 0; f <= total; f++) {
    sample(f);
    let sum = 0;
    for (const name of probes) {
      const p = worldPos(src, name, new THREE.Vector3());
      const was = prev.get(name);
      if (was) sum += p.distanceTo(was);
      prev.set(name, p);
    }
    energy.push(sum);
  }
  const peak = Math.max(...energy);
  let first = energy.findIndex((v) => v > peak * TRIM);
  let last = energy.length - 1;
  while (last > first && energy[last] <= peak * TRIM) last--;
  first = Math.max(0, first - 2);
  last = Math.min(total, last + 2);

  const out: Baked = { frames: last - first + 1, rootY: [], joints: {} };
  for (const key of ORDER) out.joints[key as string] = [];

  const up = new THREE.Vector3();
  const side = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const want = new THREE.Quaternion();
  const parentQuat = new THREE.Quaternion();

  for (let f = first; f <= last; f++) {
    sample(f);
    out.rootY.push(
      Math.round((worldPos(src, 'Hips', _a).y - standingHipY) * toMeters * ROUND) / ROUND);

    for (const key of ORDER) {
      const driver = drivers.get(key as string)!;
      const full = FULL.find((j) => j.driver === key);
      const aim = AIM.find((j) => j.driver === key);

      if (full) {
        segment(src, full.from, full.to, up).applyQuaternion(correct);
        worldPos(src, full.sideFrom, _a);
        worldPos(src, full.sideTo, _b);
        side.subVectors(_a, _b).applyQuaternion(correct);
        orientation(up, side, want);
      } else if (aim) {
        segment(src, aim.from, aim.to, dir).applyQuaternion(correct);
        // Кость цели в покое смотрит в −Y (конечности) или +Y (позвоночник);
        // кратчайшая дуга от этого направления к мокапному и есть поворот.
        want.setFromUnitVectors(aim.rest === 'down' ? DOWN : UP, dir);
      } else {
        continue;
      }

      // Таз ударного клипа решается без поворота вокруг вертикали: см.
      // длинный комментарий выше. Дети считаются по нему же, и именно это
      // выпрямляет удар — а не доворот клипа сам по себе.
      if (isStrike && key === 'body') {
        const yawless = new THREE.Euler().setFromQuaternion(want, 'YXZ');
        yawless.y = 0;
        want.setFromEuler(yawless);
      }

      // Решаем локальный поворот драйвера по уже выставленному родителю.
      driver.parent!.updateWorldMatrix(true, false);
      parentQuat.setFromRotationMatrix(driver.parent!.matrixWorld);
      _q.copy(parentQuat).invert().multiply(want);
      driver.quaternion.copy(_q);
      driver.updateWorldMatrix(false, false);

      const t = out.joints[key as string];
      t.push(
        Math.round(_q.x * ROUND) / ROUND, Math.round(_q.y * ROUND) / ROUND,
        Math.round(_q.z * ROUND) / ROUND, Math.round(_q.w * ROUND) / ROUND,
      );
    }
  }

  // Ноги едут за тазом: у бойца это отдельная группа, у мокапа — одна кость.
  out.joints.hips = out.joints.body.slice();
  void rig;
  return out;
}

// ────────────────────────────────────────────────────────────────────── main

const rig = buildMixamoBoxer({
  source: await loadBoxerModel(BOXER_MODELS.x),
  skin: 0xffffff, trunks: 0xffffff, gloves: 0xffffff,
});
rig.root.updateMatrixWorld(true);
const drivers = new Map<string, THREE.Object3D>();
for (const key of ORDER) drivers.set(key as string, rig[key] as THREE.Object3D);

// Эталон роста: первый кадр удара — актёр стоит в стойке.
{
  const { root, clip } = loadSource('jab_left.fbx');
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  mixer.setTime(0);
  root.updateMatrixWorld(true);
  standingHipY = worldPos(root, 'Hips', new THREE.Vector3()).y;
  console.log(`Таз в стойке: ${standingHipY.toFixed(1)} см
`);
}

const files = fs.readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.fbx')).sort();
const clips: Record<string, Baked> = {};
console.log('Запекание клипов:');
for (const file of files) {
  const name = path.basename(file, path.extname(file));
  const baked = bake(file, rig, drivers);
  clips[name] = baked;
  console.log(`  ${name.padEnd(24)} ${String(baked.frames).padStart(3)} кадров`
    + ` (${(baked.frames / FPS).toFixed(2)} с)`);
}

const json = JSON.stringify({ fps: FPS, clips });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, json);
console.log(`\n${files.length} клипов → ${OUT}, ${(json.length / 1024).toFixed(0)} КБ`);
