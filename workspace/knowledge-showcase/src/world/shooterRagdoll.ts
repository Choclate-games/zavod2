import * as THREE from 'three';
import type { ShooterRig } from './shooterRig';

/**
 * Рэгдолл трупа БЕЗ физического движка: точки, связки, верле.
 *
 * В стенде уже два рэгдолла на Rapier — `ragdoll.ts` (капсулы вместо модели)
 * и `boxerRagdoll.ts` (тела из самих костей). Оба правильные, и оба здесь не
 * подходят: во вкладке FPS физического мира нет вообще, а заводить его ради
 * падающих трупов — это лишний wasm, асинхронная инициализация и полтора
 * десятка тел на каждого из семи врагов.
 *
 * Труп при этом — самая снисходительная к точности задача в игре: он падает
 * один раз, ни с чем не взаимодействует и через десяток секунд убирается.
 * Ему хватает интегратора Верле на пятнадцати точках:
 *
 *   позиция += (позиция − прошлая) · затухание + g·dt²
 *
 * Скорость здесь не хранится — она И ЕСТЬ разность двух последних позиций.
 * Из этого следует главное свойство: **ограничения задаются прямо в
 * позициях**. Развести две точки на нужную длину — значит просто сдвинуть
 * их; скорость пересчитается сама и останется согласованной. Поэтому верле
 * не взрывается от жёстких связок, в отличие от честного солвера, которому
 * пришлось бы гасить импульсы.
 *
 * Скелет собирается ИЗ САМОГО РИГА в момент смерти: длины костей берутся
 * замером по текущей позе, а не константами. У X Bot и Y Bot пропорции
 * разные, и от общих констант одного из них разорвало бы.
 *
 * Три вещи, без которых получается тряпка, а не тело:
 *
 * 1. **Раскосины корпуса.** Цепочки таз→грудь→голова мало: корпус
 *    складывается вдвое. Треугольники (плечи↔таз, грудь↔бёдра) держат
 *    грудную клетку как единое целое, оставаясь при этом мягкими.
 * 2. **Ограничения «не ближе, чем».** Обычная связка держит длину и сверху,
 *    и снизу; локоть и колено обязаны сгибаться, но не складываться в ноль.
 *    Связка плечо↔кисть, работающая ТОЛЬКО на разжатие, оставляет сустав
 *    свободным и не даёт руке сложиться пополам.
 * 3. **Трение о пол.** Без него тело едет по арене, как по льду, и уезжает
 *    от места смерти на несколько метров. Трение в верле — это подтягивание
 *    ПРОШЛОЙ позиции к текущей: гасится ровно касательная скорость.
 */

/** Ящик уровня: рэгдолл падает на укрытия, а не сквозь них. */
export interface RagdollSolid {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export interface ShooterRagdollOptions {
  /** Скорость, которую тело получает от последнего попадания, м/с. */
  impulse: THREE.Vector3;
  /** Куда пришлась пуля: голову откидывает сильнее корпуса. */
  zone: 'head' | 'body' | 'limb';
  solids: readonly RagdollSolid[];
  /** Половина стороны арены: стены. */
  bounds: number;
}

/** Порядок точек. Индексами пользуются и связки, и разбор позы. */
const HIPS = 0, CHEST = 1, HEAD = 2;
const SH_L = 3, EL_L = 4, HA_L = 5;
const SH_R = 6, EL_R = 7, HA_R = 8;
const HI_L = 9, KN_L = 10, FT_L = 11;
const HI_R = 12, KN_R = 13, FT_R = 14;
const COUNT = 15;

/** Радиус точки для столкновений. */
const RADIUS = 0.09;
const GRAVITY = -17;
/** Затухание скорости за шаг. Выше — тело «плывёт» в воздухе. */
const DAMPING = 0.986;
/** Итераций решателя связок за шаг. Меньше четырёх — тело течёт. */
const ITERATIONS = 6;
/** Доля касательной скорости, съедаемая поверхностью за шаг контакта. */
const FRICTION = 0.42;
/** Ниже этой суммарной подвижности тело засыпает и перестаёт считаться. */
const SLEEP_EPS = 0.0016;

interface Link {
  a: number;
  b: number;
  rest: number;
  stiff: number;
  /** Только разжимать: сустав волен сгибаться, но не складываться в ноль. */
  minOnly: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _euler = new THREE.Euler();

export class ShooterRagdoll {
  /** Секунды с момента смерти. По ним игра решает, когда убирать тело. */
  age = 0;
  /** Тело улеглось: считать его больше не нужно. */
  asleep = false;

