import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { BoxerRig, RagdollBone } from './boxerRig';

/**
 * Рэгдолл ИЗ САМОГО ПЕРСОНАЖА, а не из капсул-заменителей.
 *
 * `world/ragdoll.ts` (слэшер) строит труп из семи капсул и прячет живую
 * модель — для толпы врагов это правильно и дёшево. В файтинге бойцов ровно
 * двое и камера смотрит им в лицо: подмена на капсулы в момент нокдауна —
 * самый заметный обман в кадре. Поэтому здесь физике отдаются настоящие
 * подграфы рига: голова с лицом, грудь с рёбрами, руки в перчатках.
 *
 * Как это работает:
 *
 * 1. Для каждой кости берём мировой AABB её подграфа (`Box3.setFromObject`)
 *    ДО того, как отцепили её детей — поэтому список костей идёт «листья →
 *    корень» (см. `BoxerRig.ragdollBones()`). Скиненный риг геометрии в
 *    подграфе не имеет и приносит габариты сам, через `bone.worldBox`.
 * 2. На месте AABB создаём динамическое тело с кубоид-коллайдером и
 *    holder-группу в той же точке; `holder.attach(obj)` переносит подграф без
 *    смещения (Three пересчитывает локальную матрицу под нового родителя).
 * 3. Кости сшиваются сферическими суставами в середине между центрами.
 *
 * Три ловушки те же, что в `ragdoll.ts`, и они не прощают:
 * соседние по суставу части не должны сталкиваться (иначе труп дрожит),
 * без углового демпфирования он крутится вечно, импульс прикладывается один
 * раз и клампится — иначе решатель рвёт суставы и получается судорога.
 *
 * И четыре вещи, без которых рэгдолл складывается в кучу тряпья. Все четыре
 * были пропущены в первой версии, и в кадре это выглядело так: боец оседал
 * вертикально вниз и превращался в комок на месте, где стоял.
 *
 * 1. **Конечности разбиты по суставам.** Рука одним телом от плеча до
 *    перчатки — это доска. Колено и локоть обязаны быть отдельными телами
 *    (`ragdollBones()` у обоих ригов).
 * 2. **Колено и локоть — шарниры с пределами, а не шары.** Шаровой сустав
 *    разрешает голени уехать вперёд сквозь бедро; получается насекомое.
 * 3. **У тела есть тонус.** Живое тело сопротивляется складыванию даже без
 *    сознания. Моторов у шарового сустава в этой сборке Rapier нет
 *    (`createImpulseJoint` отдаёт базовый `ImpulseJoint` без
 *    `configureMotorPosition` — падение в рантайме, типы обещают метод),
 *    поэтому тонус сделан пружинами-связками ЧЕРЕЗ сустав: две вдоль
 *    позвоночника и шесть на конечности.
 * 4. **Тело бросают целиком.** Импульс в одну кость разгоняет одну кость;
 *    остальные одиннадцать честно падают вниз. Стартовая скорость задаётся
 *    всем частям как одному твёрдому телу: v = v_цм + ω × (r − r_цм).
 */

const GROUP_RAGDOLL = 0x0008;
const GROUP_GROUND = 0x0001;
const GROUP_PROP = 0x0010;
/**
 * membership << 16 | filter: части видят пол и реквизит, но не друг друга.
 *
 * Соблазн включить сюда `GROUP_RAGDOLL` велик: тогда рука не пройдёт сквозь
 * грудь. Попробовали — и получили обратный эффект. Боец падает из БОЕВОЙ
 * СТОЙКИ, а в ней предплечья стоят вплотную к груди, и их коробки
 * пересекаются с самого первого кадра. Решатель начинает с того, что
 * растаскивает пересечения, и это съедает всю стартовую скорость: боец
 * оседал вертикально там, где стоял, вместо того чтобы улететь. Замер это
 * показал сразу — таз падал с 1.04 до 0.34 м за 20 кадров, то есть просто
 * свободным падением.
 *
 * Столкновения частей между собой имеют смысл там, где рэгдолл собирается
 * из непересекающихся капсул. Здесь форму держат шарниры и связки.
 */
