import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { readAsset } from './assetBytes';
import {
  BOXER_HEIGHT, ELBOW, KNEE, type BoxerRig, type PoseDefaults, type RagdollBone,
} from './boxerRig';

/**
 * Готовая скиненная модель (Mixamo X Bot / Y Bot) в интерфейсе `BoxerRig`.
 *
 * Задача модуля — надеть уже написанную боевую анимацию на чужой скелет, НЕ
 * переписывая её. `FightingDemo.poseRig()` знает про плечи, локти, бёдра и
 * голени как про группы, у которых поза покоя — боксёрская стойка, а оси
 * совпадают с осями персонажа. Скелет Mixamo не такой: он в T-позе, в
 * сантиметрах, и локальные оси каждой кости повёрнуты как попало (у руки
 * «вдоль кости» — это мировой X, у ноги — минус Y).
 *
 * Поэтому между родителем и костью вставляется ДВА узла:
 *
 *   parent → pivot (статичный) → driver (его крутит анимация) → bone
 *
 * `pivot` гасит мировой поворот родителя и добавляет «прицеливание»: кость
 * разворачивается так, чтобы её направление в покое совпало с направлением
 * той же кости в процедурном риге (руки и ноги смотрят в −Y, позвоночник в
 * +Y). После этого `driver.rotation` означает ровно то же, что означала
 * `shoulderL.rotation` у боксёра из коробок, — и вся фрейм-дата, дуги ударов
 * и поза подъёма работают без единой правки.
 *
 * Три вещи, на которых это ломается, если делать наивно:
 *
 * 1. **Сантиметры.** FBX из Mixamo — 180 условных единиц ростом. Масштаб
 *    нельзя вешать на корень: анимация двигает `body.position.y` на 0.2 —
 *    это метры, а внутри масштабированного узла они превратятся в 2 мм.
 *    Поэтому геометрия и кости пересчитываются в метры один раз при загрузке,
 *    и скелет перепривязывается (`bind`) уже в новом масштабе.
 * 2. **Сторона.** В `BoxerRig` «L» — это сторона −X (передняя рука в стойке),
 *    а у Mixamo −X — это цепочка `Right*`. Мапить по имени нельзя: стойка
 *    отзеркалится, и хуки пойдут не с той стороны.
 * 3. **Порядок вставки.** Pivot считает поворот по МИРОВОЙ матрице родителя,
 *    значит суставы обрабатываются сверху вниз: сначала таз, потом грудь,
 *    потом плечо. Иначе плечо прицелится к ещё неповёрнутому позвоночнику.
 *
 * Чего здесь нет по сравнению с `boxerRig.ts`: генеративных лиц, причёсок и
 * decal-следов износа — на скиненной модели рассечение рисуется текстурой, а
 * не отдельным мешем. `setDamage` вместо этого темнит кожу по зонам.
 */

export interface MixamoBoxerOptions {
  /** Уже загруженная и нормализованная модель — источник для клонирования. */
  source: THREE.Group;
  /** Цвет тела (у ботов Mixamo это один материал на всю фигуру). */
  skin: number;
  /** Цвет «суставов» — второй материал модели, им же красятся трусы. */
  trunks: number;
  /** Цвет перчаток: они добавляются мешами, в модели их нет. */
  gloves: number;
}

/** Пути к моделям в `public/` — копии из общей библиотеки `assets/`. */
export const BOXER_MODELS = {
  x: 'models/x_bot.fbx',
  y: 'models/y_bot.fbx',
} as const;

// ────────────────────────────────────────────────────────────────── загрузка

const cache = new Map<string, Promise<THREE.Group>>();

/** Загрузить и нормализовать модель. Один и тот же url грузится один раз. */
export function loadBoxerModel(url: string): Promise<THREE.Group> {
  let hit = cache.get(url);
  if (!hit) {
    hit = readAsset(url).then((bytes) => normalize(new FBXLoader().parse(bytes, '')));
    cache.set(url, hit);
  }
  return hit;
}

/**
 * Перевод модели в метры и перепривязка скелета.
 *
 * Масштабируется не узел, а сами данные: вершины геометрии и локальные
 * позиции костей. После этого текущая поза (T-поза) объявляется бинд-позой
 * заново — `new THREE.Skeleton(bones)` пересчитывает обратные матрицы по
 * мировым матрицам костей, поэтому порядок «сместили → обновили матрицы →
 * привязали» обязателен.
 */