  private readonly pos: THREE.Vector3[] = [];
  private readonly prev: THREE.Vector3[] = [];
  private readonly links: Link[] = [];
  private readonly solids: readonly RagdollSolid[];
  private readonly bounds: number;

  constructor(rig: ShooterRig, opts: ShooterRagdollOptions) {
    this.solids = opts.solids;
    this.bounds = opts.bounds;
    rig.root.updateMatrixWorld(true);

    // Точки снимаются с ЖИВОЙ позы: тело начинает падать ровно оттуда, где
    // враг стоял в кадре смерти, без щелчка в какую-нибудь «позу трупа».
    const at = (o: THREE.Object3D, lift = 0): THREE.Vector3 => {
      const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      p.y += lift;
      return p;
    };
    this.pos[HIPS] = at(rig.hips);
    this.pos[CHEST] = at(rig.chest);
    this.pos[HEAD] = at(rig.head, 0.12);
    this.pos[SH_L] = at(rig.shoulderL);
    this.pos[EL_L] = at(rig.elbowL);
    this.pos[HA_L] = at(rig.wristL);
    this.pos[SH_R] = at(rig.shoulderR);
    this.pos[EL_R] = at(rig.elbowR);
    this.pos[HA_R] = at(rig.wristR);
    this.pos[HI_L] = at(rig.thighL);
    this.pos[KN_L] = at(rig.shinL);
    this.pos[FT_L] = at(rig.ankleL);
    this.pos[HI_R] = at(rig.thighR);
    this.pos[KN_R] = at(rig.shinR);
    this.pos[FT_R] = at(rig.ankleR);

    const link = (a: number, b: number, stiff = 1): void => {
      this.links.push({ a, b, rest: this.pos[a].distanceTo(this.pos[b]), stiff, minOnly: false });
    };

    // Кости: длины замерены по модели, а не заданы числом.
    link(HIPS, CHEST); link(CHEST, HEAD);
    link(CHEST, SH_L); link(SH_L, EL_L); link(EL_L, HA_L);
    link(CHEST, SH_R); link(SH_R, EL_R); link(EL_R, HA_R);
    link(HIPS, HI_L); link(HI_L, KN_L); link(KN_L, FT_L);
    link(HIPS, HI_R); link(HI_R, KN_R); link(KN_R, FT_R);

    // Раскосины: без них корпус складывается вдвое, а плечи сходятся.
    link(SH_L, SH_R, 0.9); link(HI_L, HI_R, 0.9);
    link(HIPS, SH_L, 0.85); link(HIPS, SH_R, 0.85);
    link(CHEST, HI_L, 0.85); link(CHEST, HI_R, 0.85);
    link(HEAD, SH_L, 0.6); link(HEAD, SH_R, 0.6);
    // Позвоночник гнётся, но не складывается вдвое: связка таз↔голова
    // работает только на разжатие и держит длину корпуса почти целиком.
    // Без неё тело оседает в кучу — цепочка таз→грудь→голова свободно
    // складывается пополам, и на полу остаётся комок вместо человека.
    this.limit(HIPS, HEAD, 0.88, 0.9);

    // Упоры сустава: рука и нога складываются, но не в ноль.
    this.limit(SH_L, HA_L, 0.62); this.limit(SH_R, HA_R, 0.62);
    this.limit(HI_L, FT_L, 0.62); this.limit(HI_R, FT_R, 0.62);

    // Стартовая скорость. Больше всех достаётся той части, куда попали, но
    // достаётся и всем остальным: пуля разворачивает труп целиком, а не
    // вырывает ему голову отдельно от плеч.
    const kick = _v.copy(opts.impulse);
    const focus = opts.zone === 'head' ? HEAD : opts.zone === 'limb' ? HIPS : CHEST;
    for (let i = 0; i < COUNT; i++) {
      this.prev[i] = this.pos[i].clone();
      const share = i === focus ? 1 : 0.45;
      this.prev[i].addScaledVector(kick, -share / 60);
      // Колени и стопы получают крошечный толчок вниз: тело подгибает ноги и
      // оседает, а не улетает доской.
      if (i === KN_L || i === KN_R || i === FT_L || i === FT_R) this.prev[i].y += 0.004;
    }
  }

  private limit(a: number, b: number, factor: number, stiff = 1): void {
    this.links.push({
      a, b, rest: this.pos[a].distanceTo(this.pos[b]) * factor, stiff, minOnly: true,
    });
  }

