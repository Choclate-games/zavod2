import * as THREE from 'three';

/**
 * Процедурный боксёр: сегментированный позвоночник, лицо, перчатки, износ.
 *
 * Референс подхода — проект PunchBox (`src/entities/Boxer.js`): персонаж
 * собирается из боксов кодом, без .gltf, но читается как человек, а не как
 * стопка кубиков. Четыре вещи, которые дают это ощущение:
 *
 * 1. **Позвоночник из двух сегментов** (`waist` → `chest`). Один торс-кубик не
 *    умеет уклоняться: наклон корпуса и разворот плеч — разные оси в разных
 *    точках. Слип (уклон) без сегментов выглядит как падающая доска.
 * 2. **Каждая степень свободы — своя группа.** Плечо → локоть → предплечье:
 *    один Object3D с Euler('XYZ') на две оси скручивает конечность
 *    (CRITICAL_RULES §55).
 * 3. **Лицо детерминировано по индексу.** Маленький seeded-PRNG выбирает
 *    глаза/брови/нос/челюсть, поэтому боец №3 всегда одинаковый, а ростер
 *    масштабируется без ручной работы.
 * 4. **Износ виден на модели.** Синяки и рассечения проявляются по зонам
 *    (голова/корпус) — куда били, там и следы. Полоса здоровья говорит
 *    цифру, модель говорит историю боя.
 *
 * Все размеры в метрах, начало координат `root` — между ступнями (y = 0).
 */

export interface BoxerOptions {
  /** Цвет кожи. */
  skin: number;
  /** Цвет трусов. */
  trunks: number;
  /** Цвет перчаток. */
  gloves: number;
  /** Цвет волос. */
  hair: number;
  /** 0 — сухой, 1 — тяжеловес. Влияет на ширину торса и толщину рук. */
  build: number;
  /** Индекс лица: детерминированно задаёт черты. */
  face: number;
  /** Стиль причёски 0..4. */
  hairStyle: number;
  /** Низкий тир: без следов урона и мелких деталей. */
  lowDetail?: boolean;
}

/** Кость для рэгдолла: подграф рига + масса. Габариты считаются по Box3. */
export interface RagdollBone {
  name: string;
  object: THREE.Object3D;
  mass: number;
  /** С кем соединён суставом (имя ранее объявленной кости). */
  parent: string | null;
  /**
   * Габариты кости в мировых координатах. Нужны, когда подграф кости не
   * содержит геометрии и `Box3.setFromObject` пустой, — так устроен любой
   * скиненный риг (`mixamoRig.ts`): меш один, а костей сотня.
   */
  worldBox?: (target: THREE.Box3) => void;
  /**
   * Шарнир вместо шара. Колено и локоть — это одна ось и одна сторона: без
   * этого рэгдолл складывается в кучу, потому что шаровой сустав разрешает
   * голени уехать вперёд через бедро, а предплечью — сквозь плечо.
   *
   * Пределы сустава отсчитываются от позы В МОМЕНТ НОКДАУНА, а не от нуля:
   * тела рэгдолла создаются без поворота, поэтому «угол ноль» у сустава —
   * это то, как боец стоял, когда его сбили. Отсюда `now()`.
   */
  hinge?: {
    /** Анатомический предел сгиба, рад. Колено ~2.4, локоть ~2.6. */
    max: number;
    /** Знак сгиба вокруг оси X персонажа: +1 колено, −1 локоть. */
    sign: 1 | -1;
    /** Текущий сгиб в позе, рад (всегда ≥ 0). */
    now(): number;
  };
}

export interface BoxerRig {
  root: THREE.Group;
  /** Корень корпуса: сюда идут наклоны, слипы и общий «вес» позы. */
  body: THREE.Group;
  hips: THREE.Group;
  waist: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  gloveL: THREE.Mesh;
  gloveR: THREE.Mesh;
  /** Капа: на нокдауне вылетает отдельным физическим телом. */
  mouthguard: THREE.Mesh;
  thighL: THREE.Group;
  thighR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  /** Поза покоя: цель, к которой возвращается любая анимация. */
  defaults: PoseDefaults;
  /** Красная вспышка по всему телу при получении урона, 0..1. */
  setFlash(amount: number): void;
  /** Проявление износа по зонам, 0..1 каждая. */
  setDamage(head: number, body: number): void;
  /** Кости для рэгдолла в порядке «листья → корень». */
  ragdollBones(): RagdollBone[];
}

