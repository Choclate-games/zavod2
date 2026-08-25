import * as THREE from 'three';
import { JOINTS, POSE_SIZE, type CycleClip, type PoseClip } from './shooterAnimTypes';
import { SHOOTER_ANIM } from './shooterAnimData';
import type { ShooterRig } from './shooterRig';

/**
 * Проигрыватель процедурной анимации стрелка.
 *
 * Никакого `AnimationMixer`: поза собирается из чисел, снятых с мокапа
 * (`scripts/bake-shooter-anim.ts`), четырьмя слоями поверх друг друга.
 *
 *   стойка с винтовкой  →  цикл хода (по фазе)  →  + выстрел  →  + попадание
 *
 * Порядок и способ смешивания здесь важнее самих чисел:
 *
 * 1. **Ход — по ФАЗЕ, а не по времени.** Фаза гонится пройденным путём,
 *    поделённым на длину шага из мокапа. Враг, идущий вдвое медленнее,
 *    получает вдвое более медленный шаг бесплатно и без рассинхрона: ноги
 *    не «едут» по земле ни на какой скорости.
 * 2. **Выстрел и попадание — ДЕЛЬТЫ**, а не позы. Их можно подмешать к
 *    любому кадру хода, и враг стреляет и дёргается на бегу. Абсолютная
 *    поза на их месте останавливала бы бегущего в кадре выстрела.
 * 3. **Смерть — абсолютная поза** и перекрывает всё: у падения нет смысла
 *    «наполовину».
 * 4. **Голова добавляется сверху кодом.** Мокап не знает, где игрок, а
 *    доворот головы на цель — это половина ощущения, что тебя видят.
 */

const A = SHOOTER_ANIM;

/** Какой цикл хода играет сейчас. */
export type LocoCycle = 'run' | 'strafe' | 'backward';
export type HitZone = 'head' | 'body' | 'limb';

export interface ShooterAnimState {
  /** Фаза цикла хода, радианы. */
  phase: number;
  /** Сколько в позе от цикла хода: 0 — чистая стойка, 1 — чистый ход. */
  moveBlend: number;
  cycle: LocoCycle;
  /** Время внутри клипа выстрела; ≥ duration — не играет. */
  fireT: number;
  hitT: number;
  hitClip: PoseClip;
  /** Время внутри падения; < 0 — жив. */
  deathT: number;
  /** Собственные часы для дыхания стойки. */
  breath: number;
  /** Доворот головы на игрока, рад. */
  headYaw: number;
  headPitch: number;
}

export function createShooterAnim(seed = 0): ShooterAnimState {
  return {
    // Разная стартовая фаза: семеро врагов, шагающих строго в ногу, —
    // первое, что бросается в глаза как «клоны».
    phase: seed * 1.7,
    moveBlend: 0,
    cycle: 'run',
    fireT: 99,
    hitT: 99,
    hitClip: A.hits.body,
    deathT: -1,
    breath: seed * 2.3,
    headYaw: 0,
    headPitch: 0,
  };
}

export function triggerFire(st: ShooterAnimState): void {
  st.fireT = 0;
}

export function triggerHit(st: ShooterAnimState, zone: HitZone): void {
  // Реакция перезапускается с нуля на каждом попадании: очередь в упор
  // должна складывать врага, а не проигрываться один раз на всю очередь.
  st.hitT = 0;
  st.hitClip = zone === 'head' ? A.hits.head : zone === 'limb' ? A.hits.body : A.hits.chest;
}

export function triggerDeath(st: ShooterAnimState): void {
  if (st.deathT < 0) st.deathT = 0;
}

export interface LocoInput {
  /** Скорость по земле, м/с. */
  speed: number;
  /** Куда идёт относительно взгляда: 1 вперёд, -1 назад, 0 боком. */
  forward: number;
  /** Насколько движение боковое, 0..1. */
  side: number;
}

export function updateShooterAnim(st: ShooterAnimState, dt: number, loco: LocoInput): void {
  st.breath += dt;
  st.fireT += dt;
  st.hitT += dt;
  if (st.deathT >= 0) { st.deathT += dt; return; }

  // Цикл выбирается по направлению движения, а не по клавише: враг,
  // отходящий назад, обязан отходить спиной, иначе он «убегает лицом».
  st.cycle = loco.side > 0.6 ? 'strafe' : loco.forward < -0.3 ? 'backward' : 'run';
  const clip = A.cycles[st.cycle];

  // Фаза = пройденный путь / длина шага. Один оборот ряда — один полный
  // цикл мокапа, то есть два шага.
  const cyclesPerMeter = 1 / Math.max(0.1, clip.stride * 2);
  st.phase += loco.speed * dt * cyclesPerMeter * Math.PI * 2;
  if (st.phase > Math.PI * 2) st.phase -= Math.PI * 2;

  const target = THREE.MathUtils.clamp(loco.speed / 2.2, 0, 1);
  st.moveBlend = THREE.MathUtils.lerp(st.moveBlend, target, 1 - Math.exp(-9 * dt));
}