const RAGDOLL_GROUPS = (GROUP_RAGDOLL << 16) | (GROUP_GROUND | GROUP_PROP);

/** Максимальный импульс на одно тело, Н·с. Выше — суставы рвутся. */
const MAX_IMPULSE = 34;
/** Минимальная полутолщина коллайдера: у плоских накладок AABB почти нулевой. */
const MIN_HALF = 0.04;
/**
 * Жёсткость и демпфирование «тонуса» шаровых суставов.
 *
 * Числа маленькие намеренно: это не сопротивление сознательного человека, а
 * упругость связок. С жёсткостью втрое больше боец падал доской и отскакивал
 * от настила; без тонуса вообще — оседал в кучу на месте.
 */
const TONE_STIFFNESS = 180;
const TONE_DAMPING = 14;
/** Жёсткость связок конечностей: им положено висеть, а не держать форму. */
const LIMB_TONE = 70;
/** Якорь пружины в центре тела: связка тянет за центры масс, а не за край. */
const ZERO = { x: 0, y: 0, z: 0 };
/** Насколько коробка конечности уже реального сегмента, чтобы не распирало. */
const LIMB_SHRINK = 0.86;

interface Part {
  body: RAPIER.RigidBody;
  holder: THREE.Group;
  /** Полуразмеры коробки: по ним считается нижняя точка тела в мире. */
  half: THREE.Vector3;
}

export interface BoxerRagdollOptions {
  /** Импульс от последнего удара, м/с·кг. Клампится. */
  impulse: THREE.Vector3;
  /** По какой кости пришёлся удар: 'head' | 'chest' | 'waist'. */
  hitBone?: string;
}

export class BoxerRagdoll {
  /** Секунды с момента нокдауна — по ним демо решает, когда поднимать бойца. */
  age = 0;
  readonly group = new THREE.Group();
  private readonly parts = new Map<string, Part>();
  private readonly joints: RAPIER.ImpulseJoint[] = [];
  /** Пружины-связки. Отдельно от суставов: их считает головная проверка. */
  private readonly tendons: RAPIER.ImpulseJoint[] = [];
  private readonly restored: Array<{ object: THREE.Object3D; parent: THREE.Object3D }> = [];
  /**
   * Боковая ось персонажа в мировых координатах — ось шарниров колена и
   * локтя. Тела рэгдолла создаются без поворота, поэтому мировое
   * направление в момент сборки и есть локальная ось для обоих тел сустава.
   */
  private readonly side = new THREE.Vector3(1, 0, 0);
  private readonly hinges = new Map<string, NonNullable<RagdollBone['hinge']>>();