  /** Шаг симуляции. Живёт в фиксированном шаге, как и вся физика. */
  step(dt: number): void {
    this.age += dt;
    if (this.asleep) return;
    const gy = GRAVITY * dt * dt;
    let motion = 0;

    for (let i = 0; i < COUNT; i++) {
      const p = this.pos[i];
      const q = this.prev[i];
      const vx = (p.x - q.x) * DAMPING;
      const vy = (p.y - q.y) * DAMPING;
      const vz = (p.z - q.z) * DAMPING;
      q.copy(p);
      p.set(p.x + vx, p.y + vy + gy, p.z + vz);
      motion += Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
    }

    for (let it = 0; it < ITERATIONS; it++) {
      for (const l of this.links) {
        const a = this.pos[l.a];
        const b = this.pos[l.b];
        _v.subVectors(b, a);
        const len = _v.length();
        if (len < 1e-6) continue;
        if (l.minOnly && len >= l.rest) continue;
        const push = ((len - l.rest) / len) * 0.5 * l.stiff;
        _v.multiplyScalar(push);
        a.add(_v);
        b.sub(_v);
      }
      this.collide();
    }

    // Тело считается только пока шевелится: семь трупов на арене — это семь
    // решателей, работающих вхолостую после того, как всё улеглось.
    if (this.age > 1.2 && motion < SLEEP_EPS) this.asleep = true;
  }

  private collide(): void {
    const limit = this.bounds - 0.5;
    for (let i = 0; i < COUNT; i++) {
      const p = this.pos[i];
      const q = this.prev[i];
      p.x = THREE.MathUtils.clamp(p.x, -limit, limit);
      p.z = THREE.MathUtils.clamp(p.z, -limit, limit);

      for (const s of this.solids) {
        const hx = s.w / 2 + RADIUS;
        const hz = s.d / 2 + RADIUS;
        const dx = p.x - s.x;
        const dz = p.z - s.z;
        if (Math.abs(dx) >= hx || Math.abs(dz) >= hz || p.y >= s.h + RADIUS) continue;
        // Выход по оси наименьшего проникновения — иначе точку «телепортит»
        // сквозь ящик на другую сторону.
        const px = hx - Math.abs(dx);
        const pz = hz - Math.abs(dz);
        const py = s.h + RADIUS - p.y;
        if (py <= px && py <= pz) { p.y = s.h + RADIUS; this.friction(p, q); }
        else if (px < pz) p.x = s.x + Math.sign(dx || 1) * hx;
        else p.z = s.z + Math.sign(dz || 1) * hz;
      }

      if (p.y < RADIUS) { p.y = RADIUS; this.friction(p, q); }
    }
  }

  /**
   * Трение о поверхность.
   *
   * В верле нет поля скоростей, которое можно было бы умножить на
   * коэффициент. Зато прошлая позиция И ЕСТЬ скорость: подтянув её к
   * текущей, гасим ровно касательное движение — и тело перестаёт ездить по
   * арене, как по льду.
   */
  private friction(p: THREE.Vector3, q: THREE.Vector3): void {
    q.x += (p.x - q.x) * FRICTION;
    q.z += (p.z - q.z) * FRICTION;
  }

  /** Разложить точки обратно по драйверам рига. */
  apply(rig: ShooterRig): void {
    const P = this.pos;

    // Таз — единственная точка, которая задаёт ПОЛОЖЕНИЕ. Всё остальное
    // ставится направлениями по цепочке: так поза остаётся легальной для
    // скиннинга, а кости не растягиваются, даже если решатель их развёл.
    rig.root.updateMatrixWorld(true);
    _v.copy(P[HIPS]);
    rig.root.worldToLocal(_v);
    rig.body.position.copy(_v);
    rig.hips.position.copy(_v);
    rig.root.updateMatrixWorld(true);

    // Сверху вниз: каждый сустав считается по уже выставленному родителю.
    _side.subVectors(P[HI_R], P[HI_L]);
    aim(rig.waist, UP, _dir.subVectors(P[CHEST], P[HIPS]), _side);
    _side.subVectors(P[SH_R], P[SH_L]);
    aim(rig.chest, UP, _dir.subVectors(P[HEAD], P[CHEST]), _side);
    rig.head.quaternion.identity();
    rig.head.updateMatrixWorld(true);

    aim(rig.shoulderL, DOWN, _dir.subVectors(P[EL_L], P[SH_L]), null);
    aim(rig.elbowL, DOWN, _dir.subVectors(P[HA_L], P[EL_L]), null);
    aim(rig.shoulderR, DOWN, _dir.subVectors(P[EL_R], P[SH_R]), null);
    aim(rig.elbowR, DOWN, _dir.subVectors(P[HA_R], P[EL_R]), null);
    aim(rig.thighL, DOWN, _dir.subVectors(P[KN_L], P[HI_L]), null);
    aim(rig.shinL, DOWN, _dir.subVectors(P[FT_L], P[KN_L]), null);
    aim(rig.thighR, DOWN, _dir.subVectors(P[KN_R], P[HI_R]), null);
    aim(rig.shinR, DOWN, _dir.subVectors(P[FT_R], P[KN_R]), null);
  }