/**
 * Шарниры колена и локтя одинаковы у обоих ригов, поэтому описаны здесь.
 *
 * Знак берётся из той же алгебры, что и поза (§6 документа о риге): по осям
 * персонажа поворот вокруг +X уводит «вниз» назад, значит сгиб колена (пятка
 * к ягодице) — это плюс, а сгиб локтя (кисть вперёд, к плечу) — минус.
 * Драйвер хранит поворот с обратным знаком, отсюда `-rotation.x` у локтя.
 */
export const KNEE = (shin: THREE.Object3D): RagdollBone['hinge'] => ({
  max: 2.4, sign: 1, now: () => Math.max(0, shin.rotation.x),
});
export const ELBOW = (elbow: THREE.Object3D): RagdollBone['hinge'] => ({
  max: 2.6, sign: -1, now: () => Math.max(0, -elbow.rotation.x),
});

/** Снимок локального трансформа кости — чтобы вернуть её после рэгдолла. */
interface BoneRest {
  object: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export interface PoseDefaults {
  bodyPos: THREE.Vector3;
  bodyRot: THREE.Euler;
  chestRot: THREE.Euler;
  headRot: THREE.Euler;
  headPos: THREE.Vector3;
  shoulderL: THREE.Euler;
  shoulderR: THREE.Euler;
  elbowL: THREE.Euler;
  elbowR: THREE.Euler;
  hipsY: number;
  /** Локальные трансформы костей рэгдолла на момент сборки. */
  boneRest: BoneRest[];
}

/** Высота головы над полом в стойке — по ней целятся хитбоксы в голову. */
export const BOXER_HEAD_Y = 1.62;
/** Высота корпуса над полом — цель для ударов по корпусу. */
export const BOXER_BODY_Y = 1.16;
/** Полная высота бойца в стойке. */
export const BOXER_HEIGHT = 1.78;

/**
 * Разворот бойца к сопернику. Модель смотрит в +Z, соперник стоит по оси X,
 * поэтому «повернуться к нему» — это ±90°, а не ±180°: поворот на π показал
 * бы камере спину, и весь бой пришлось бы смотреть в затылок. Вычитаемые
 * 0.32 рад — полубоковая стойка: боец открыт зрителю, но плечо всё равно
 * ведёт вперёд, как в боксе.
 */
export function boxerYaw(facing: 1 | -1): number {
  return facing * (Math.PI / 2 - 0.32);
}

export function buildBoxer(opts: BoxerOptions): BoxerRig {
  const detail = !opts.lowDetail;
  const root = new THREE.Group();

  const skinMat = std(opts.skin, 0.65, true);
  const hairMat = std(opts.hair, 0.85, true);
  const trunksMat = std(opts.trunks, 0.7, true);
  const gloveMat = std(opts.gloves, 0.5);
  const wrapMat = std(0xf2efe6, 0.8);
  const trimMat = std(0xd8d2c4, 0.6);
  const shoeMat = std(0x1d1f26, 0.5);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x14100f });

  // Телосложение: 0.5 — «эталонные» пропорции, края — сухой и тяжёлый.
  const bw = 0.78 + opts.build * 0.44;   // ширина/глубина торса
  const aw = 0.82 + opts.build * 0.36;   // толщина рук

  // ───────────────────────────────────────────────── ноги (свой корень)
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  const hipBlock = mesh(new THREE.BoxGeometry(0.4 * bw, 0.12, 0.26), trunksMat);
  hips.add(hipBlock);

  const legs = [-1, 1].map((side) => {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.105, -0.04, side * 0.07);   // косая стойка
    hips.add(thigh);
    const thighMesh = mesh(new THREE.BoxGeometry(0.17, 0.4, 0.18), skinMat);
    thighMesh.position.y = -0.2;
    thigh.add(thighMesh);

    const shin = new THREE.Group();
    shin.position.y = -0.4;
    thigh.add(shin);
    const shinMesh = mesh(new THREE.BoxGeometry(0.14, 0.38, 0.15), skinMat);
    shinMesh.position.y = -0.19;
    shin.add(shinMesh);

    // Высокие боксёрки: голенище закрывает низ голени, подошва выходит
    // вперёд. Раньше ботинок был вдвое ниже и в силуэте читался как обрубок.
    const boot = mesh(new THREE.BoxGeometry(0.16, 0.24, 0.17), shoeMat);
    boot.position.y = -0.3;
    shin.add(boot);
    const sole = mesh(new THREE.BoxGeometry(0.175, 0.06, 0.32), shoeMat);
    sole.position.set(0, -0.43, 0.06);
    shin.add(sole);
    if (detail) {
      const cuff = mesh(new THREE.BoxGeometry(0.165, 0.05, 0.175), wrapMat);
      cuff.position.y = -0.19;
      shin.add(cuff);
    }
    return { thigh, shin };
  });

  // ─────────────────────────────────────────── корпус: два сегмента спины
  const body = new THREE.Group();
  body.position.y = 0.92;
  root.add(body);

  const waist = new THREE.Group();
  waist.position.y = 0.1;
  body.add(waist);
  const waistMesh = mesh(new THREE.BoxGeometry(0.36 * bw, 0.26, 0.23 * (0.86 + opts.build * 0.28)), skinMat);
  waist.add(waistMesh);
  if (detail) {
    for (const y of [0.07, -0.01, -0.09]) {
      const abs = mesh(new THREE.BoxGeometry(0.24, 0.05, 0.03), skinMat);
      abs.position.set(0, y, 0.115 * bw + 0.005);
      waist.add(abs);
    }
  }

  // Трусы + пояс. Пояс чуть больше трусов по Z, иначе грани мерцают (z-fight).
  const trunks = mesh(new THREE.BoxGeometry(0.44, 0.2, 0.27), trunksMat);
  trunks.position.y = -0.22;
  waist.add(trunks);
  const belt = mesh(new THREE.BoxGeometry(0.4, 0.05, 0.285), trimMat);
  belt.position.y = -0.125;
  waist.add(belt);
  for (const side of [-1, 1]) {
    const stripe = mesh(new THREE.BoxGeometry(0.02, 0.18, 0.22), trimMat);
    stripe.position.set(side * 0.225, -0.22, 0);
    waist.add(stripe);
  }

  const chest = new THREE.Group();
  chest.position.y = 0.31;
  waist.add(chest);
  const chestMesh = mesh(new THREE.BoxGeometry(0.46 * bw, 0.34, 0.29 * bw), skinMat);
  chest.add(chestMesh);
  const yoke = mesh(new THREE.BoxGeometry(0.5 * bw, 0.12, 0.27 * bw), skinMat);
  yoke.position.y = 0.15;
  chest.add(yoke);
  if (detail) {
    for (const side of [-1, 1]) {
      const pec = mesh(new THREE.BoxGeometry(0.19 * bw, 0.11, 0.05 + opts.build * 0.05), skinMat);
      pec.position.set(side * 0.105 * bw, 0.0, 0.145 * bw + 0.02);
      chest.add(pec);
    }
  }
  const neck = mesh(new THREE.BoxGeometry(0.13, 0.12, 0.13), skinMat);
  neck.position.y = 0.23;
  chest.add(neck);

  // ─────────────────────────────────────────────────────────────── голова
  const head = new THREE.Group();
  head.position.y = 0.39;
  chest.add(head);
  const skull = mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  head.add(skull);

  const f = faceTraits(opts.face);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(f.eyeW, f.eyeH, 0.02), eyeMat);
    eye.position.set(side * f.eyeGap, f.eyeY, 0.141);
    head.add(eye);

    const brow = mesh(new THREE.BoxGeometry(f.eyeW + 0.03, 0.03, 0.03), hairMat);
    brow.position.set(side * f.eyeGap, f.eyeY + 0.05, 0.135);
    brow.rotation.z = side * f.browAngle;
    head.add(brow);

    const ear = mesh(new THREE.BoxGeometry(0.03, 0.08, 0.06), skinMat);
    ear.position.set(side * 0.15, 0.0, -0.01);
    head.add(ear);
  }

  // Нос заметно выступает: в профиль это единственная черта, по которой
  // читается лицо, а бойцы стоят к камере боком почти весь бой.
  const nose = mesh(new THREE.BoxGeometry(f.noseW, f.noseH, 0.08), skinMat);
  nose.position.set(0, f.eyeY - 0.07, 0.165);
  head.add(nose);

  if (f.jaw) {
    const jaw = mesh(new THREE.BoxGeometry(0.29, 0.08, 0.27), skinMat);
    jaw.position.y = -0.13;
    head.add(jaw);
  }

  // Капа: единственная деталь, которая мгновенно читается как «бокс».
  const mouthguard = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.018, 0.015),
    new THREE.MeshBasicMaterial({ color: 0x6d2020 }),
  );
  mouthguard.position.set(0, -0.085, 0.142);
  head.add(mouthguard);

  addHair(head, hairMat, opts.hairStyle);

  // ─────────────────────────────────────────────────────────────── руки
  const shoulderX = 0.26 + opts.build * 0.05;
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * shoulderX, 0.08, 0);
    chest.add(shoulder);
    const cap = mesh(new THREE.BoxGeometry(0.14 * aw, 0.14 * aw, 0.14 * aw), skinMat);
    shoulder.add(cap);
    const upper = mesh(new THREE.BoxGeometry(0.13 * aw, 0.26, 0.13 * aw), skinMat);
    upper.position.y = -0.14;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);
    const joint = mesh(new THREE.BoxGeometry(0.13, 0.1, 0.13), skinMat);
    elbow.add(joint);
    const forearm = mesh(new THREE.BoxGeometry(0.125 * aw, 0.24, 0.125 * aw), skinMat);
    forearm.position.y = -0.14;
    elbow.add(forearm);
    const wrap = mesh(new THREE.BoxGeometry(0.125, 0.07, 0.125), wrapMat);
    wrap.position.y = -0.25;
    elbow.add(wrap);

    const glove = mesh(new THREE.BoxGeometry(0.19, 0.19, 0.2), gloveMat);
    glove.position.y = -0.37;
    elbow.add(glove);
    if (detail) {
      const thumb = mesh(new THREE.BoxGeometry(0.06, 0.08, 0.08), gloveMat);
      thumb.position.set(side * -0.1, -0.35, 0.04);
      elbow.add(thumb);
    }
    return { shoulder, elbow, glove };
  });

  const [left, right] = arms;

  // Высокая стойка: перчатки у подбородка, локти прижаты.
  left.shoulder.rotation.set(-0.78, 0.34, -0.2);
  left.elbow.rotation.set(-1.95, 0, 0.3);
  right.shoulder.rotation.set(-0.78, -0.34, 0.2);
  right.elbow.rotation.set(-1.95, 0, -0.3);

  // ───────────────────────────────────────────────────────── износ и урон
  const decals = detail ? buildDecals(head, chest, waist) : [];
  // Вспышка идёт только по коже: когда её ставили и на трусы с перчатками,
  // боец на попадании становился белым силуэтом и терял цвет угла.
  const flashMats = [skinMat];

  const rig: BoxerRig = {
    root,
    body,
    hips,
    waist,
    chest,
    head,
    shoulderL: left.shoulder,
    shoulderR: right.shoulder,
    elbowL: left.elbow,
    elbowR: right.elbow,
    gloveL: left.glove,
    gloveR: right.glove,
    mouthguard,
    thighL: legs[0].thigh,
    thighR: legs[1].thigh,
    shinL: legs[0].shin,
    shinR: legs[1].shin,
    defaults: {
      bodyPos: body.position.clone(),
      bodyRot: body.rotation.clone(),
      chestRot: chest.rotation.clone(),
      headRot: head.rotation.clone(),
      headPos: head.position.clone(),
      shoulderL: left.shoulder.rotation.clone(),
      shoulderR: right.shoulder.rotation.clone(),
      elbowL: left.elbow.rotation.clone(),
      elbowR: right.elbow.rotation.clone(),
      hipsY: hips.position.y,
      boneRest: [],
    },
    setFlash(amount: number) {
      for (const m of flashMats) m.emissive.setRGB(amount * 0.5, amount * 0.06, amount * 0.06);
    },
    setDamage(headDmg: number, bodyDmg: number) {
      for (const d of decals) {
        const wear = d.zone === 'head' ? headDmg : bodyDmg;
        const t = THREE.MathUtils.clamp((wear - d.threshold) / 0.25, 0, 1);
        d.mesh.visible = t > 0.02;
        d.mesh.material.opacity = t * d.maxOpacity;
      }
    },
    ragdollBones(): RagdollBone[] {
      // Порядок важен: сначала листья. Box3 родителя, у которого дети ещё не
      // отцеплены, включает их габариты — и грудь получает капсулу с головой.
      return [
        { name: 'head', object: head, mass: 5, parent: null },
        { name: 'foreL', object: left.elbow, mass: 1.8, parent: 'armL', hinge: ELBOW(left.elbow) },
        { name: 'foreR', object: right.elbow, mass: 1.8, parent: 'armR', hinge: ELBOW(right.elbow) },
        { name: 'armL', object: left.shoulder, mass: 2.2, parent: 'chest' },
        { name: 'armR', object: right.shoulder, mass: 2.2, parent: 'chest' },
        { name: 'shinL', object: legs[0].shin, mass: 4, parent: 'legL', hinge: KNEE(legs[0].shin) },
        { name: 'shinR', object: legs[1].shin, mass: 4, parent: 'legR', hinge: KNEE(legs[1].shin) },
        { name: 'legL', object: legs[0].thigh, mass: 7, parent: 'hips' },
        { name: 'legR', object: legs[1].thigh, mass: 7, parent: 'hips' },
        { name: 'chest', object: chest, mass: 17, parent: 'head' },
        { name: 'waist', object: waist, mass: 12, parent: 'chest' },
        { name: 'hips', object: hips, mass: 10, parent: 'waist' },
      ];
    },
  };
  // Снимок делается после сборки: рэгдолл переносит эти объекты к себе, и
  // без снимка вернуть их в иерархию с правильным локальным трансформом
  // уже нечем — Object3D.add() оставляет матрицу от holder-группы.
  rig.defaults.boneRest = rig.ragdollBones().map((b) => ({
    object: b.object,
    position: b.object.position.clone(),
    quaternion: b.object.quaternion.clone(),
  }));
  return rig;
}