  constructor(
    private readonly world: RAPIER.World,
    scene: THREE.Object3D,
    rig: BoxerRig,
    opts: BoxerRagdollOptions,
  ) {
    scene.add(this.group);
    rig.root.updateWorldMatrix(true, true);
    this.side.set(1, 0, 0).applyQuaternion(
      new THREE.Quaternion().setFromRotationMatrix(rig.root.matrixWorld),
    ).normalize();

    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    const half = new THREE.Vector3();

    const bones = rig.ragdollBones();
    for (const bone of bones) {
      if (bone.worldBox) bone.worldBox(box);
      else box.setFromObject(bone.object);
      if (box.isEmpty()) continue;
      box.getCenter(center);
      box.getSize(size);

      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(center.x, center.y, center.z)
          .setLinearDamping(0.06)
          // Ловушка №2: без демпфирования тело вращается до конца раунда.
          // Но 3.5 — это уже не «не вращается вечно», а «не вращается
          // вообще»: закрутка гасла за треть секунды, боец не успевал
          // опрокинуться и садился на настил, как кукла. Оборот тела при
          // демпфировании λ равен ω/λ; при ω = 3 рад/с и λ = 3.5 это 50°,
          // а чтобы лечь, нужно 90°.
          .setAngularDamping(0.7)
          .setCcdEnabled(true),
      );
      // Конечности сужаются: их коробки считаны по отрезку скелета и у
      // плеча с бедром заведомо перекрываются с корпусом. Соседей спасает
      // выключенный контакт, а вот предплечье и грудь — соседи не всегда,
      // и на полной толщине их распирало в первом же кадре.
      const k = bone.hinge || bone.parent === 'chest' || bone.parent === 'hips'
        ? LIMB_SHRINK : 1;
      half.set(
        Math.max((size.x * k) / 2, MIN_HALF),
        Math.max((size.y * k) / 2, MIN_HALF),
        Math.max((size.z * k) / 2, MIN_HALF),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
          .setMass(bone.mass)
          .setFriction(0.9)
          .setRestitution(0.03)
          // Ловушка №1: части не видят друг друга, только ринг.
          .setCollisionGroups(RAGDOLL_GROUPS),
        body,
      );

      const holder = new THREE.Group();
      holder.position.copy(center);
      this.group.add(holder);
      this.restored.push({ object: bone.object, parent: bone.object.parent ?? rig.root });
      // attach (а не add) сохраняет мировое положение подграфа.
      holder.attach(bone.object);

      this.parts.set(bone.name, { body, holder, half: half.clone() });
      if (bone.hinge) this.hinges.set(bone.name, bone.hinge);
    }

    // Суставы — вторым проходом, и порядок тут решает всё. Кости идут
    // «листья → корень» (этого требует Box3: у родителя габариты считаются,
    // пока дети ещё при нём), а ссылается каждая на РОДИТЕЛЯ, который в
    // таком порядке создаётся позже. Пока сшивание шло внутри того же
    // цикла, `parts.get(bone.parent)` для рук и ног возвращал undefined, и
    // они молча оставались ничем не связанными телами: корпус падал, а ноги
    // так и стояли на настиле, потому что их коробки опираются на пол и
    // тянуть их было нечем.
    for (const bone of bones) this.link(bone);
    // Связки — поверх суставов, через один сустав. Шаровому суставу в этой
    // сборке Rapier нельзя задать ни конус, ни мотор, поэтому «докуда
    // сустав гнётся» задаётся расстоянием между телами через него.
    //
    // Позвоночник — жёстче: три шаровых сустава подряд, без связок он
    // складывается вдвое ещё в полёте. Конечности — мягче: им положено
    // висеть, и слишком тугая связка превращает бойца в доску.
    this.tendon('head', 'waist');
    this.tendon('chest', 'hips');
    // Бедро к груди и голень к тазу: без них прямая нога свободно
    // заворачивалась к животу, и боец приземлялся в позу эмбриона — от
    // головы до стопы оставалось 0.76 м вместо полутора.
    for (const side of ['L', 'R']) {
      this.tendon(`leg${side}`, 'chest', LIMB_TONE);
      this.tendon(`shin${side}`, 'hips', LIMB_TONE);
      this.tendon(`arm${side}`, 'hips', LIMB_TONE);
    }

    // Ловушка №3: один импульс, в одну кость, с потолком. Но одного импульса
    // мало — и это была главная причина, по которой нокдаун выглядел
    // «боец осел на месте». Импульс в грудь разгоняет грудь; ноги при этом
    // остаются стоять, суставы гасят рывок, и тело складывается вертикально
    // вниз. Сбитого человека БРОСАЕТ целиком, поэтому здесь три действия.
    const imp = opts.impulse.clone();
    if (imp.length() > MAX_IMPULSE) imp.setLength(MAX_IMPULSE);

    // 1. Всё тело стартует как ОДНО твёрдое тело: общая скорость плюс
    // вращение вокруг общего центра масс. Скорость каждой части —
    // v = v_цм + ω × (r − r_цм). Пока части получали только общую скорость,
    // а вращение доставалось четырём телам из двенадцати, конечности
    // тормозили корпус, ноги подламывались, и боец опускался на колени
    // вместо того, чтобы упасть.
    const speed = THREE.MathUtils.clamp(imp.length() * 0.22, 1.4, 3.6);
    const flight = imp.clone().setY(0).normalize().multiplyScalar(speed);
    flight.y = 1.1 + speed * 0.25;