function normalize(root: THREE.Group): THREE.Group {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const s = BOXER_HEIGHT / (box.max.y - box.min.y);

  const bones: THREE.Bone[] = [];
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      if (!bones.includes(o as THREE.Bone)) bones.push(o as THREE.Bone);
    } else if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      const m = o as THREE.SkinnedMesh;
      if (!meshes.includes(m)) meshes.push(m);
    }
  });

  for (const b of bones) b.position.multiplyScalar(s);
  const scaled = new Set<THREE.BufferGeometry>();
  for (const m of meshes) {
    if (!scaled.has(m.geometry)) {
      m.geometry.scale(s, s, s);
      scaled.add(m.geometry);
    }
    m.position.multiplyScalar(s);
    // Box3.setFromObject выше уже посчитал и закешировал габариты в
    // сантиметрах; без сброса кеша скиненный меш до конца жизни считается
    // стометровым — и всё, что меряет сцену по Box3, врёт.
    m.boundingBox = null;
    m.boundingSphere = null;
    // Рэгдолл разносит кости по всей сцене, а сфера отсечения считается по
    // бинд-позе: без этого модель исчезает ровно в момент нокдауна.
    m.frustumCulled = false;
  }
  root.updateMatrixWorld(true);
  for (const m of meshes) {
    // Пересобирать Skeleton из своего списка костей нельзя: атрибут
    // skinIndex адресует кости по ПОРЯДКУ в скелете меша, и другой порядок
    // молча привязывает живот к предплечью. Меняем только обратные матрицы.
    m.skeleton.calculateInverses();
    m.bind(m.skeleton, m.matrixWorld.clone());
  }
  root.updateMatrixWorld(true);
  return root;
}

// ─────────────────────────────────────────────────────────────────── сборка

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);

/** Кости, которые нужны анимации. «L» — сторона −X, у Mixamo это Right*. */
const BONES = {
  hips: 'mixamorigHips',
  waist: 'mixamorigSpine',
  chest: 'mixamorigSpine1',
  head: 'mixamorigHead',
  shoulderL: 'mixamorigRightArm',
  elbowL: 'mixamorigRightForeArm',
  handL: 'mixamorigRightHand',
  shoulderR: 'mixamorigLeftArm',
  elbowR: 'mixamorigLeftForeArm',
  handR: 'mixamorigLeftHand',
  thighL: 'mixamorigRightUpLeg',
  shinL: 'mixamorigRightLeg',
  footL: 'mixamorigRightFoot',
  thighR: 'mixamorigLeftUpLeg',
  shinR: 'mixamorigLeftLeg',
  footR: 'mixamorigLeftFoot',
} as const;

