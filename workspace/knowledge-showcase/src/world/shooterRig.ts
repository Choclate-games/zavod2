import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BONES, insertJoint } from './mixamoRig';
import type { JointKey } from './shooterAnimTypes';

/**
 * Скиненный стрелок (Mixamo X Bot / Y Bot) с драйверами суставов.
 *
 * От `buildMixamoBoxer` отличается снаряжением и позой покоя, а машинерия
 * суставов — та же и живёт в `mixamoRig.ts`: между родителем и костью
 * вставляются `pivot` (гасит мировой поворот родителя) и `driver` (его крутит
 * анимация). После этого `driver.rotation` означает поворот в осях
 * персонажа, и в него ложатся числа, снятые с мокапа
 * (`scripts/bake-shooter-anim.ts`).
 *
 * **Винтовка не привязана к кости.** Она ставится каждый кадр по двум
 * запястьям: положение — от ведущей руки, направление — на поддерживающую.
 * Привязка к одной кости с фиксированным смещением выглядит правильно ровно
 * в той позе, под которую подобрано смещение, а во всех остальных вторая
 * рука висит рядом с оружием — это и читается как «странно держит оружие».
 * Здесь же оружие в обеих руках в любой позе по построению.
 */

export interface ShooterRigOptions {
  /** Уже загруженная и нормализованная модель — источник для клонирования. */
  source: THREE.Group;
  /** Цвет тела. */
  body: number;
  /** Цвет «суставов» модели — им же красится снаряжение. */
  gear: number;
  /** Собирать ли винтовку. Скрипту запекания она не нужна. */
  withRifle?: boolean;
  /** Низкий тир: без теней от модели. */
  lowDetail?: boolean;
}

export interface ShooterRig extends Record<JointKey, THREE.Group> {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  waist: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  thighL: THREE.Group;
  thighR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  /** Запястья: концы предплечий. По ним ставится оружие и строится рэгдолл. */
  wristL: THREE.Object3D;
  wristR: THREE.Object3D;
  /** Щиколотки: концы голеней. Нужны рэгдоллу — стопы отдельной кости нет. */
  ankleL: THREE.Object3D;
  ankleR: THREE.Object3D;
  /** Винтовка в руках. Ставится в `updateRifle()`. */
  rifle: THREE.Group | null;
  /** Дуло винтовки в мировых координатах — отсюда идут вспышка и трассер. */
  muzzle: THREE.Object3D | null;
  /** Пересчитать положение оружия по текущей позе рук. */
  updateRifle(): void;
  /**
   * Выпустить оружие из рук: риг перестаёт им управлять и отдаёт объект
   * вызывающему. Труп с приваренной к ладони винтовкой — тот самый кадр,
   * из-за которого рэгдолл перестаёт читаться как тело.
   */
  dropRifle(): THREE.Group | null;
  /** Красная вспышка по телу при попадании, 0..1. */
  setFlash(amount: number): void;
  /** Высота таза в позе покоя, м. */
  hipsY: number;
  /**
   * На сколько ствол в чистой стойке уведён вбок от «вперёд» персонажа, рад.
   *
   * Мокапная стойка бладированная: плечи развёрнуты, а линия кистей — та,
   * по которой считается ось ствола, — уходит от направления взгляда модели
   * на 55–60°. Развернуть врага «лицом» к игроку значит увести оружие мимо.
   * Число меряется один раз по собранному ригу, и игра поворачивает врага
   * на `нужный_курс − этот_угол`: тело встаёт боком, как и положено в
   * стрелковой стойке, а ствол смотрит на цель.
   */
  aimYawOffset: number;
  dispose(): void;
}

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);

const _wristL = new THREE.Vector3();
const _wristR = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _up = new THREE.Vector3();
const _side = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _rootQ = new THREE.Quaternion();
const _worldQ = new THREE.Quaternion();
const _worldP = new THREE.Vector3();