// ───────────────────────────────────────────────────────────── вычисление

const base = new Float32Array(POSE_SIZE);
const cyclePose = new Float32Array(POSE_SIZE);
const delta = new Float32Array(POSE_SIZE);

function evalFourier(coef: number[], phase: number): number {
  let v = coef[0];
  const h = (coef.length - 1) / 2;
  for (let k = 1; k <= h; k++) {
    v += coef[k * 2 - 1] * Math.cos(k * phase) + coef[k * 2] * Math.sin(k * phase);
  }
  return v;
}

function evalCycle(clip: CycleClip, phase: number, out: Float32Array): void {
  for (let i = 0; i < POSE_SIZE; i++) out[i] = evalFourier(clip.coef[i], phase);
}

/** Позу одиночного клипа — линейной интерполяцией между ключами. */
function evalPose(clip: PoseClip, t: number, out: Float32Array): void {
  const times = clip.times;
  const n = times.length;
  if (t <= times[0]) { for (let i = 0; i < POSE_SIZE; i++) out[i] = clip.pose[0][i]; return; }
  if (t >= times[n - 1]) { for (let i = 0; i < POSE_SIZE; i++) out[i] = clip.pose[n - 1][i]; return; }
  let k = 1;
  while (k < n - 1 && times[k] < t) k++;
  const a = clip.pose[k - 1];
  const b = clip.pose[k];
  const f = (t - times[k - 1]) / Math.max(1e-6, times[k] - times[k - 1]);
  for (let i = 0; i < POSE_SIZE; i++) out[i] = a[i] + (b[i] - a[i]) * f;
}

/**
 * Огибающая одиночного движения: быстрый вход, медленный выход.
 *
 * Симметричный `sin(πt)` даёт «наплыв» вместо удара — реакция на попадание
 * должна начинаться в тот же кадр, что и попадание, иначе она читается как
 * отдельное событие, а не как следствие.
 */
function envelope(t: number, duration: number): number {
  if (t < 0 || t >= duration) return 0;
  const p = t / duration;
  return p < 0.18 ? p / 0.18 : 1 - (p - 0.18) / 0.82;
}

/** Собрать позу и разложить её по драйверам рига. */
export function poseShooter(st: ShooterAnimState, rig: ShooterRig): void {
  // 1. Стойка с винтовкой. Дыхание — та же выборка ряда, только по времени.
  const breathPhase = (st.breath % 3.07) / 3.07 * Math.PI * 2;
  for (let i = 0; i < POSE_SIZE; i++) base[i] = evalFourier(A.aim[i], breathPhase);

  let hipY = 0;
  if (st.deathT >= 0) {
    // 2а. Смерть перекрывает всё; вход за 0.12 с, чтобы не было щелчка.
    evalPose(A.death, Math.min(st.deathT, A.death.duration), delta);
    const w = Math.min(1, st.deathT / 0.12);
    for (let i = 0; i < POSE_SIZE; i++) base[i] += (delta[i] - base[i]) * w;
    const k = Math.min(A.deathHip.length - 1, Math.floor(st.deathT / A.death.duration * (A.deathHip.length - 1)));
    hipY = A.deathHip[k] * w;
  } else {
    // 2б. Ход подмешивается к стойке по величине скорости.
    const clip = A.cycles[st.cycle];
    if (st.moveBlend > 0.001) {
      evalCycle(clip, st.phase, cyclePose);
      for (let i = 0; i < POSE_SIZE; i++) base[i] += (cyclePose[i] - base[i]) * st.moveBlend;
      hipY = evalFourier(clip.hipBob, st.phase) * st.moveBlend;
    }

    // 3. Выстрел: дельта к текущей позе.
    const fireW = envelope(st.fireT, A.fire.duration);
    if (fireW > 0) {
      evalPose(A.fire, st.fireT, delta);
      for (let i = 0; i < POSE_SIZE; i++) base[i] += delta[i] * fireW;
    }

    // 4. Реакция на попадание — поверх всего остального.
    const hitW = envelope(st.hitT, st.hitClip.duration);
    if (hitW > 0) {
      evalPose(st.hitClip, st.hitT, delta);
      for (let i = 0; i < POSE_SIZE; i++) base[i] += delta[i] * hitW;
    }
  }

  for (let j = 0; j < JOINTS.length; j++) {
    const d = rig[JOINTS[j]];
    d.rotation.set(base[j * 3], base[j * 3 + 1], base[j * 3 + 2]);
  }
  // Голова довернута на игрока поверх мокапа, и только пока враг жив.
  if (st.deathT < 0) {
    rig.head.rotation.y += st.headYaw;
    rig.head.rotation.x += st.headPitch;
  }
  rig.hips.position.y = rig.hipsY + hipY;
  rig.body.position.y = rig.hipsY + hipY;
  rig.root.updateMatrixWorld(true);
  rig.updateRifle();
}