export function buildMixamoBoxer(opts: MixamoBoxerOptions): BoxerRig {
  const root = new THREE.Group();
  const model = cloneSkinned(opts.source) as THREE.Group;
  root.add(model);
  root.updateMatrixWorld(true);

  const bone = (key: keyof typeof BONES): THREE.Bone => {
    // Искать надо от корня рига, а не от модели: таз со всем корпусом
    // переезжает в группу `body`, и из `model` его уже не видно.
    const b = root.getObjectByName(BONES[key]) as THREE.Bone | undefined;
    if (!b) throw new Error(`mixamoRig: в модели нет кости ${BONES[key]}`);
    return b;
  };

  // Материалы клонируются: у бойцов разные цвета, а вспышка от удара — это
  // emissive конкретного материала, общий на двоих мигал бы у обоих.
  const skinMat = new THREE.MeshStandardMaterial({ color: opts.skin, roughness: 0.65, metalness: 0.05 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: opts.trunks, roughness: 0.8 });
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = Array.isArray(m.material) ? m.material[0]?.name ?? '' : m.material.name ?? '';
    m.material = /joint/i.test(name) ? trunkMat : skinMat;
    m.castShadow = true;
  });

  // Скелет Mixamo — одно дерево из таза: и ноги, и корпус висят на Hips.
  // Анимация же считает таз и корпус РАЗНЫМИ узлами (`hips` опускает ноги,
  // `body` наклоняет корпус) — иначе поза нокдауна складывает оба смещения
  // и боец уезжает под настил. Поэтому ноги переносятся под отдельную
  // группу, а таз остаётся в корпусе.
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

  // Суставы — строго сверху вниз: pivot считается по мировой матрице родителя.
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
  // attach, а не add: мировое положение ног сохраняется, меняется только
  // то, за чьей группой они теперь следуют.
  for (const leg of [thighL, thighR]) hips.attach(leg.parent!);

  root.updateMatrixWorld(true);

  // Перчатки и капа: в модели их нет, а игра на них смотрит — по перчатке
  // считается след удара, капа вылетает на нокдауне.
  const gloveMat = new THREE.MeshStandardMaterial({ color: opts.gloves, roughness: 0.45 });
  const forearm = boneLength(bone('elbowL'), bone('handL'));
  // Размер кисти модели: у X Bot и Y Bot он разный, и перчатка обязана
  // быть от него, а не от константы.
  const hand = handSpan(bone('handL'));
  const gloveL = buildGlove(gloveMat, forearm, hand);
  const gloveR = buildGlove(gloveMat, forearm, hand);
  elbowL.add(gloveL);
  elbowR.add(gloveR);

  const mouthguard = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.018, 0.015),
    new THREE.MeshBasicMaterial({ color: 0x6d2020 }),
  );
  // Локальные оси драйвера совпадают с осями персонажа, поэтому рот — это
  // просто «чуть выше сустава шеи и вперёд», без разбора осей кости.
  mouthguard.position.set(0, 0.1, 0.12);
  head.add(mouthguard);

  const defaults: PoseDefaults = {
    // Поза покоя берётся из собранного рига, а не из нулей: `body` и `hips`
    // стоят на высоте таза, и обнуление их позиции уронило бы бойца в пол.
    bodyPos: body.position.clone(),
    bodyRot: new THREE.Euler(),
    chestRot: new THREE.Euler(),
    headRot: new THREE.Euler(),
    headPos: new THREE.Vector3(),
    // Те же числа, что у процедурного бойца: прицеливание костей сделало
    // позы совместимыми, значит и стойка должна быть той же самой.
    // Разворот внутрь меньше, чем у боксёра из коробок (0.34 / 0.3): плечи
    // у модели уже на 13 см, и от тех же чисел перчатки сходятся вплотную.
    shoulderL: new THREE.Euler(-0.78, 0.2, -0.2),
    shoulderR: new THREE.Euler(-0.78, -0.2, 0.2),
    elbowL: new THREE.Euler(-1.95, 0, 0.16),
    elbowR: new THREE.Euler(-1.95, 0, -0.16),
    hipsY: hips.position.y,
    boneRest: [],
  };
  shoulderL.rotation.copy(defaults.shoulderL);
  shoulderR.rotation.copy(defaults.shoulderR);
  elbowL.rotation.copy(defaults.elbowL);
  elbowR.rotation.copy(defaults.elbowR);

  const skinBase = skinMat.color.clone();

  const rig: BoxerRig = {
    root, body, hips, waist, chest, head,
    shoulderL, shoulderR, elbowL, elbowR,
    gloveL, gloveR, mouthguard,
    thighL, thighR, shinL, shinR,
    defaults,
    setFlash(amount) {
      skinMat.emissive.setRGB(amount * 0.5, amount * 0.06, amount * 0.06);
    },
    setDamage(headDmg, bodyDmg) {
      // Одна скиненная модель — один материал на всё тело, отдельных зон у
      // неё нет. Поэтому износ читается как общее потемнение и краснота:
      // decal-следы из `boxerRig.ts` тут пришлось бы рисовать в текстуру.
      const wear = Math.max(headDmg, bodyDmg);
      skinMat.color.copy(skinBase).lerp(WEAR_COLOR, wear * 0.55);
    },
    ragdollBones(): RagdollBone[] {
      // Порядок «листья → корень» тот же, что у процедурного рига, но
      // габариты приходят не из Box3: у костей нет геометрии, и AABB
      // подграфа пустой. Считаем коробки по длине сегмента скелета.
      const limb = (a: THREE.Object3D, b: THREE.Object3D, w: number) =>
        boxFromSegment(a, b, w);
      return [
        { name: 'head', object: head, mass: 5, parent: null, worldBox: sphereBox(head, 0.13, 0.1) },
        // Конечности разбиты по суставам: цельная «рука от плеча до
        // перчатки» — это доска, которая в падении не гнётся нигде, и
        // именно от неё рэгдолл выглядел кучей палок.
        {
          name: 'foreL', object: elbowL, mass: 1.8, parent: 'armL',
          worldBox: limb(bone('elbowL'), bone('handL'), 0.075), hinge: ELBOW(elbowL),
        },
        {
          name: 'foreR', object: elbowR, mass: 1.8, parent: 'armR',
          worldBox: limb(bone('elbowR'), bone('handR'), 0.075), hinge: ELBOW(elbowR),
        },
        {
          name: 'armL', object: shoulderL, mass: 2.2, parent: 'chest',
          worldBox: limb(bone('shoulderL'), bone('elbowL'), 0.085),
        },
        {
          name: 'armR', object: shoulderR, mass: 2.2, parent: 'chest',
          worldBox: limb(bone('shoulderR'), bone('elbowR'), 0.085),
        },
        {
          name: 'shinL', object: shinL, mass: 4, parent: 'legL',
          worldBox: limb(bone('shinL'), bone('footL'), 0.085), hinge: KNEE(shinL),
        },
        {
          name: 'shinR', object: shinR, mass: 4, parent: 'legR',
          worldBox: limb(bone('shinR'), bone('footR'), 0.085), hinge: KNEE(shinR),
        },
        {
          name: 'legL', object: thighL, mass: 7, parent: 'hips',
          worldBox: limb(bone('thighL'), bone('shinL'), 0.105),
        },
        {
          name: 'legR', object: thighR, mass: 7, parent: 'hips',
          worldBox: limb(bone('thighR'), bone('shinR'), 0.105),
        },
        {
          name: 'chest', object: chest, mass: 17, parent: 'head',
          worldBox: limb(bone('chest'), bone('head'), 0.19),
        },
        {
          name: 'waist', object: waist, mass: 12, parent: 'chest',
          worldBox: limb(bone('waist'), bone('chest'), 0.17),
        },
        // Кость таза живёт в `body` (см. выше), поэтому в рэгдолл уходит
        // именно она: `hips` к этому моменту — пустая группа без ног.
        { name: 'hips', object: body, mass: 10, parent: 'waist', worldBox: sphereBox(hips, 0.16, 0) },
      ];
    },
  };

  rig.defaults.boneRest = rig.ragdollBones().map((b) => ({
    object: b.object,
    position: b.object.position.clone(),
    quaternion: b.object.quaternion.clone(),
  }));
  return rig;
}