export function buildShooterRig(opts: ShooterRigOptions): ShooterRig {
  const root = new THREE.Group();
  const model = cloneSkinned(opts.source) as THREE.Group;
  root.add(model);
  root.updateMatrixWorld(true);

  const bone = (key: keyof typeof BONES): THREE.Bone => {
    const b = root.getObjectByName(BONES[key]) as THREE.Bone | undefined;
    if (!b) throw new Error(`shooterRig: в модели нет кости ${BONES[key]}`);
    return b;
  };

  // Материалы клонируются на каждого: вспышка от попадания — это emissive
  // конкретного материала, общий на семерых мигал бы у всех разом.
  const bodyMat = new THREE.MeshStandardMaterial({ color: opts.body, roughness: 0.7, metalness: 0.05 });
  const gearMat = new THREE.MeshStandardMaterial({ color: opts.gear, roughness: 0.8 });
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = Array.isArray(m.material) ? m.material[0]?.name ?? '' : m.material.name ?? '';
    m.material = /joint/i.test(name) ? gearMat : bodyMat;
    m.castShadow = !opts.lowDetail;
    m.receiveShadow = false;
    // Скиненный меш «уезжает» из своего AABB вместе с костями, а сфера
    // отсечения считается один раз по бинд-позе. Для лежащего трупа этого
    // достаточно, чтобы он пропал из кадра целиком.
    m.frustumCulled = false;
  });

  // Ноги живут отдельной группой от корпуса: анимация опускает таз (`hips`)
  // и наклоняет корпус (`body`) разными числами, а у Mixamo это одна кость.
  const hipsJoint = new THREE.Vector3().setFromMatrixPosition(bone('hips').matrixWorld);
  const body = new THREE.Group();
  body.name = 'body';
  body.position.copy(hipsJoint);
  root.add(body);
  body.attach(bone('hips'));
  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.copy(hipsJoint);
  root.add(hips);

  // Строго сверху вниз: pivot считается по мировой матрице родителя.
  const waist = insertJoint(bone('waist'), bone('chest'), UP);
  const chest = insertJoint(bone('chest'), bone('head'), UP);
  const head = insertJoint(bone('head'), null, null);
  const shoulderL = insertJoint(bone('shoulderL'), bone('elbowL'), DOWN);
  const elbowL = insertJoint(bone('elbowL'), bone('handL'), DOWN);
  const shoulderR = insertJoint(bone('shoulderR'), bone('elbowR'), DOWN);
  const elbowR = insertJoint(bone('elbowR'), bone('handR'), DOWN);
  const thighL = insertJoint(bone('thighL'), bone('shinL'), DOWN);
  const shinL = insertJoint(bone('shinL'), bone('footL'), DOWN);
  const thighR = insertJoint(bone('thighR'), bone('shinR'), DOWN);
  const shinR = insertJoint(bone('shinR'), bone('footR'), DOWN);
  for (const leg of [thighL, thighR]) hips.attach(leg.parent!);
  root.updateMatrixWorld(true);

  // Запястья: у драйвера локтя оси персонажа, предплечье в покое смотрит
  // в −Y, поэтому запястье — это «минус длина предплечья по Y».
  const foreLen = boneLength(bone('elbowL'), bone('handL'));
  const wristL = new THREE.Object3D();
  wristL.position.set(0, -foreLen, 0);
  elbowL.add(wristL);
  const wristR = new THREE.Object3D();
  wristR.position.set(0, -foreLen, 0);
  elbowR.add(wristR);

  const shinLen = boneLength(bone('shinL'), bone('footL'));
  const ankleL = new THREE.Object3D();
  ankleL.position.set(0, -shinLen, 0);
  shinL.add(ankleL);
  const ankleR = new THREE.Object3D();
  ankleR.position.set(0, -shinLen, 0);
  shinR.add(ankleR);

  let rifle: THREE.Group | null = null;
  let muzzle: THREE.Object3D | null = null;
  if (opts.withRifle !== false) {
    rifle = buildRifle(gearMat, !opts.lowDetail);
    muzzle = rifle.getObjectByName('muzzle')!;
    root.add(rifle);
  }

  const disposables: Array<THREE.Material | THREE.BufferGeometry> = [bodyMat, gearMat];
  if (rifle) rifle.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) disposables.push(m.geometry); });

  const rig: ShooterRig = {
    root, body, hips, waist, chest, head,
    shoulderL, shoulderR, elbowL, elbowR, thighL, thighR, shinL, shinR,
    wristL, wristR, ankleL, ankleR,
    rifle, muzzle,
    hipsY: hips.position.y,
    aimYawOffset: 0,
    updateRifle(): void {
      if (!rifle) return;
      // Ведущая рука — та, что на спусковом крючке (сторона −X), поддержка —
      // вторая. Оружие ставится между ними и смотрит вдоль линии рук.
      wristL.updateWorldMatrix(true, false);
      wristR.updateWorldMatrix(true, false);
      _wristL.setFromMatrixPosition(wristL.matrixWorld);
      _wristR.setFromMatrixPosition(wristR.matrixWorld);
      _axis.subVectors(_wristR, _wristL);
      const span = _axis.length();
      if (span < 1e-4) return;
      _axis.divideScalar(span);

      // «Верх» оружия — от груди: без него винтовка свободно крутится
      // вокруг линии рук, и магазин в случайный момент смотрит вверх.
      chest.updateWorldMatrix(true, false);
      _up.set(0, 1, 0).applyQuaternion(
        _q.setFromRotationMatrix(chest.matrixWorld),
      );
      _side.crossVectors(_axis, _up).normalize();
      _up.crossVectors(_side, _axis).normalize();
      _m.makeBasis(_side, _up, _axis.clone().negate());
      _worldQ.setFromRotationMatrix(_m);
      // Начало координат модели — на рукояти, поэтому оружие ставится в
      // ВЕДУЩУЮ кисть, а не между кистями. Середина отрезка сдвигала бы
      // винтовку на полразмаха рук вперёд: ствол торчал бы далеко перед
      // бойцом, а приклад висел на второй руке.
      _worldP.copy(_wristL).addScaledVector(_axis, -0.02);

      // Всё выше посчитано в МИРОВЫХ координатах — по мировым положениям
      // запястий. А `rifle` висит на `root`, у которого своя позиция и свой
      // поворот, и `position`/`quaternion` у него ЛОКАЛЬНЫЕ. Записать туда
      // мировые числа — значит применить трансформ рига второй раз: оружие
      // улетает на расстояние, равное позиции врага от начала координат,
      // и издали выглядит как «ствол сам по себе летает над ареной».
      // Пока риг стоял в нуле (в скрипте запекания) баг не проявлялся.
      root.updateWorldMatrix(true, false);
      root.getWorldQuaternion(_rootQ);
      rifle.quaternion.copy(_rootQ.invert()).multiply(_worldQ);
      rifle.position.copy(root.worldToLocal(_worldP));
      rifle.updateMatrixWorld(true);
    },
    dropRifle(): THREE.Group | null {
      const dropped = rifle;
      if (dropped) {
        // Мировой трансформ сохраняется: оружие продолжает падать оттуда,
        // где было в кадре смерти, а не прыгает в начало координат.
        dropped.updateWorldMatrix(true, false);
        dropped.matrix.decompose(dropped.position, dropped.quaternion, dropped.scale);
        dropped.removeFromParent();
      }
      rifle = null;
      muzzle = null;
      rig.rifle = null;
      rig.muzzle = null;
      return dropped;
    },
    setFlash(amount: number): void {
      bodyMat.emissive.setRGB(amount * 0.6, amount * 0.05, amount * 0.05);
      gearMat.emissive.setRGB(amount * 0.4, amount * 0.03, amount * 0.03);
    },
    dispose(): void {
      // Оружие могло уехать из рига в сцену вместе с рэгдоллом, но его
      // геометрия всё равно в списке: владелец геометрии — тот, кто её создал.
      for (const d of disposables) d.dispose();
      root.removeFromParent();
    },
  };
  rig.updateRifle();
  return rig;
}