/** Сбросить весь риг в позу покоя (между раундами). */
export function resetPose(rig: BoxerRig): void {
  const d = rig.defaults;
  for (const b of d.boneRest) {
    b.object.position.copy(b.position);
    b.object.quaternion.copy(b.quaternion);
    b.object.scale.set(1, 1, 1);
  }
  rig.body.position.copy(d.bodyPos);
  rig.body.rotation.copy(d.bodyRot);
  rig.chest.rotation.copy(d.chestRot);
  rig.head.rotation.copy(d.headRot);
  rig.head.position.copy(d.headPos);
  rig.shoulderL.rotation.copy(d.shoulderL);
  rig.shoulderR.rotation.copy(d.shoulderR);
  rig.elbowL.rotation.copy(d.elbowL);
  rig.elbowR.rotation.copy(d.elbowR);
  rig.hips.position.y = d.hipsY;
  rig.hips.rotation.set(0, 0, 0);
  for (const g of [rig.thighL, rig.thighR, rig.shinL, rig.shinR]) g.rotation.set(0, 0, 0);
  for (const o of [rig.chest, rig.waist, rig.head, rig.gloveL, rig.gloveR]) o.scale.set(1, 1, 1);
  rig.setFlash(0);
}

interface Decal {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  zone: 'head' | 'body';
  threshold: number;
  maxOpacity: number;
}