    // Знак вращения решает, куда боец падает. ω = вверх × полёт означает,
    // что верх тела уходит ПО направлению удара, а ноги остаются — то есть
    // падение на спину. С обратным знаком боец ныряет лицом к бьющему и
    // складывается на колени: именно это и было на первых снимках.
    const spin = new THREE.Vector3(0, 1, 0).cross(flight).normalize()
      .multiplyScalar(1.7 + speed * 0.35);

    let mass = 0;
    const com = new THREE.Vector3();
    for (const part of this.parts.values()) {
      const m = part.body.mass();
      const p = part.body.translation();
      com.addScaledVector(new THREE.Vector3(p.x, p.y, p.z), m);
      mass += m;
    }
    com.multiplyScalar(1 / Math.max(1e-6, mass));

    const arm = new THREE.Vector3();
    const vel = new THREE.Vector3();
    for (const part of this.parts.values()) {
      const p = part.body.translation();
      arm.set(p.x, p.y, p.z).sub(com);
      vel.copy(spin).cross(arm).add(flight);
      part.body.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true);
      part.body.setAngvel({ x: spin.x, y: spin.y, z: spin.z }, true);
    }

    // 2. И только теперь — точечный импульс в кость, по которой пришёлся
    // удар: он добавляет к общему полёту «дёрнулась именно голова».
    const hit = this.parts.get(opts.hitBone ?? 'chest') ?? this.parts.get('chest');
    hit?.body.applyImpulse({ x: imp.x * 0.5, y: imp.y * 0.5, z: imp.z * 0.5 }, true);
  }

  private link(bone: RagdollBone): void {
    if (!bone.parent) return;
    const a = this.parts.get(bone.parent);
    const b = this.parts.get(bone.name);
    if (!a || !b) return;
    const pa = a.body.translation();
    const pb = b.body.translation();
    const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 };
    const anchor1 = { x: mid.x - pa.x, y: mid.y - pa.y, z: mid.z - pa.z };
    const anchor2 = { x: mid.x - pb.x, y: mid.y - pb.y, z: mid.z - pb.z };
    const hinge = bone.hinge;

    if (hinge) {
      // Колено и локоть. Ось — боковая ось персонажа, пределы считаются от
      // ТЕКУЩЕГО сгиба: тела созданы без поворота, поэтому угол сустава в
      // момент сборки равен нулю, а анатомический ноль (прямая нога) — это
      // −now(). Отсюда диапазон [0 − now, max − now], домноженный на знак.
      const now = THREE.MathUtils.clamp(hinge.now(), 0, hinge.max);
      const lo = hinge.sign * (0 - now);
      const hi = hinge.sign * (hinge.max - now);
      const params = RAPIER.JointData.revolute(
        anchor1, anchor2, { x: this.side.x, y: this.side.y, z: this.side.z },
      );
      const joint = this.world.createImpulseJoint(
        params, a.body, b.body, true,
      ) as RAPIER.RevoluteImpulseJoint;
      // Именно вызовом, а не полями дескриптора: `JointData.revolute`
      // проносит `limitsEnabled` мимо конструктора, и сустав молча
      // остаётся с пределами ±3.4e38 — то есть без пределов вообще.
      joint.setLimits(Math.min(lo, hi), Math.max(lo, hi));
      joint.setContactsEnabled(false);
      this.joints.push(joint);
      return;
    }

    const params = RAPIER.JointData.spherical(anchor1, anchor2);
    const joint = this.world.createImpulseJoint(params, a.body, b.body, true);
    joint.setContactsEnabled(false);
    this.joints.push(joint);
  }

  /**
   * Связка: пружина между двумя НЕсоседними телами с длиной покоя «как
   * сейчас». Она ничего не держит жёстко, но не даёт цепочке суставов
   * сложиться вдвое — то есть делает ровно то, что делают мышцы спины у
   * человека без сознания.
   *
   * Тонус мог бы жить в самих суставах, но моторов у шарового сустава в
   * этой сборке Rapier нет: `createImpulseJoint` возвращает базовый
   * `ImpulseJoint`, у которого `configureMotorPosition` просто не
   * определён — падение обнаружилось только в прогоне, типы обещают метод.
   */
  private tendon(from: string, to: string, stiffness = TONE_STIFFNESS): void {
    const a = this.parts.get(from);
    const b = this.parts.get(to);
    if (!a || !b) return;
    const pa = a.body.translation();
    const pb = b.body.translation();
    const rest = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
    this.tendons.push(this.world.createImpulseJoint(
      RAPIER.JointData.spring(rest, stiffness, TONE_DAMPING, ZERO, ZERO),
      a.body, b.body, true,
    ));
  }

  /** Перенести состояние тел в сцену. Вызывать раз в кадр после world.step(). */
  sync(): void {
    for (const part of this.parts.values()) {
      const p = part.body.translation();
      const r = part.body.rotation();
      part.holder.position.set(p.x, p.y, p.z);
      part.holder.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /**
   * Сколько тел и сколько связей между ними. Смотрит головная проверка:
   * несшитая конечность ведёт себя как отдельный предмет и в кадре это
   * видно сразу, а в коде — ничем, поэтому число суставов проверяется явно.
   */
  get counts(): { parts: number; joints: number; tendons: number } {
    return { parts: this.parts.size, joints: this.joints.length, tendons: this.tendons.length };
  }

  /**
   * Самая низкая точка коллайдеров, метры. По ней головная проверка видит,
   * не проваливается ли рэгдолл сквозь настил: у позы такой замер есть
   * давно, а у физики его не было — и она проваливалась.
   */
  get lowestPoint(): number {
    let low = Infinity;
    const q = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    for (const part of this.parts.values()) {
      const p = part.body.translation();
      const r = part.body.rotation();
      m.makeRotationFromQuaternion(q.set(r.x, r.y, r.z, r.w));
      const e = m.elements;
      // Полувысота повёрнутой коробки: проекция трёх её осей на мировой Y.
      const dy = Math.abs(e[1]) * part.half.x
        + Math.abs(e[5]) * part.half.y
        + Math.abs(e[9]) * part.half.z;
      low = Math.min(low, p.y - dy);
    }
    return low;
  }

  /** Средняя скорость тел: по ней видно, что труп улёгся и можно вставать. */
  get settled(): boolean {
    let v = 0;
    for (const part of this.parts.values()) {
      const l = part.body.linvel();
      v += Math.abs(l.x) + Math.abs(l.y) + Math.abs(l.z);
    }
    return v / Math.max(1, this.parts.size) < 0.35;
  }

  /** Мировая позиция таза — куда «переехал» боец, пока падал. */
  hipsPosition(out: THREE.Vector3): THREE.Vector3 {
    const p = (this.parts.get('hips') ?? this.parts.get('waist'))?.body.translation();
    return p ? out.set(p.x, p.y, p.z) : out.set(0, 0, 0);
  }

  /**
   * Вернуть подграфы рига на их исходные места в иерархии и убрать тела.
   * Локальные трансформы восстанавливает `resetPose(rig)` на стороне демо.
   */
  dispose(): void {
    for (const { object, parent } of this.restored) parent.add(object);
    this.restored.length = 0;
    for (const j of this.joints) this.world.removeImpulseJoint(j, true);
    this.joints.length = 0;
    for (const t of this.tendons) this.world.removeImpulseJoint(t, true);
    this.tendons.length = 0;
    for (const part of this.parts.values()) this.world.removeRigidBody(part.body);
    this.parts.clear();
    this.group.removeFromParent();
  }
}