function boneLength(a: THREE.Object3D, b: THREE.Object3D): number {
  a.updateWorldMatrix(true, false);
  b.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(a.matrixWorld)
    .distanceTo(new THREE.Vector3().setFromMatrixPosition(b.matrixWorld));
}

/**
 * Винтовка врага. Ось ствола — локальная −Z, начало координат — между
 * кистями: так `updateRifle` ставит её одной матрицей без доп. смещений.
 */
function buildRifle(gear: THREE.Material, shadows: boolean): THREE.Group {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.55, metalness: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4526, roughness: 0.85 });

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadows;
    g.add(m);
    return m;
  };

  add(new THREE.BoxGeometry(0.055, 0.09, 0.34), dark, 0, 0, 0.06);
  const barrel = add(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8), dark, 0, 0.012, -0.28);
  barrel.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.045, 0.045, 0.16), dark, 0, -0.005, -0.14);
  add(new THREE.BoxGeometry(0.038, 0.15, 0.07), gear, 0, -0.10, 0.02);
  add(new THREE.BoxGeometry(0.04, 0.11, 0.05), dark, 0, -0.075, 0.15);
  add(new THREE.BoxGeometry(0.045, 0.085, 0.2), wood, 0, -0.005, 0.32);
  add(new THREE.BoxGeometry(0.016, 0.028, 0.026), dark, 0, 0.06, -0.02);

  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, 0.012, -0.46);
  g.add(muzzle);
  return g;
}