/**
 * Синяки, отёк и рассечения. Каждый — плоская накладка чуть впереди грани
 * родителя, с порогом по накопленному урону в своей зоне.
 */
function buildDecals(head: THREE.Object3D, chest: THREE.Object3D, waist: THREE.Object3D): Decal[] {
  const out: Decal[] = [];
  const add = (
    parent: THREE.Object3D, zone: 'head' | 'body', color: number,
    w: number, h: number, x: number, y: number, z: number, threshold: number, maxOpacity: number,
  ): void => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    );
    m.position.set(x, y, z);
    m.visible = false;
    m.renderOrder = 2;
    parent.add(m);
    out.push({ mesh: m as Decal['mesh'], zone, threshold, maxOpacity });
  };

  add(head, 'head', 0x6b3050, 0.07, 0.04, -0.06, 0.05, 0.142, 0.15, 0.9);   // синяк под глазом
  add(head, 'head', 0x8e2222, 0.05, 0.015, 0.06, 0.11, 0.142, 0.35, 1.0);   // рассечение брови
  add(head, 'head', 0x7a1616, 0.03, 0.07, 0.0, -0.045, 0.143, 0.55, 1.0);   // кровь из носа
  add(head, 'head', 0x5c2a44, 0.09, 0.05, 0.05, 0.0, 0.142, 0.75, 0.85);    // отёк скулы
  add(chest, 'body', 0x6a3350, 0.13, 0.09, -0.08, -0.02, 0.16, 0.3, 0.7);   // отбитые рёбра
  add(waist, 'body', 0x6a3350, 0.12, 0.08, 0.07, 0.0, 0.13, 0.55, 0.7);     // печень
  return out;
}