/** Длительности — нужны игре, чтобы знать, когда реакция кончилась. */
export const SHOOTER_DURATIONS = {
  fire: A.fire.duration,
  hit: A.hits.body.duration,
  death: A.death.duration,
} as const;

// ─────────────────────────────────────────────────────── наводка на цель

const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const IDENTITY = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _barrel = new THREE.Vector3();
const _want = new THREE.Vector3();
const BARREL = new THREE.Vector3(0, 0, -1);

/**
 * Померить, куда смотрит ствол в чистой стойке, и записать это в риг.
 *
 * Ось ствола считается по линии кистей (`shooterRig.updateRifle`), а мокапная
 * стойка бладированная — плечи развёрнуты к цели боком. В сумме ствол уходит
 * от «вперёд» модели на 55–60°: враг, развёрнутый лицом к игроку, целится
 * мимо него, и это читается как «он в меня стреляет, но на меня не смотрит».
 *
 * Число зависит от пропорций модели (у X Bot и Y Bot они разные), поэтому
 * оно не константа, а замер по собранному ригу — один раз при создании.
 */
export function calibrateAim(rig: ShooterRig): void {
  if (!rig.rifle) return;
  const keepYaw = rig.root.rotation.y;
  const keepPos = rig.root.position.clone();
  rig.root.rotation.y = 0;
  rig.root.position.set(0, 0, 0);

  const probe = createShooterAnim(0);
  probe.breath = 0;
  poseShooter(probe, rig);
  _barrel.copy(BARREL).applyQuaternion(rig.rifle.getWorldQuaternion(_q1)).setY(0);
  rig.aimYawOffset = _barrel.lengthSq() > 1e-6 ? Math.atan2(_barrel.x, _barrel.z) : 0;

  rig.root.rotation.y = keepYaw;
  rig.root.position.copy(keepPos);
  rig.root.updateMatrixWorld(true);
}

/**
 * Довернуть корпус так, чтобы ствол смотрел ровно в точку.
 *
 * Постоянный `aimYawOffset` снимает основную ошибку стойки, но не остаток:
 * цель бывает выше или ниже, руки качаются в цикле бега, реакция на попадание
 * уводит корпус. Остаток добирается здесь — поворотом ГРУДИ, а не всего
 * врага: руки висят на груди и едут вместе с ней, поэтому хват не ломается,
 * а таз и ноги продолжают жить своей анимацией.
 *
 * Поворот считается точно — как кватернион «из текущего направления ствола в
 * нужное», а не подбором углов: ствол смотрит вбок от оси груди, и наклон
 * груди на угол `a` доворачивает ствол лишь на `a·cos(угол между ними)`.
 * Подбор по одной оси промахивался бы вдвое.
 *
 * @param limit максимальный доворот, рад. Без него корпус выкручивается
 *   вслед за бегущим игроком в невозможную позу.
 */
export function aimShooterAt(rig: ShooterRig, target: THREE.Vector3, limit = 0.5): void {
  if (!rig.rifle || !rig.muzzle) return;
  rig.muzzle.getWorldPosition(_v1);
  _want.subVectors(target, _v1);
  if (_want.lengthSq() < 1e-6) return;
  _want.normalize();
  _barrel.copy(BARREL).applyQuaternion(rig.rifle.getWorldQuaternion(_q1)).normalize();

  _q2.setFromUnitVectors(_barrel, _want);
  const angle = 2 * Math.acos(Math.min(1, Math.abs(_q2.w)));
  if (angle > limit) _q2.slerp(IDENTITY, 1 - limit / angle);

  // Поворот посчитан в мире, а класть его надо в локальный кватернион груди:
  // q_local = P⁻¹ · q_мир · P · q_local, где P — мировой поворот родителя.
  const parent = rig.chest.parent;
  if (!parent) return;
  parent.updateWorldMatrix(true, false);
  parent.getWorldQuaternion(_q1);
  _q3.copy(_q1).invert();
  rig.chest.quaternion.premultiply(_q1).premultiply(_q2).premultiply(_q3);

  rig.root.updateMatrixWorld(true);
  rig.updateRifle();
}