/** Цвет, к которому уходит кожа по мере износа: синяк, а не грязь. */
const WEAR_COLOR = new THREE.Color(0x5a1f22);

/**
 * Вставить сустав над костью: `pivot` → `driver` → `aim` → кость.
 *
 * `pivot` гасит мировой поворот родителя, `driver` отдан анимации, `aim`
 * доворачивает кость в позу покоя. Поворот прицеливания считается
 * кратчайшей дугой от текущего направления «на ребёнка» к нужному, поэтому
 * скручивание вокруг самой кости не контролируется — для конечностей в
 * перчатках это незаметно, а для позвоночника поворот и так почти нулевой.
 */
function insertJoint(
  b: THREE.Bone,
  child: THREE.Object3D | null,
  aim: THREE.Vector3 | null,
): THREE.Group {
  const parent = b.parent;
  if (!parent) throw new Error(`mixamoRig: кость ${b.name} без родителя`);
  parent.updateWorldMatrix(true, false);
  b.updateWorldMatrix(true, false);

  const restWorld = new THREE.Quaternion().setFromRotationMatrix(b.matrixWorld);
  const parentWorld = new THREE.Quaternion().setFromRotationMatrix(parent.matrixWorld);

  const rotate = new THREE.Quaternion();
  if (child && aim) {
    const joint = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
    const tip = child.position.clone().applyMatrix4(b.matrixWorld).sub(joint).normalize();
    rotate.setFromUnitVectors(tip, aim);
  }

  const pivot = new THREE.Group();
  pivot.name = `${b.name}__pivot`;
  pivot.position.copy(b.position);
  // Мировой поворот pivot — ровно обратный родительскому, поэтому оси
  // driver совпадают с осями персонажа.
  pivot.quaternion.copy(parentWorld).invert();

  const driver = new THREE.Group();
  driver.name = `${b.name}__driver`;
  // Прицеливание живёт НИЖЕ driver, а не выше: если повернуть им сам pivot,
  // вместе с костью развернутся и оси анимации — у руки, опущенной из
  // T-позы поворотом вокруг Z, «вперёд» станет «вверх», и локоть сложится
  // не в ту сторону. Это была первая версия, и она выглядела так, будто
  // боец держит гард наизнанку.
  const tilt = new THREE.Group();
  tilt.name = `${b.name}__aim`;
  tilt.quaternion.copy(rotate);

  pivot.add(driver);
  driver.add(tilt);
  parent.add(pivot);
  tilt.add(b);

  b.position.set(0, 0, 0);
  // Мировая ориентация кости = rotate * (её ориентация в T-позе): вся ветка
  // разворачивается вокруг сустава, ничего не разъезжается.
  b.quaternion.copy(restWorld);
  pivot.updateWorldMatrix(true, true);
  return driver;
}