/**
 * Детерминированные черты лица: тот же индекс — то же лицо, всегда.
 * Крошечный LCG вместо Math.random: ростер должен быть воспроизводимым.
 */
function faceTraits(index: number): {
  eyeW: number; eyeH: number; eyeGap: number; eyeY: number;
  browAngle: number; noseW: number; noseH: number; jaw: boolean;
} {
  let s = ((index + 1) * 1103515245 + 12345) % 2147483647;
  const rnd = (): number => (s = (s * 48271) % 2147483647) / 2147483647;
  return {
    eyeW: 0.045 + rnd() * 0.025,
    eyeH: 0.02 + rnd() * 0.015,
    eyeGap: 0.055 + rnd() * 0.02,
    eyeY: 0.03 + rnd() * 0.03,
    browAngle: (rnd() - 0.35) * 0.5,
    noseW: 0.04 + rnd() * 0.03,
    noseH: 0.05 + rnd() * 0.03,
    jaw: rnd() > 0.55,
  };
}

function addHair(head: THREE.Group, mat: THREE.Material, style: number): void {
  const put = (w: number, h: number, d: number, x: number, y: number, z: number): void => {
    const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    head.add(m);
  };
  switch (style % 5) {
    case 1: put(0.3, 0.14, 0.3, 0, 0.16, 0); put(0.3, 0.07, 0.05, 0, 0.1, 0.13); break;  // площадка
    case 2: put(0.07, 0.18, 0.3, 0, 0.17, 0); put(0.3, 0.035, 0.3, 0, 0.07, 0); break;   // ирокез
    case 3: break;                                                                        // лысый
    case 4: put(0.285, 0.05, 0.285, 0, 0.14, 0); break;                                   // ёжик
    default: put(0.3, 0.1, 0.3, 0, 0.13, 0); put(0.3, 0.07, 0.05, 0, 0.08, 0.13); break;  // шапка + чёлка
  }
}

function std(color: number, roughness: number, flat = false): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: flat });
}

function mesh(geom: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geom, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