  /** Высота таза над полом — по ней видно, что тело действительно упало. */
  hipHeight(): number {
    return this.pos[HIPS].y;
  }
}

/**
 * Повернуть драйвер так, чтобы кость смотрела в заданную сторону МИРА.
 *
 * Оси драйвера совпадают с осями персонажа, но только пока предки в позе
 * покоя: `pivot` гасит поворот родителя один раз, при сборке рига. В
 * рэгдолле предки повёрнуты как попало, поэтому мировое направление
 * переводится в локальное через ФАКТИЧЕСКИЙ поворот родителя, а не через
 * поворот корня.
 *
 * `side` задаёт скрутку вокруг кости. Для рук и ног она невидима и не
 * считается; для позвоночника это разница между «лежит на спине» и «лежит
 * лицом вниз» — без неё труп всегда падал бы одинаково.
 */
function aim(
  driver: THREE.Group,
  rest: THREE.Vector3,
  dirWorld: THREE.Vector3,
  sideWorld: THREE.Vector3 | null,
): void {
  const parent = driver.parent;
  if (!parent || dirWorld.lengthSq() < 1e-9) return;
  parent.updateWorldMatrix(true, false);
  parent.getWorldQuaternion(_q);
  _qi.copy(_q).invert();

  _v2.copy(dirWorld).normalize().applyQuaternion(_qi);
  if (!sideWorld || sideWorld.lengthSq() < 1e-9) {
    driver.quaternion.setFromUnitVectors(rest, _v2);
  } else {
    // Базис вокруг кости: Y вдоль неё (со знаком того, куда кость смотрит в
    // покое), X — вдоль линии плеч или бёдер, Z — довеском.
    _y.copy(_v2).multiplyScalar(rest.y);
    _x.copy(sideWorld).normalize().applyQuaternion(_qi);
    _x.addScaledVector(_y, -_x.dot(_y));
    if (_x.lengthSq() < 1e-6) {
      driver.quaternion.setFromUnitVectors(rest, _v2);
    } else {
      _x.normalize();
      _z.crossVectors(_x, _y);
      _m.makeBasis(_x, _y, _z);
      driver.quaternion.setFromRotationMatrix(_m);
    }
  }
  driver.updateMatrixWorld(true);
}

/**
 * Выпавшее из рук оружие.
 *
 * Полноценная физика ему не нужна: это коробка, которая один раз падает и
 * ложится. Но исчезнуть в кадре смерти она не может — оружие на полу
 * подтверждает, что упал именно вооружённый враг.
 */
export class DroppedProp {
  private readonly vel = new THREE.Vector3();
  private readonly spin = new THREE.Vector3();
  private settled = false;

  constructor(readonly object: THREE.Group, impulse: THREE.Vector3, rng: () => number) {
    this.vel.copy(impulse).multiplyScalar(0.35);
    this.vel.y += 1.2;
    this.spin.set((rng() - 0.5) * 7, (rng() - 0.5) * 5, (rng() - 0.5) * 7);
  }

  step(dt: number, floor: number): void {
    if (this.settled) return;
    this.vel.y += GRAVITY * dt;
    this.object.position.addScaledVector(this.vel, dt);
    _euler.set(this.spin.x * dt, this.spin.y * dt, this.spin.z * dt);
    this.object.quaternion.premultiply(_q.setFromEuler(_euler));

    if (this.object.position.y > floor + 0.06) return;
    this.object.position.y = floor + 0.06;
    this.vel.multiplyScalar(0.28);
    this.vel.y = Math.abs(this.vel.y) * 0.3;
    this.spin.multiplyScalar(0.4);
    if (this.vel.lengthSq() < 0.25) {
      // Улёгся: ствол кладётся плашмя, иначе застывает воткнутым в пол.
      this.settled = true;
      const yaw = _euler.setFromQuaternion(this.object.quaternion, 'YXZ').y;
      this.object.quaternion.setFromEuler(_euler.set(0, yaw, Math.PI * 0.45, 'YXZ'));
    }
  }
}