function boneLength(a: THREE.Object3D, b: THREE.Object3D): number {
  a.updateWorldMatrix(true, false);
  b.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(a.matrixWorld)
    .distanceTo(new THREE.Vector3().setFromMatrixPosition(b.matrixWorld));
}

/** Коробка рэгдолла по отрезку скелета: от сустава до сустава плюс толщина. */
function boxFromSegment(a: THREE.Object3D, b: THREE.Object3D, half: number) {
  return (target: THREE.Box3): void => {
    a.updateWorldMatrix(true, false);
    b.updateWorldMatrix(true, false);
    const pa = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld);
    const pb = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
    target.setFromPoints([pa, pb]).expandByScalar(half);
  };
}

/** Коробка вокруг сустава: голова и таз — это не отрезок, а комок. */
function sphereBox(joint: THREE.Object3D, half: number, up: number) {
  return (target: THREE.Box3): void => {
    joint.updateWorldMatrix(true, false);
    const p = new THREE.Vector3().setFromMatrixPosition(joint.matrixWorld);
    p.y += up;
    target.setFromCenterAndSize(p, new THREE.Vector3(half * 2, half * 2, half * 2));
  };
}

/**
 * Перчатка на запястье. Крепится к driver локтя, а не к кости кисти: у
 * driver оси персонажа и предплечье в покое смотрит в −Y, поэтому запястье —
 * это просто «минус длина предплечья по Y».
 *
 * Форма — сплюснутый эллипсоид, а не коробка, и размер взят от кисти
 * модели, а не «на глаз». Первая версия была кубом 0.15 × 0.21 × 0.17 —
 * это размером с голову бойца, и в кадре читалось как два синих ящика,
 * летающих рядом с руками, а не как перчатки. Сравнивать надо с головой:
 * боксёрская перчатка примерно вдвое меньше её по каждой оси.
 *
 * Масштаб задаётся ГЕОМЕТРИИ, а не мешу: `scale` перчатки занят squash &
 * stretch на выпаде (`poseRig`), и любой неединичный базовый масштаб он
 * затирает — перчатка на первом же ударе становилась шаром.
 */
/**
 * Длина кисти: от запястья до самого дальнего потомка в скелете. У Mixamo
 * это средний палец, и мерить надо именно по костям — у меша один общий
 * `Box3` на всё тело, отдельной кисти в нём нет.
 */
function handSpan(hand: THREE.Bone): number {
  hand.updateWorldMatrix(true, true);
  const origin = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld);
  const tip = new THREE.Vector3();
  let span = 0;
  hand.traverse((o) => {
    tip.setFromMatrixPosition(o.matrixWorld);
    span = Math.max(span, origin.distanceTo(tip));
  });
  return span > 0.02 ? span : 0.09;
}

function buildGlove(mat: THREE.Material, forearm: number, hand: number): THREE.Mesh {
  const r = THREE.MathUtils.clamp(hand * 0.62, 0.045, 0.075);
  const shell = new THREE.SphereGeometry(1, 14, 10);
  shell.scale(r * 0.92, r * 1.25, r * 1.05);
  const glove = new THREE.Mesh(shell, mat);
  // Центр перчатки — на середине кисти: с центром на запястье из неё
  // торчали пальцы модели, а это первое, что видно в кадре.
  glove.position.set(0, -forearm - hand * 0.45, 0.005);
  glove.castShadow = true;

  const thumbGeom = new THREE.SphereGeometry(1, 10, 8);
  thumbGeom.scale(r * 0.42, r * 0.5, r * 0.42);
  const thumb = new THREE.Mesh(thumbGeom, mat);
  thumb.position.set(0, r * 0.35, r * 0.85);
  glove.add(thumb);
  return glove;
}
